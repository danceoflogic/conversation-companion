import { getVisibleTimeline } from './session-model.js';
import { renderWidget } from './widget-renderers.js';
import { loadSession } from './session-service.js';
import { renderTranscript, renderConcepts, renderContextExplorer } from './renderers.js';

const transcriptEl = document.getElementById('transcript');
const transcriptPanelEl = document.getElementById('transcript-panel');
const transcriptCollapsedPreviewEl = document.getElementById('transcript-collapsed-preview');
const toggleTranscriptBtn = document.getElementById('toggle-transcript');
const summaryEl = document.getElementById('summary');
const topicEl = document.getElementById('topic');
const contextExplorerEl = document.getElementById('context-explorer');
const conceptsEl = document.getElementById('concepts');
const widgetsEl = document.getElementById('widgets');
const statusEl = document.getElementById('session-status');
const providerEl = document.getElementById('provider-mode');
const sessionTitleEl = document.getElementById('session-title');
const latencyEl = document.getElementById('latency');
const validationWarningEl = document.getElementById('validation-warning');
const validationWarningListEl = document.getElementById('validation-warning-list');
const contextTopicEl = document.getElementById('context-topic');
const contextSummaryEl = document.getElementById('context-summary');
const contextLatestUtteranceEl = document.getElementById('context-latest-utterance');
const contextConceptsEl = document.getElementById('context-concepts');
const contextQuestionsEl = document.getElementById('context-questions');
const contextActionItemsEl = document.getElementById('context-action-items');
const contextDecisionsEl = document.getElementById('context-decisions');
const contextSourceEl = document.getElementById('context-source');
const contextMetaEl = document.getElementById('context-meta');
const startListeningBtn = document.getElementById('start-listening');
const stopListeningBtn = document.getElementById('stop-listening');
const clearLiveTranscriptBtn = document.getElementById('clear-live-transcript');
const captureStatusEl = document.getElementById('capture-status');
const conceptPanelEl = document.getElementById('concept-panel');
const conceptPanelHeaderEl = document.getElementById('concept-panel-header');
const conceptPanelTitleEl = document.getElementById('concept-panel-title');
const conceptPanelModeEl = document.getElementById('concept-panel-mode');
const conceptPanelSummaryEl = document.getElementById('concept-panel-summary');
const conceptPanelImagesEl = document.getElementById('concept-panel-images');
const conceptPanelCloseBtn = document.getElementById('concept-panel-close');
const conceptModeFoundBtn = document.getElementById('concept-mode-found');
const conceptModeGeneratedBtn = document.getElementById('concept-mode-generated');

const AUTO_REFRESH_MS = 4000;
const STATUS_POLL_MS = 2000;

let sessionData;
let validationIssues = [];
let autoRefreshTimer;
let statusPollTimer;
let hydrateInFlight = null;
let hydrateQueued = false;
let transcriptCollapsed = false;
let captureState = {
  running: false,
  status: 'idle',
  message: 'Capture idle.',
  lastCompletedChunkAt: null,
  chunkIndex: 0,
  loopEnabled: false
};
let conceptPanelState = {
  concept: null,
  mode: 'found',
  kind: 'concept'
};
let conceptDragState = null;
let lastSeenCompletedChunkAt = null;

function isFixtureMode() {
  const params = new URLSearchParams(globalThis.location?.search || '');
  return Boolean(params.get('fixture'));
}

async function fetchCaptureStatus() {
  const response = await fetch('/api/live-capture/status');
  if (!response.ok) {
    throw new Error(`Capture status request failed with status ${response.status}`);
  }
  captureState = await response.json();
  return captureState;
}

function formatContextMeta(contextUnderstanding) {
  const details = [`${contextUnderstanding.itemCount} item${contextUnderstanding.itemCount === 1 ? '' : 's'}`];

  if (contextUnderstanding.updatedAt) {
    const updatedAt = new Date(contextUnderstanding.updatedAt);
    if (!Number.isNaN(updatedAt.getTime())) {
      details.push(`updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    }
  }

  return details.join(' · ');
}

function formatContextList(items, emptyLabel) {
  if (!Array.isArray(items) || items.length === 0) {
    return emptyLabel;
  }
  return items.join(' · ');
}

function renderCaptureState() {
  const status = captureState?.status || 'idle';
  const message = captureState?.message || 'Capture idle.';
  const detail = captureState?.lastCompletedChunkAt
    ? ` · last completed ${new Date(captureState.lastCompletedChunkAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : '';
  const showStatus = status === 'idle' ? message : `${status.toUpperCase()}: ${message}${detail}`;

  captureStatusEl.textContent = showStatus;
  startListeningBtn.disabled = Boolean(captureState?.running);
  stopListeningBtn.disabled = !Boolean(captureState?.running);
}

function ensureConceptPanelOverlay() {
  conceptPanelEl.hidden = false;
  if (!conceptPanelEl.dataset.positioned) {
    conceptPanelEl.style.top = '90px';
    conceptPanelEl.style.right = '24px';
    conceptPanelEl.style.left = 'auto';
    conceptPanelEl.dataset.positioned = 'true';
  }
}

function renderConceptPanelLoading(concept, mode) {
  ensureConceptPanelOverlay();
  conceptPanelTitleEl.textContent = concept;
  conceptPanelModeEl.textContent = mode === 'generated' ? 'Generated Images' : 'Found by AI';
  conceptPanelSummaryEl.textContent = 'Loading concept visuals…';
  conceptPanelImagesEl.innerHTML = '<p class="muted">Fetching relevant images…</p>';
}

function renderConceptPanel(payload) {
  ensureConceptPanelOverlay();
  conceptPanelTitleEl.textContent = payload.concept;
  conceptPanelModeEl.textContent = payload.mode === 'generated' ? 'Generated Images' : 'Found by AI';
  conceptPanelSummaryEl.textContent = payload.summary || 'No concept summary available yet.';

  if (payload.kind === 'overview') {
    conceptPanelImagesEl.innerHTML = `
      <article class="concept-card concept-card-wide">
        <div class="concept-card-body">
          <p><strong>Topic</strong></p>
          <p>${payload.topic || '—'}</p>
          <p><strong>Summary</strong></p>
          <p>${payload.summary || '—'}</p>
          <p><strong>Concepts</strong></p>
          <p>${(payload.concepts || []).join(' · ') || '—'}</p>
          <p><strong>Open questions</strong></p>
          <p>${(payload.questions || []).join(' · ') || '—'}</p>
          <p><strong>Action items</strong></p>
          <p>${(payload.actionItems || []).join(' · ') || '—'}</p>
          <p><strong>Decisions</strong></p>
          <p>${(payload.decisions || []).join(' · ') || '—'}</p>
        </div>
      </article>
    `;
    return;
  }

  if (!Array.isArray(payload.images) || payload.images.length === 0) {
    conceptPanelImagesEl.innerHTML = '<p class="muted">No images found for this concept yet.</p>';
    return;
  }

  conceptPanelImagesEl.innerHTML = payload.images.map((image) => `
    <article class="concept-card">
      <img src="${image.url}" alt="${image.title || payload.concept}" loading="lazy" />
      <div class="concept-card-body">
        <p><strong>${image.title || payload.concept}</strong></p>
        <p class="muted">${image.source || ''}</p>
      </div>
    </article>
  `).join('');
}

async function openConceptPanel(concept, mode = conceptPanelState.mode || 'found', kind = 'concept') {
  conceptPanelState = { concept, mode, kind };
  renderConceptPanelLoading(concept, mode);

  const response = await fetch(`/api/concept-focus?concept=${encodeURIComponent(concept)}&mode=${encodeURIComponent(mode)}`);
  if (!response.ok) {
    throw new Error(`Concept focus request failed with status ${response.status}`);
  }
  const payload = await response.json();

  if (kind === 'overview') {
    const contextUnderstanding = sessionData?.contextUnderstanding || {};
    renderConceptPanel({
      ...payload,
      kind: 'overview',
      concept: 'Context Overview',
      topic: contextUnderstanding.topic || sessionData?.topic || payload.topic || '—',
      summary: contextUnderstanding.summary || sessionData?.summary || payload.summary || '—',
      concepts: contextUnderstanding.concepts || [],
      questions: contextUnderstanding.questions || [],
      actionItems: contextUnderstanding.actionItems || [],
      decisions: contextUnderstanding.decisions || []
    });
    return;
  }

  renderConceptPanel(payload);
}

function render() {
  if (!sessionData) return;

  statusEl.textContent = validationIssues.length
    ? `Session ${sessionData.session.status} · warnings ${validationIssues.length}`
    : `Session ${sessionData.session.status}`;

  providerEl.textContent = `${sessionData.session.providerMode} mode`;
  topicEl.textContent = sessionData.topic;
  summaryEl.textContent = validationIssues.length
    ? `${sessionData.summary} (Validation warnings present)`
    : sessionData.summary;
  sessionTitleEl.textContent = sessionData.session.title;
  latencyEl.textContent = `${sessionData.session.latencyMs} ms`;

  const contextUnderstanding = sessionData.contextUnderstanding || {
    source: 'session fallback',
    topic: sessionData.topic,
    summary: sessionData.summary,
    latestUtterance: sessionData.timeline.at(-1)?.text || '',
    concepts: sessionData.concepts || [],
    questions: [],
    actionItems: [],
    decisions: [],
    itemCount: sessionData.timeline.length,
    updatedAt: sessionData.session.updatedAt
  };

  contextTopicEl.textContent = contextUnderstanding.topic || sessionData.topic;
  contextSummaryEl.textContent = contextUnderstanding.summary || sessionData.summary;
  contextLatestUtteranceEl.textContent = contextUnderstanding.latestUtterance || 'Waiting for speech.';
  contextConceptsEl.textContent = formatContextList(contextUnderstanding.concepts, 'Waiting for concepts.');
  contextQuestionsEl.textContent = formatContextList(contextUnderstanding.questions, 'No questions detected yet.');
  contextActionItemsEl.textContent = formatContextList(contextUnderstanding.actionItems, 'No action items yet.');
  contextDecisionsEl.textContent = formatContextList(contextUnderstanding.decisions, 'No decisions captured yet.');
  contextSourceEl.textContent = contextUnderstanding.source || 'session fallback';
  contextMetaEl.textContent = formatContextMeta(contextUnderstanding);
  renderCaptureState();

  if (contextExplorerEl) {
    contextExplorerEl.innerHTML = renderContextExplorer(contextUnderstanding);
  }
  conceptsEl.innerHTML = renderConcepts(contextUnderstanding.concepts || sessionData.concepts || []);

  if (validationIssues.length) {
    validationWarningEl.hidden = false;
    validationWarningListEl.innerHTML = validationIssues.map((issue) => `<li>${issue}</li>`).join('');
  } else {
    validationWarningEl.hidden = true;
    validationWarningListEl.innerHTML = '';
  }

  const visibleTimeline = getVisibleTimeline(sessionData, sessionData.timeline.length);
  const latestEntry = visibleTimeline.at(-1);
  transcriptCollapsedPreviewEl.textContent = latestEntry
    ? `${latestEntry.speaker}: ${latestEntry.text}`
    : 'No transcript yet.';
  transcriptPanelEl.classList.toggle('collapsed', transcriptCollapsed);
  toggleTranscriptBtn.textContent = transcriptCollapsed ? 'Expand' : 'Collapse';
  transcriptEl.innerHTML = transcriptCollapsed ? '' : renderTranscript(visibleTimeline);
}

async function hydrateSession() {
  const loaded = await loadSession();
  sessionData = loaded.session;
  validationIssues = loaded.issues;
  render();
}

async function requestHydrate() {
  if (hydrateInFlight) {
    hydrateQueued = true;
    return hydrateInFlight;
  }

  hydrateInFlight = (async () => {
    try {
      await hydrateSession();
    } finally {
      hydrateInFlight = null;
      if (hydrateQueued) {
        hydrateQueued = false;
        requestHydrate().catch(handleLoadError);
      }
    }
  })();

  return hydrateInFlight;
}

async function syncCaptureState() {
  try {
    const previousCompleted = captureState?.lastCompletedChunkAt || null;
    await fetchCaptureStatus();
    renderCaptureState();

    if (captureState?.lastCompletedChunkAt && captureState.lastCompletedChunkAt !== previousCompleted) {
      lastSeenCompletedChunkAt = captureState.lastCompletedChunkAt;
      await requestHydrate();
    }
  } catch {
    renderCaptureState();
  }
}

function handleLoadError(error) {
  statusEl.textContent = 'Load failed';
  captureStatusEl.textContent = error.message;
  conceptPanelSummaryEl.textContent = error.message;
  syncCaptureState();
}

async function startListening() {
  const response = await fetch('/api/live-capture/start', { method: 'POST' });
  const body = await response.json();
  captureState = body.capture || captureState;
  renderCaptureState();

  if (!response.ok) {
    await syncCaptureState();
    throw new Error(body?.error || `Start listening failed with status ${response.status}`);
  }

  await requestHydrate();
  await syncCaptureState();
}

async function stopListening() {
  const response = await fetch('/api/live-capture/stop', { method: 'POST' });
  const body = await response.json();
  captureState = body.capture || captureState;
  renderCaptureState();

  if (!response.ok) {
    await syncCaptureState();
    throw new Error(body?.error || `Stop listening failed with status ${response.status}`);
  }

  await syncCaptureState();
}

async function clearLiveTranscript() {
  const response = await fetch('/api/transcript-ingestion', { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Clear transcript failed with status ${response.status}`);
  }
  await requestHydrate();
}

startListeningBtn.addEventListener('click', () => startListening().catch(handleLoadError));
stopListeningBtn.addEventListener('click', () => stopListening().catch(handleLoadError));
clearLiveTranscriptBtn.addEventListener('click', () => clearLiveTranscript().catch(handleLoadError));
toggleTranscriptBtn.addEventListener('click', () => {
  transcriptCollapsed = !transcriptCollapsed;
  render();
});
conceptsEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-concept]');
  if (!button) return;
  openConceptPanel(button.dataset.concept, 'found').catch(handleLoadError);
});
if (contextExplorerEl) {
  contextExplorerEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-context-item]');
    if (!button) return;
    openConceptPanel(button.dataset.contextItem, 'found', button.dataset.contextKind || 'concept').catch(handleLoadError);
  });
}
conceptPanelCloseBtn.addEventListener('click', () => {
  conceptPanelEl.hidden = true;
});
conceptModeFoundBtn.addEventListener('click', () => {
  if (!conceptPanelState.concept) return;
  openConceptPanel(conceptPanelState.concept, 'found', conceptPanelState.kind).catch(handleLoadError);
});
conceptModeGeneratedBtn.addEventListener('click', () => {
  if (!conceptPanelState.concept) return;
  openConceptPanel(conceptPanelState.concept, 'generated', conceptPanelState.kind).catch(handleLoadError);
});
conceptPanelHeaderEl.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  const rect = conceptPanelEl.getBoundingClientRect();
  conceptDragState = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  conceptPanelHeaderEl.setPointerCapture(event.pointerId);
});
conceptPanelHeaderEl.addEventListener('pointermove', (event) => {
  if (!conceptDragState) return;
  conceptPanelEl.style.left = `${Math.max(8, event.clientX - conceptDragState.offsetX)}px`;
  conceptPanelEl.style.top = `${Math.max(8, event.clientY - conceptDragState.offsetY)}px`;
  conceptPanelEl.style.right = 'auto';
});
conceptPanelHeaderEl.addEventListener('pointerup', () => {
  conceptDragState = null;
});
conceptPanelHeaderEl.addEventListener('pointercancel', () => {
  conceptDragState = null;
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    syncCaptureState();
    requestHydrate().catch(handleLoadError);
  }
});

function startLoops() {
  clearInterval(autoRefreshTimer);
  clearInterval(statusPollTimer);

  if (isFixtureMode()) return;

  autoRefreshTimer = setInterval(() => {
    if (document.hidden || captureState?.running) return;
    requestHydrate().catch(handleLoadError);
  }, AUTO_REFRESH_MS);

  statusPollTimer = setInterval(() => {
    if (document.hidden) return;
    syncCaptureState();
  }, STATUS_POLL_MS);
}

startLoops();
Promise.all([fetchCaptureStatus(), requestHydrate()])
  .then(() => {
    renderCaptureState();
  })
  .catch(handleLoadError);
(handleLoadError);
