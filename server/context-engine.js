import './load-env.js';

const DEFAULT_CONTEXT_WINDOW_ITEMS = Number(process.env.CONTEXT_WINDOW_ITEMS || 3);
const DEFAULT_CONTEXT_PROVIDER = process.env.CONTEXT_PROVIDER || 'heuristic';
const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const DEFAULT_OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 8000);
const DEFAULT_OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '10m';
const DEFAULT_OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20000);
const DEFAULT_CONTEXT_CACHE_TTL_MS = Number(process.env.CONTEXT_CACHE_TTL_MS || 15000);
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'had', 'has', 'have',
  'he', 'her', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me',
  'my', 'of', 'on', 'or', 'our', 'she', 'so', 'that', 'the', 'their', 'them', 'there', 'they',
  'this', 'to', 'up', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why',
  'will', 'with', 'you', 'your',
  'can', 'cannot', 'could', 'would', 'should', 'also', 'just', 'really', 'like', 'get', 'got', 'going', 'make', 'made',
  'using', 'use', 'used', 'item', 'items', 'action', 'next', 'month', 'year', 'years', 'team', 'project', 'report', 'publish'
]);

function normaliseWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function toTitleCase(text) {
  return text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function canonicalKeyword(word) {
  const cleaned = String(word || '').toLowerCase();

  if (cleaned.length >= 5 && cleaned.endsWith('s') && !cleaned.endsWith('ss')) {
    return cleaned.slice(0, -1);
  }

  return cleaned;
}

function getContextWindowItems(store, windowSize = DEFAULT_CONTEXT_WINDOW_ITEMS) {
  const items = Array.isArray(store?.items)
    ? store.items.filter((item) => typeof item?.text === 'string' && item.text.trim())
    : [];

  return {
    items,
    contextItems: items.slice(-windowSize)
  };
}

function collectKeywordCounts(items) {
  const counts = new Map();

  for (const item of items) {
    const words = normaliseWhitespace(item?.text)
      .toLowerCase()
      .match(/[a-z][a-z'-]{2,}/g) || [];

    for (const word of words) {
      const keyword = canonicalKeyword(word);
      if (STOPWORDS.has(keyword)) continue;
      counts.set(keyword, (counts.get(keyword) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function buildKeywordTopic(items) {
  const topWords = collectKeywordCounts(items)
    .slice(0, 3)
    .map(([word]) => toTitleCase(word));

  return topWords.length ? topWords.join(' · ') : 'Live Transcript';
}

function buildEmptyContext(store, source = 'heuristic fallback') {
  return {
    available: false,
    source,
    provider: 'none',
    topic: 'Live Transcript',
    summary: 'Waiting for transcript context.',
    latestUtterance: '',
    concepts: [],
    questions: [],
    actionItems: [],
    decisions: [],
    itemCount: 0,
    contextWindowItems: 0,
    updatedAt: store?.updatedAt || null
  };
}

function buildHeuristicContext(store, options = {}) {
  const source = options.source || 'heuristic fallback';
  const { items, contextItems } = getContextWindowItems(store, options.contextWindowItems);

  if (items.length === 0) {
    return buildEmptyContext(store, source);
  }

  const recentText = contextItems
    .map((item) => normaliseWhitespace(item.text))
    .filter(Boolean)
    .join(' ');

  const latestUtterance = normaliseWhitespace(contextItems.at(-1)?.text || '');
  const concepts = collectKeywordCounts(contextItems)
    .slice(0, 5)
    .map(([word]) => toTitleCase(word));
  const questions = contextItems
    .map((item) => normaliseWhitespace(item?.text))
    .filter((text) => text.includes('?'))
    .slice(-3);

  return {
    available: true,
    source,
    provider: 'heuristic',
    topic: buildKeywordTopic(contextItems),
    summary: recentText ? `Recent discussion: ${recentText}` : 'Recent discussion available.',
    latestUtterance,
    concepts,
    questions,
    actionItems: [],
    decisions: [],
    itemCount: items.length,
    contextWindowItems: contextItems.length,
    updatedAt: store?.updatedAt || contextItems.at(-1)?.receivedAt || null
  };
}

function sanitizeStringList(value, limit = 5) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normaliseWhitespace(item))
    .filter(Boolean)
    .slice(0, limit);
}

function validateModelPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Model payload was not an object');
  }

  const topic = normaliseWhitespace(payload.topic);
  const summary = normaliseWhitespace(payload.summary);

  if (!topic) {
    throw new Error('Model payload was missing topic');
  }

  if (!summary) {
    throw new Error('Model payload was missing summary');
  }

  return {
    topic,
    summary,
    concepts: sanitizeStringList(payload.concepts),
    questions: sanitizeStringList(payload.questions),
    actionItems: sanitizeStringList(payload.actionItems),
    decisions: sanitizeStringList(payload.decisions)
  };
}

function buildTranscriptPrompt(items) {
  const transcript = items
    .map((item, index) => {
      const speaker = normaliseWhitespace(item?.speaker || 'Unknown');
      const text = normaliseWhitespace(item?.text || '');
      return `${index + 1}. ${speaker}: ${text}`;
    })
    .join('\n');

  return [
    '/no_think',
    'Return JSON only with this exact shape:',
    '{"topic":"string","summary":"string","concepts":["string"],"questions":["string"],"actionItems":["string"],"decisions":["string"]}',
    'Rules:',
    '- Keep topic short and specific.',
    '- Summary must be exactly 1 sentence.',
    '- Arrays must contain short strings only.',
    '- Use empty arrays when unsure.',
    '- Do not invent facts not grounded in the transcript.',
    '- If the transcript is fragmentary, say that briefly in the summary.',
    '- Maximum 4 concepts, 3 questions, 3 actionItems, 3 decisions.',
    '',
    'Transcript:',
    transcript
  ].join('\n');
}

async function generateOllamaContext(store, options = {}) {
  const model = options.ollamaModel || DEFAULT_OLLAMA_MODEL;
  const ollamaUrl = options.ollamaUrl || DEFAULT_OLLAMA_URL;
  const ollamaTimeoutMs = Number(options.ollamaTimeoutMs || DEFAULT_OLLAMA_TIMEOUT_MS);
  const ollamaKeepAlive = options.ollamaKeepAlive || DEFAULT_OLLAMA_KEEP_ALIVE;
  const { items, contextItems } = getContextWindowItems(store, options.contextWindowItems);

  if (items.length === 0) {
    return buildEmptyContext(store, `ollama:${model}`);
  }

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    signal: AbortSignal.timeout(ollamaTimeoutMs),
    body: JSON.stringify({
      model,
      prompt: buildTranscriptPrompt(contextItems),
      stream: false,
      format: 'json',
      keep_alive: ollamaKeepAlive,
      options: {
        temperature: 0,
        top_p: 0.9,
        num_predict: 140,
        num_ctx: 2048
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed with status ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const rawContent = payload?.response;

  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new Error('Ollama response did not include output text');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Ollama response was not valid JSON');
  }

  const validated = validateModelPayload(parsed);
  const latestUtterance = normaliseWhitespace(contextItems.at(-1)?.text || '');

  return {
    available: true,
    source: `ollama:${model}`,
    provider: 'ollama',
    ...validated,
    latestUtterance,
    itemCount: items.length,
    contextWindowItems: contextItems.length,
    updatedAt: store?.updatedAt || contextItems.at(-1)?.receivedAt || null
  };
}

async function generateOpenAIContext(store, options = {}) {
  const apiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
  const baseUrl = options.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL;
  const model = options.openaiModel || DEFAULT_OPENAI_MODEL;
  const timeoutMs = Number(options.openaiTimeoutMs || DEFAULT_OPENAI_TIMEOUT_MS);
  const { items, contextItems } = getContextWindowItems(store, options.contextWindowItems);

  if (items.length === 0) {
    return buildEmptyContext(store, `openai:${model}`);
  }

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'conversation_context',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              topic: { type: 'string' },
              summary: { type: 'string' },
              concepts: { type: 'array', items: { type: 'string' } },
              questions: { type: 'array', items: { type: 'string' } },
              actionItems: { type: 'array', items: { type: 'string' } },
              decisions: { type: 'array', items: { type: 'string' } }
            },
            required: ['topic', 'summary', 'concepts', 'questions', 'actionItems', 'decisions']
          }
        }
      },
      messages: [
        {
          role: 'system',
          content: 'You generate structured conversation understanding for a local-first study/tutoring assistant. Return cautious, concise grounded output only.'
        },
        {
          role: 'user',
          content: buildTranscriptPrompt(contextItems).replace('/no_think\n', '')
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed with status ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const rawContent = payload?.choices?.[0]?.message?.content;

  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new Error('OpenAI response did not include message content');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('OpenAI response was not valid JSON');
  }

  const validated = validateModelPayload(parsed);
  const latestUtterance = normaliseWhitespace(contextItems.at(-1)?.text || '');

  return {
    available: true,
    source: `openai:${model}`,
    provider: 'openai',
    ...validated,
    latestUtterance,
    itemCount: items.length,
    contextWindowItems: contextItems.length,
    updatedAt: store?.updatedAt || contextItems.at(-1)?.receivedAt || null
  };
}

const providerMap = {
  heuristic: async (store, options) => buildHeuristicContext(store, {
    ...options,
    source: 'heuristic fallback'
  }),
  ollama: generateOllamaContext,
  openai: generateOpenAIContext
};

const contextCache = new Map();
const inflightContext = new Map();

function buildCacheKey(store, options, providerName) {
  const model = providerName === 'openai'
    ? (options.openaiModel || DEFAULT_OPENAI_MODEL)
    : (options.ollamaModel || DEFAULT_OLLAMA_MODEL);

  return JSON.stringify({
    providerName,
    model,
    updatedAt: store?.updatedAt || null,
    itemCount: Array.isArray(store?.items) ? store.items.length : 0,
    contextWindowItems: Number(options.contextWindowItems || DEFAULT_CONTEXT_WINDOW_ITEMS)
  });
}

export async function buildContextUnderstanding(store, options = {}) {
  const providerName = options.provider || DEFAULT_CONTEXT_PROVIDER;
  const provider = providerMap[providerName];

  if (!provider) {
    return buildHeuristicContext(store, {
      ...options,
      source: `heuristic fallback (unknown provider: ${providerName})`
    });
  }

  const cacheKey = buildCacheKey(store, options, providerName);
  const ttlMs = Number(options.cacheTtlMs || DEFAULT_CONTEXT_CACHE_TTL_MS);
  const cached = contextCache.get(cacheKey);

  if (cached && (Date.now() - cached.createdAt) < ttlMs) {
    return cached.value;
  }

  if (inflightContext.has(cacheKey)) {
    return inflightContext.get(cacheKey);
  }

  const work = (async () => {
    try {
      const value = await provider(store, options);
      contextCache.set(cacheKey, {
        createdAt: Date.now(),
        value
      });
      return value;
    } catch (error) {
      const suffix = error instanceof Error ? `: ${error.message}` : '';
      const fallback = buildHeuristicContext(store, {
        ...options,
        source: `heuristic fallback after ${providerName}${suffix}`
      });
      contextCache.set(cacheKey, {
        createdAt: Date.now(),
        value: fallback
      });
      return fallback;
    } finally {
      inflightContext.delete(cacheKey);
    }
  })();

  inflightContext.set(cacheKey, work);
  return work;
}

export { buildHeuristicContext, DEFAULT_CONTEXT_PROVIDER, DEFAULT_OLLAMA_MODEL, DEFAULT_CONTEXT_WINDOW_ITEMS };
