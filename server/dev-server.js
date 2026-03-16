import './load-env.js';
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { buildContextUnderstanding } from './context-engine.js';

const root = new URL('../app/', import.meta.url);
const projectRoot = new URL('..', import.meta.url);
const transcriptIngestionPath = new URL('../data/local-transcript-ingestion.json', import.meta.url);
const port = process.env.PORT || 3088;
const execFileAsync = promisify(execFile);
const DEFAULT_CAPTURE_DURATION = String(process.env.CAPTURE_DURATION || '12');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function createEmptyTranscriptStore() {
  return {
    sessionId: 'local-placeholder',
    providerMode: 'placeholder',
    updatedAt: null,
    items: []
  };
}

const liveCaptureState = {
  running: false,
  status: 'idle',
  message: 'Capture idle.',
  pid: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  signal: null,
  stdout: '',
  stderr: '',
  phase: 'idle',
  audioFile: null,
  recordingPid: null,
  processingPid: null,
  stopRequested: false,
  loopEnabled: false,
  chunkIndex: 0,
  lastCompletedChunkAt: null
};

function getLiveCaptureStatus() {
  return {
    running: liveCaptureState.running,
    status: liveCaptureState.status,
    message: liveCaptureState.message,
    pid: liveCaptureState.pid,
    startedAt: liveCaptureState.startedAt,
    finishedAt: liveCaptureState.finishedAt,
    exitCode: liveCaptureState.exitCode,
    signal: liveCaptureState.signal,
    stderr: liveCaptureState.stderr,
    phase: liveCaptureState.phase,
    stopRequested: liveCaptureState.stopRequested,
    loopEnabled: liveCaptureState.loopEnabled,
    chunkIndex: liveCaptureState.chunkIndex,
    lastCompletedChunkAt: liveCaptureState.lastCompletedChunkAt
  };
}

function resetLiveCaptureStreams() {
  liveCaptureState.stdout = '';
  liveCaptureState.stderr = '';
}

function buildChunkAudioPath() {
  return `captures/ingest-run/live-capture-${Date.now()}.wav`;
}

function updateCaptureStatus(status, phase, message) {
  liveCaptureState.status = status;
  liveCaptureState.phase = phase;
  liveCaptureState.message = message;
}

function attachChildOutput(child, phase) {
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    liveCaptureState.stdout += text;

    if (phase === 'processing') {
      if (text.includes('Transcribing audio with whisper.cpp...')) {
        updateCaptureStatus('transcribing', 'transcribing', 'Transcribing audio with whisper.cpp…');
      } else if (text.includes('Transcribing audio with python-whisper...')) {
        updateCaptureStatus('transcribing', 'transcribing', 'Transcribing audio…');
      }

      if (text.includes('Ingesting transcript...')) {
        updateCaptureStatus('ingesting', 'ingesting', 'Ingesting transcript…');
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    liveCaptureState.stderr += chunk.toString();
  });
}

function finishLiveCapture(status, message, extras = {}) {
  liveCaptureState.running = false;
  liveCaptureState.status = status;
  liveCaptureState.phase = status;
  liveCaptureState.message = message;
  liveCaptureState.pid = null;
  liveCaptureState.recordingPid = null;
  liveCaptureState.processingPid = null;
  liveCaptureState.finishedAt = new Date().toISOString();
  liveCaptureState.stopRequested = false;
  liveCaptureState.loopEnabled = false;
  Object.assign(liveCaptureState, extras);
}

function startRecordingCycle() {
  const audioFile = buildChunkAudioPath();
  const child = spawn('./scripts/capture-audio-sample.sh', [DEFAULT_CAPTURE_DURATION, audioFile], {
    cwd: projectRoot.pathname,
    env: {
      ...process.env,
      CAPTURE_DURATION: DEFAULT_CAPTURE_DURATION
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  liveCaptureState.running = true;
  liveCaptureState.chunkIndex += 1;
  updateCaptureStatus('listening', 'listening', `Recording chunk ${liveCaptureState.chunkIndex}…`);
  liveCaptureState.pid = child.pid;
  liveCaptureState.recordingPid = child.pid;
  liveCaptureState.processingPid = null;
  liveCaptureState.audioFile = audioFile;
  liveCaptureState.exitCode = null;
  liveCaptureState.signal = null;
  liveCaptureState.finishedAt = null;
  liveCaptureState.stopRequested = false;
  resetLiveCaptureStreams();

  attachChildOutput(child, 'recording');

  child.on('error', (error) => {
    finishLiveCapture('error', `Capture failed to start: ${error.message}`, {
      stderr: `${liveCaptureState.stderr}${error.message}`.trim(),
      audioFile
    });
  });

  child.on('close', (code, signal) => {
    liveCaptureState.exitCode = code;
    liveCaptureState.signal = signal;
    liveCaptureState.recordingPid = null;

    if (code === 0 || code === 1 || code === 130 || code === 143) {
      updateCaptureStatus(
        'transcribing',
        'transcribing',
        liveCaptureState.stopRequested
          ? `Chunk ${liveCaptureState.chunkIndex} saved. Transcribing…`
          : `Chunk ${liveCaptureState.chunkIndex} recorded. Transcribing…`
      );
      startPostProcessing(audioFile);
      return;
    }

    const rawError = liveCaptureState.stderr.trim() || `Capture failed with exit code ${code}`;
    finishLiveCapture('error', buildCaptureErrorMessage(rawError), {
      stderr: rawError,
      audioFile
    });
  });
}

function startPostProcessing(audioFile) {
  const child = spawn('./scripts/capture-transcribe-ingest.sh', [audioFile], {
    cwd: projectRoot.pathname,
    env: {
      ...process.env,
      BASE_URL: `http://127.0.0.1:${port}`,
      CAPTURE_DURATION: DEFAULT_CAPTURE_DURATION
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  liveCaptureState.running = true;
  updateCaptureStatus('transcribing', 'transcribing', `Transcribing chunk ${liveCaptureState.chunkIndex}…`);
  liveCaptureState.pid = child.pid;
  liveCaptureState.processingPid = child.pid;
  liveCaptureState.exitCode = null;
  liveCaptureState.signal = null;

  attachChildOutput(child, 'processing');

  child.on('error', (error) => {
    finishLiveCapture('error', `Post-processing failed to start: ${error.message}`, {
      stderr: `${liveCaptureState.stderr}${error.message}`.trim(),
      audioFile
    });
  });

  child.on('close', (code, signal) => {
    liveCaptureState.exitCode = code;
    liveCaptureState.signal = signal;
    liveCaptureState.processingPid = null;

    if (signal === 'SIGTERM') {
      finishLiveCapture('stopped', 'Capture processing stopped.', { audioFile });
      return;
    }

    if (code === 0) {
      liveCaptureState.lastCompletedChunkAt = new Date().toISOString();
      const skippedSilence = liveCaptureState.stdout.includes('Skipping ingest due to low speech activity:');

      if (liveCaptureState.loopEnabled) {
        updateCaptureStatus(
          'listening',
          'listening',
          skippedSilence
            ? `Chunk ${liveCaptureState.chunkIndex} was silent. Waiting for the next chunk…`
            : `Chunk ${liveCaptureState.chunkIndex} ingested. Starting next chunk…`
        );
        startRecordingCycle();
        return;
      }

      finishLiveCapture(
        'completed',
        skippedSilence
          ? `Chunk ${liveCaptureState.chunkIndex} was skipped because it was mostly silence.`
          : `Chunk ${liveCaptureState.chunkIndex} ingested successfully.`,
        { audioFile }
      );
      return;
    }

    finishLiveCapture('error', liveCaptureState.stderr.trim() || `Post-processing failed with exit code ${code}`, {
      audioFile
    });
  });
}

function startLiveCapture() {
  if (liveCaptureState.running) {
    return {
      ok: false,
      statusCode: 409,
      body: {
        error: 'Live capture is already running.',
        capture: getLiveCaptureStatus()
      }
    };
  }

  liveCaptureState.loopEnabled = true;
  liveCaptureState.startedAt = new Date().toISOString();
  liveCaptureState.finishedAt = null;
  liveCaptureState.chunkIndex = 0;
  liveCaptureState.lastCompletedChunkAt = null;
  startRecordingCycle();

  return {
    ok: true,
    statusCode: 202,
    body: {
      ok: true,
      capture: getLiveCaptureStatus()
    }
  };
}

function stopLiveCapture() {
  if (!liveCaptureState.running) {
    return {
      ok: false,
      statusCode: 409,
      body: {
        error: 'Live capture is not running.',
        capture: getLiveCaptureStatus()
      }
    };
  }

  liveCaptureState.loopEnabled = false;

  if (liveCaptureState.phase === 'listening' && liveCaptureState.recordingPid) {
    try {
      process.kill(liveCaptureState.recordingPid, 'SIGINT');
      liveCaptureState.stopRequested = true;
      updateCaptureStatus('stopping', 'stopping', 'Stopping current recording and finishing this chunk…');
      return {
        ok: true,
        statusCode: 202,
        body: {
          ok: true,
          capture: getLiveCaptureStatus()
        }
      };
    } catch (error) {
      finishLiveCapture('error', `Failed to stop capture: ${error.message}`, {
        audioFile: liveCaptureState.audioFile
      });
      return {
        ok: false,
        statusCode: 500,
        body: {
          error: liveCaptureState.message,
          capture: getLiveCaptureStatus()
        }
      };
    }
  }

  updateCaptureStatus('stopping', 'stopping', 'Finishing the current transcription/ingest cycle, then stopping…');
  return {
    ok: true,
    statusCode: 202,
    body: {
      ok: true,
      capture: getLiveCaptureStatus()
    }
  };
}

async function ensureTranscriptStore() {
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });

  try {
    const raw = await readFile(transcriptIngestionPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;

    const initial = createEmptyTranscriptStore();
    await writeFile(transcriptIngestionPath, `${JSON.stringify(initial, null, 2)}\n`, 'utf8');
    return initial;
  }
}

async function appendTranscriptItem(payload) {
  const store = await ensureTranscriptStore();
  const timestamp = new Date().toISOString();
  const item = {
    id: payload.id || `ingest-${Date.now()}`,
    time: payload.time || null,
    speaker: payload.speaker || 'Unknown',
    text: payload.text,
    source: payload.source || 'local-placeholder',
    receivedAt: timestamp
  };

  const nextStore = {
    ...store,
    updatedAt: timestamp,
    items: [...(Array.isArray(store.items) ? store.items : []), item]
  };

  await writeFile(transcriptIngestionPath, `${JSON.stringify(nextStore, null, 2)}\n`, 'utf8');
  return { store: nextStore, item };
}

async function resetTranscriptStore() {
  const nextStore = createEmptyTranscriptStore();
  await writeFile(transcriptIngestionPath, `${JSON.stringify(nextStore, null, 2)}\n`, 'utf8');
  return nextStore;
}

async function buildConceptFocusPayload(concept, mode = 'found') {
  const safeConcept = String(concept || '').trim();
  if (!safeConcept) {
    throw new Error('Concept is required');
  }

  const store = await ensureTranscriptStore();
  const context = await buildContextUnderstanding(store);
  const topic = context?.topic || 'Current discussion';
  const summary = context?.summary || '';
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const isOverviewLike = safeConcept.toLowerCase() === 'context overview' || safeConcept.toLowerCase() === String(topic).trim().toLowerCase();
  const broadConceptHints = new Set([
    'overview', 'context', 'summary', 'discussion', 'session', 'topic', 'conversation', 'notes', 'study', 'learning'
  ]);
  const conceptTokens = (safeConcept.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []);
  const isBroadConcept = isOverviewLike
    || (conceptTokens.length > 0 && conceptTokens.every((token) => broadConceptHints.has(token)));
  const relatedConcepts = Array.isArray(context?.concepts)
    ? context.concepts
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item) => item.toLowerCase() !== safeConcept.toLowerCase())
    : [];
  let conceptSummary = `${safeConcept} is relevant to ${topic}.`;
  let searchTerms = [safeConcept, topic, ...relatedConcepts.slice(0, 2)].filter(Boolean);

  if (apiKey) {
    try {
      const response = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'concept_focus',
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  summary: { type: 'string' },
                  searchTerms: { type: 'array', items: { type: 'string' } }
                },
                required: ['summary', 'searchTerms']
              }
            }
          },
          messages: [
            {
              role: 'system',
              content: 'You create concise concept focus briefs and search terms for a learning companion. Stay grounded in the provided topic and summary.'
            },
            {
              role: 'user',
              content: `Topic: ${topic}\nConversation summary: ${summary}\nConcept: ${safeConcept}\nReturn a short explanation of the concept in the current discussion and 3-5 search terms for helpful images.`
            }
          ]
        })
      });

      if (response.ok) {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed?.summary) conceptSummary = parsed.summary;
          if (Array.isArray(parsed?.searchTerms) && parsed.searchTerms.length) {
            searchTerms = parsed.searchTerms.map((term) => String(term || '').trim()).filter(Boolean);
          }
        }
      }
    } catch {}
  }

  if (mode === 'generated') {
    const prompt = encodeURIComponent(`${topic}, ${safeConcept}, educational visual explanation, clean informative illustration`);
    return {
      concept: safeConcept,
      topic,
      mode,
      summary: conceptSummary,
      images: [0, 1, 2].map((index) => ({
        url: `https://image.pollinations.ai/prompt/${prompt}?seed=${index + 1}&width=768&height=512&model=flux`,
        title: `${safeConcept} generated view ${index + 1}`,
        source: 'AI generated'
      }))
    };
  }

  if (isBroadConcept) {
    return {
      concept: safeConcept,
      topic,
      mode,
      summary: `${conceptSummary} This concept is broad, so this view is text-first to avoid low-quality image matches.`,
      images: [],
      textFirst: true
    };
  }

  function uniqueTerms(terms) {
    const seen = new Set();
    const values = [];

    for (const term of terms) {
      const cleaned = String(term || '').trim();
      const key = cleaned.toLowerCase();
      if (!cleaned || seen.has(key)) continue;
      seen.add(key);
      values.push(cleaned);
    }

    return values;
  }

  const conceptKeywords = uniqueTerms(safeConcept.match(/[A-Za-z][A-Za-z'-]{2,}/g) || []);

  function scoreImageResult(image) {
    const haystack = `${image.title || ''} ${image.source || ''}`.toLowerCase();
    let score = 0;

    if (haystack.includes(safeConcept.toLowerCase())) score += 8;
    if (haystack.includes(String(topic).toLowerCase())) score += 3;
    for (const keyword of conceptKeywords) {
      if (haystack.includes(String(keyword).toLowerCase())) score += 4;
    }
    for (const term of searchTerms) {
      if (haystack.includes(String(term).toLowerCase())) score += 1;
    }

    return score;
  }

  async function fetchWikipediaImages(terms) {
    const cleanedTerms = uniqueTerms(terms);
    const candidateQueries = uniqueTerms([
      safeConcept,
      conceptKeywords.join(' '),
      ...conceptKeywords,
      cleanedTerms.join(' '),
      ...cleanedTerms,
      cleanedTerms.slice(0, 2).join(' '),
      isOverviewLike ? topic : ''
    ]).filter(Boolean);
    const collected = [];
    const seenUrls = new Set();
    const minScore = isOverviewLike ? 0 : 4;

    for (const candidateQuery of candidateQueries) {
      const query = encodeURIComponent(candidateQuery);
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${query}&gsrlimit=8&prop=pageimages|info&piprop=thumbnail|original&pithumbsize=640&inprop=url`;
      const response = await fetch(wikiUrl);
      if (!response.ok) continue;
      const payload = await response.json();
      const pages = Object.values(payload?.query?.pages || {});
      const images = pages
        .map((page) => ({
          url: page?.original?.source || page?.thumbnail?.source,
          title: page?.title || safeConcept,
          source: page?.fullurl || 'Wikipedia'
        }))
        .filter((item) => item.url)
        .map((item) => ({ ...item, _score: scoreImageResult(item) }))
        .filter((item) => item._score >= minScore)
        .sort((left, right) => right._score - left._score);

      for (const image of images) {
        if (seenUrls.has(image.url)) continue;
        seenUrls.add(image.url);
        collected.push({
          url: image.url,
          title: image.title,
          source: image.source
        });
        if (collected.length >= 6) {
          return collected;
        }
      }
    }

    return collected;
  }

  let images = [];
  try {
    images = await fetchWikipediaImages(searchTerms);
  } catch {}

  if (images.length < 3 && relatedConcepts.length) {
    const fallbackTerms = isOverviewLike
      ? [topic, ...relatedConcepts.slice(0, 4)]
      : [safeConcept, ...relatedConcepts.slice(0, 3), topic];
    try {
      const fallbackImages = await fetchWikipediaImages(fallbackTerms);
      const seen = new Set(images.map((image) => image.url));
      for (const image of fallbackImages) {
        if (!seen.has(image.url)) {
          images.push(image);
          seen.add(image.url);
        }
      }
    } catch {}
  }

  images = images.slice(0, 6);

  return {
    concept: safeConcept,
    topic,
    mode,
    summary: conceptSummary,
    images,
    textFirst: images.length === 0
  };
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': types['.json'] });
  res.end(JSON.stringify(body, null, 2));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}


function buildCaptureErrorMessage(rawMessage) {
  const text = String(rawMessage || '').trim();

  if (!text) {
    return 'Capture failed. Check local audio/transcription dependencies.';
  }

  if (text.includes('Missing required command: pactl')) {
    return 'Capture failed: missing PulseAudio tooling (pactl). Install audio capture dependencies or use manual transcript ingestion.';
  }

  if (text.includes('Audio file missing or empty')) {
    return 'Capture failed: no usable audio was recorded. Check microphone source/device settings.';
  }

  if (text.includes('OPENAI_API_KEY')) {
    return 'Context provider key is missing. Set OPENAI_API_KEY or switch CONTEXT_PROVIDER=heuristic.';
  }

  return text;
}

function cleanupLiveCaptureOnExit() {
  const targets = [liveCaptureState.recordingPid, liveCaptureState.processingPid].filter(Boolean);

  for (const pid of targets) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {}
  }
}

process.on('SIGINT', cleanupLiveCaptureOnExit);
process.on('SIGTERM', cleanupLiveCaptureOnExit);
process.on('exit', cleanupLiveCaptureOnExit);

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);
    let path = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    path = normalize(path).replace(/^\.+/, '');

    if (path === '/api/mock-session') {
      const requestedFixture = requestUrl.searchParams.get('fixture');
      const fixtureMap = {
        invalid: '../data/mock-session-invalid.json',
        geometry: '../data/mock-session-geometry.json'
      };
      const fixture = fixtureMap[requestedFixture] || '../data/mock-session.json';
      const body = await readFile(new URL(fixture, import.meta.url));
      res.writeHead(200, {
        'content-type': types['.json'],
        'cache-control': 'no-store'
      });
      res.end(body);
      return;
    }

    if (path === '/api/progress-feed') {
      await execFileAsync('node', ['scripts/generate-progress-feed.js'], {
        cwd: projectRoot.pathname
      });
      const body = await readFile(new URL('../data/progress-feed.json', import.meta.url));
      res.writeHead(200, {
        'content-type': types['.json'],
        'cache-control': 'no-store'
      });
      res.end(body);
      return;
    }

    if (path === '/api/transcript-ingestion' && req.method === 'GET') {
      const store = await ensureTranscriptStore();
      sendJson(res, 200, store);
      return;
    }

    if (path === '/api/transcript-ingestion' && req.method === 'POST') {
      const payload = await readJsonBody(req);

      if (typeof payload.text !== 'string' || !payload.text.trim()) {
        sendJson(res, 400, {
          error: 'Expected a JSON body with a non-empty text field.'
        });
        return;
      }

      const result = await appendTranscriptItem({
        ...payload,
        text: payload.text.trim()
      });

      sendJson(res, 201, {
        ok: true,
        item: result.item,
        totalItems: result.store.items.length,
        storePath: transcriptIngestionPath.pathname
      });
      return;
    }

    if (path === '/api/transcript-ingestion' && req.method === 'DELETE') {
      const store = await resetTranscriptStore();
      sendJson(res, 200, {
        ok: true,
        totalItems: store.items.length,
        storePath: transcriptIngestionPath.pathname
      });
      return;
    }

    if (path === '/api/context-understanding' && req.method === 'GET') {
      const store = await ensureTranscriptStore();
      const understanding = await buildContextUnderstanding(store);
      sendJson(res, 200, understanding);
      return;
    }

    if (path === '/api/concept-focus' && req.method === 'GET') {
      const concept = requestUrl.searchParams.get('concept') || '';
      const mode = requestUrl.searchParams.get('mode') || 'found';
      const payload = await buildConceptFocusPayload(concept, mode);
      sendJson(res, 200, payload);
      return;
    }

    if (path === '/api/live-capture/status' && req.method === 'GET') {
      sendJson(res, 200, getLiveCaptureStatus());
      return;
    }

    if (path === '/api/live-capture/start' && req.method === 'POST') {
      const result = startLiveCapture();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (path === '/api/live-capture/stop' && req.method === 'POST') {
      const result = stopLiveCapture();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (path === '/progress-report.html') {
      const body = await readFile(new URL('../progress-report.html', import.meta.url));
      res.writeHead(200, {
        'content-type': types['.html'],
        'cache-control': 'no-store'
      });
      res.end(body);
      return;
    }

    const filePath = join(root.pathname, path);
    const body = await readFile(filePath);
    const type = types[extname(filePath)] || 'text/plain; charset=utf-8';
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-store'
    });
    res.end(body);
  } catch (error) {
    const statusCode = error?.message === 'Invalid JSON body' || error?.message === 'Request body too large' ? 400 : 404;
    res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Not found\n${error?.message || ''}`);
  }
});

server.listen(port, () => {
  console.log(`Conversation Companion dev server running at http://127.0.0.1:${port}`);
});
