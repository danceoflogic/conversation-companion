import { normalizeSessionPayload } from './session-model.js';

const FALLBACK_SESSION_PAYLOAD = {
  session: {
    id: 'session-error',
    mode: 'study',
    title: 'Session unavailable',
    status: 'error',
    latencyMs: 0,
    providerMode: 'mock'
  },
  summary: 'The session could not be loaded.',
  topic: 'Load error',
  concepts: [],
  timeline: [],
  widgets: []
};

const CONTEXT_WINDOW_ITEMS = 20;
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'had', 'has', 'have',
  'he', 'her', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me',
  'my', 'of', 'on', 'or', 'our', 'she', 'so', 'that', 'the', 'their', 'them', 'there', 'they',
  'this', 'to', 'up', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why',
  'will', 'with', 'you', 'your'
]);

function getFixtureParam() {
  const params = new URLSearchParams(globalThis.location?.search || '');
  return params.get('fixture');
}

async function fetchJson(url, failureLabel) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${failureLabel} failed with status ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`${failureLabel} was not valid JSON`);
  }
}

function formatTranscriptTime(item, index) {
  if (typeof item?.time === 'string' && item.time.trim()) {
    return item.time.trim();
  }

  if (typeof item?.receivedAt === 'string' && item.receivedAt.trim()) {
    const date = new Date(item.receivedAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  return `Item ${index + 1}`;
}

function mapTranscriptItemsToTimeline(items) {
  return items.map((item, index) => ({
    id: item?.id ?? `ingested-${index + 1}`,
    time: formatTranscriptTime(item, index),
    speaker: item?.speaker?.trim() || 'Unknown',
    text: item?.text?.trim() || '',
    summary: item?.source ? `Ingested from ${item.source}` : item?.text?.trim() || '',
    widgets: []
  }));
}

function normaliseWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function toTitleCase(text) {
  return text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function collectKeywordCounts(items) {
  const counts = new Map();

  for (const item of items) {
    const words = normaliseWhitespace(item?.text)
      .toLowerCase()
      .match(/[a-z][a-z'-]{2,}/g) || [];

    for (const word of words) {
      if (STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function buildKeywordTopic(items) {
  const topWords = collectKeywordCounts(items)
    .slice(0, 3)
    .map(([word]) => toTitleCase(word));

  if (!topWords.length) {
    return 'Live Transcript';
  }

  return topWords.join(' · ');
}

function buildTranscriptContextUnderstanding(transcriptStore, baseSession) {
  const items = Array.isArray(transcriptStore?.items)
    ? transcriptStore.items.filter((item) => typeof item?.text === 'string' && item.text.trim())
    : [];

  if (items.length === 0) {
    return {
      available: false,
      source: 'session fallback',
      topic: baseSession?.topic || 'Live Transcript',
      summary: baseSession?.summary || 'Waiting for transcript context.',
      latestUtterance: '',
      concepts: [],
      questions: [],
      actionItems: [],
      decisions: [],
      itemCount: 0,
      contextWindowItems: 0,
      updatedAt: transcriptStore?.updatedAt || baseSession?.session?.updatedAt || null
    };
  }

  const contextItems = items.slice(-CONTEXT_WINDOW_ITEMS);
  const recentText = contextItems
    .map((item) => normaliseWhitespace(item.text))
    .filter(Boolean)
    .join(' ');
  const latestUtterance = normaliseWhitespace(contextItems.at(-1)?.text || '');

  const summary = recentText
    ? `Recent discussion: ${recentText}`
    : `Displaying ${items.length} ingested transcript item${items.length === 1 ? '' : 's'} from /api/transcript-ingestion.`;

  return {
    available: true,
    source: 'transcript fallback',
    topic: buildKeywordTopic(contextItems),
    summary,
    latestUtterance,
    concepts: collectKeywordCounts(contextItems)
      .slice(0, 5)
      .map(([word]) => toTitleCase(word)),
    questions: contextItems
      .map((item) => normaliseWhitespace(item?.text))
      .filter((text) => text.includes('?'))
      .slice(-3),
    actionItems: [],
    decisions: [],
    itemCount: items.length,
    contextWindowItems: contextItems.length,
    updatedAt: transcriptStore?.updatedAt || contextItems.at(-1)?.receivedAt || null
  };
}

function buildContextWidgets(contextUnderstanding, baseWidgets = []) {
  const widgets = Array.isArray(baseWidgets) ? [...baseWidgets] : [];

  if (Array.isArray(contextUnderstanding?.decisions) && contextUnderstanding.decisions.length) {
    widgets.unshift({
      type: 'decisions',
      title: 'Decisions',
      items: contextUnderstanding.decisions.slice(0, 5)
    });
  }

  if (Array.isArray(contextUnderstanding?.actionItems) && contextUnderstanding.actionItems.length) {
    widgets.unshift({
      type: 'action_items',
      title: 'Action Items',
      items: contextUnderstanding.actionItems.slice(0, 5)
    });
  }

  if (Array.isArray(contextUnderstanding?.questions) && contextUnderstanding.questions.length) {
    widgets.unshift({
      type: 'open_questions',
      title: 'Open Questions',
      items: contextUnderstanding.questions.slice(0, 5)
    });
  }

  return widgets;
}

function mergeTranscriptIngestion(baseSession, transcriptStore, contextUnderstanding) {
  const items = Array.isArray(transcriptStore?.items)
    ? transcriptStore.items.filter((item) => typeof item?.text === 'string' && item.text.trim())
    : [];

  if (items.length === 0) {
    const resolvedContext = contextUnderstanding || {
      available: false,
      source: 'session fallback',
      topic: 'Live Transcript',
      summary: 'Waiting for transcript context.',
      latestUtterance: '',
      concepts: [],
      questions: [],
      actionItems: [],
      decisions: [],
      itemCount: 0,
      contextWindowItems: 0,
      updatedAt: transcriptStore?.updatedAt || baseSession?.session?.updatedAt || null
    };

    return {
      ...baseSession,
      session: {
        ...baseSession.session,
        id: transcriptStore?.sessionId || baseSession?.session?.id || 'live-session',
        title: 'Live Transcript (0 items)',
        updatedAt: transcriptStore?.updatedAt || baseSession?.session?.updatedAt || null,
        status: 'idle',
        providerMode: transcriptStore?.providerMode || 'live',
        latencyMs: 0
      },
      topic: 'Live Transcript',
      summary: 'Waiting for transcript context.',
      concepts: [],
      timeline: [],
      widgets: [],
      contextUnderstanding: resolvedContext
    };
  }

  const timeline = mapTranscriptItemsToTimeline(items);
  const providerMode = transcriptStore?.providerMode || 'live';
  const sessionId = transcriptStore?.sessionId || baseSession?.session?.id || 'live-session';
  const updatedAt = transcriptStore?.updatedAt || baseSession?.session?.updatedAt || null;
  const resolvedContext = contextUnderstanding || buildTranscriptContextUnderstanding(transcriptStore, baseSession);

  const mergedContext = {
    ...resolvedContext,
    latestUtterance: resolvedContext.latestUtterance || normaliseWhitespace(items.at(-1)?.text || ''),
    itemCount: resolvedContext.itemCount ?? items.length,
    contextWindowItems: resolvedContext.contextWindowItems ?? Math.min(items.length, CONTEXT_WINDOW_ITEMS),
    updatedAt: resolvedContext.updatedAt || updatedAt
  };

  return {
    ...baseSession,
    session: {
      ...baseSession.session,
      id: sessionId,
      title: `Live Transcript (${items.length} item${items.length === 1 ? '' : 's'})`,
      updatedAt,
      status: 'listening',
      providerMode,
      latencyMs: 0
    },
    topic: mergedContext.topic || baseSession?.topic || 'Live Transcript',
    summary: mergedContext.summary || `Displaying ${items.length} ingested transcript item${items.length === 1 ? '' : 's'} from /api/transcript-ingestion.`,
    timeline,
    widgets: buildContextWidgets(mergedContext),
    contextUnderstanding: mergedContext
  };
}

async function fetchContextUnderstanding() {
  return fetchJson('/api/context-understanding', 'Context understanding request');
}

export async function fetchSessionPayload() {
  const fixture = getFixtureParam();

  if (fixture) {
    const fixtureSession = await fetchJson(`/api/mock-session?fixture=${encodeURIComponent(fixture)}`, 'Session request');
    return {
      ...fixtureSession,
      contextUnderstanding: {
        available: true,
        source: 'fixture session',
        topic: fixtureSession?.topic || 'Unknown topic',
        summary: fixtureSession?.summary || '',
        latestUtterance: Array.isArray(fixtureSession?.timeline) && fixtureSession.timeline.length
          ? fixtureSession.timeline[fixtureSession.timeline.length - 1]?.text || ''
          : '',
        concepts: Array.isArray(fixtureSession?.concepts) ? fixtureSession.concepts : [],
        questions: [],
        actionItems: [],
        decisions: [],
        itemCount: Array.isArray(fixtureSession?.timeline) ? fixtureSession.timeline.length : 0,
        contextWindowItems: Math.min(Array.isArray(fixtureSession?.timeline) ? fixtureSession.timeline.length : 0, CONTEXT_WINDOW_ITEMS),
        updatedAt: fixtureSession?.session?.updatedAt || null
      }
    };
  }

  const baseSession = await fetchJson('/api/mock-session', 'Session request');

  try {
    const transcriptStore = await fetchJson('/api/transcript-ingestion', 'Transcript ingestion request');
    const fallbackContext = buildTranscriptContextUnderstanding(transcriptStore, baseSession);

    try {
      const endpointContext = await fetchContextUnderstanding();
      return mergeTranscriptIngestion(baseSession, transcriptStore, {
        ...fallbackContext,
        ...endpointContext,
        source: endpointContext?.source || 'local endpoint'
      });
    } catch {
      return mergeTranscriptIngestion(baseSession, transcriptStore, fallbackContext);
    }
  } catch {
    return {
      ...baseSession,
      contextUnderstanding: {
        available: true,
        source: 'session fallback',
        topic: baseSession?.topic || 'Unknown topic',
        summary: baseSession?.summary || '',
        latestUtterance: Array.isArray(baseSession?.timeline) && baseSession.timeline.length
          ? baseSession.timeline[baseSession.timeline.length - 1]?.text || ''
          : '',
        concepts: Array.isArray(baseSession?.concepts) ? baseSession.concepts : [],
        questions: [],
        actionItems: [],
        decisions: [],
        itemCount: Array.isArray(baseSession?.timeline) ? baseSession.timeline.length : 0,
        contextWindowItems: Math.min(Array.isArray(baseSession?.timeline) ? baseSession.timeline.length : 0, CONTEXT_WINDOW_ITEMS),
        updatedAt: baseSession?.session?.updatedAt || null
      }
    };
  }
}

export function validateSessionPayload(data) {
  const issues = [];

  if (!data || typeof data !== 'object') {
    issues.push('Payload is not an object.');
    return issues;
  }

  if (!data.session || typeof data.session !== 'object') {
    issues.push('Missing session metadata.');
  }

  if (!Array.isArray(data.timeline)) {
    issues.push('Timeline must be an array.');
  }

  if (!Array.isArray(data.widgets)) {
    issues.push('Widgets must be an array.');
  }

  if (!Array.isArray(data.concepts)) {
    issues.push('Concepts must be an array.');
  }

  return issues;
}

export async function loadSession() {
  try {
    const raw = await fetchSessionPayload();
    const issues = validateSessionPayload(raw);
    const normalized = normalizeSessionPayload(raw);
    const session = {
      ...normalized,
      contextUnderstanding: {
        available: Boolean(raw?.contextUnderstanding?.available),
        source: raw?.contextUnderstanding?.source || 'session fallback',
        topic: raw?.contextUnderstanding?.topic || normalized.topic,
        summary: raw?.contextUnderstanding?.summary || normalized.summary,
        latestUtterance: raw?.contextUnderstanding?.latestUtterance || '',
        concepts: Array.isArray(raw?.contextUnderstanding?.concepts) ? raw.contextUnderstanding.concepts : [],
        questions: Array.isArray(raw?.contextUnderstanding?.questions) ? raw.contextUnderstanding.questions : [],
        actionItems: Array.isArray(raw?.contextUnderstanding?.actionItems) ? raw.contextUnderstanding.actionItems : [],
        decisions: Array.isArray(raw?.contextUnderstanding?.decisions) ? raw.contextUnderstanding.decisions : [],
        itemCount: Number(raw?.contextUnderstanding?.itemCount ?? normalized.timeline.length ?? 0),
        contextWindowItems: Number(raw?.contextUnderstanding?.contextWindowItems ?? Math.min(normalized.timeline.length ?? 0, CONTEXT_WINDOW_ITEMS)),
        updatedAt: raw?.contextUnderstanding?.updatedAt || normalized.session.updatedAt || null
      }
    };
    return { raw, session, issues };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown session load failure';
    const raw = {
      ...FALLBACK_SESSION_PAYLOAD,
      summary: `${FALLBACK_SESSION_PAYLOAD.summary} ${message}`,
      contextUnderstanding: {
        available: false,
        source: 'load failure fallback',
        topic: FALLBACK_SESSION_PAYLOAD.topic,
        summary: `${FALLBACK_SESSION_PAYLOAD.summary} ${message}`,
        latestUtterance: '',
        concepts: [],
        questions: [],
        actionItems: [],
        decisions: [],
        itemCount: 0,
        contextWindowItems: 0,
        updatedAt: null
      }
    };
    return {
      raw,
      session: {
        ...normalizeSessionPayload(raw),
        contextUnderstanding: raw.contextUnderstanding
      },
      issues: [message]
    };
  }
}
