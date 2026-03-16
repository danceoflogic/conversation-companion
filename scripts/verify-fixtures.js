import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';
import { loadSession, validateSessionPayload } from '../app/session-service.js';

const port = Number(process.env.PORT || 3188);
const baseUrl = `http://127.0.0.1:${port}`;
const transcriptStorePath = new URL('../data/local-transcript-ingestion.json', import.meta.url);

const expectations = [
  {
    name: 'default',
    path: '/api/mock-session',
    topic: 'Quadratic Equations',
    timelineLength: 5,
    widgetLength: 5,
    warningCount: 0
  },
  {
    name: 'invalid',
    path: '/api/mock-session?fixture=invalid',
    topic: 'Broken Session',
    timelineLength: 0,
    widgetLength: 0,
    warningCount: 3,
    warningIncludes: [
      'Timeline must be an array.',
      'Widgets must be an array.',
      'Concepts must be an array.'
    ]
  },
  {
    name: 'geometry',
    path: '/api/mock-session?fixture=geometry',
    topic: 'Circle Theorems',
    timelineLength: 3,
    widgetLength: 5,
    warningCount: 0
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForServer(url, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Server did not become ready at ${url}`);
}

async function fetchJson(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return response.json();
}

function createSessionServiceFetch(nativeFetch) {
  return async (resource, options) => {
    if (typeof resource === 'string' && resource.startsWith('/')) {
      return nativeFetch(`${baseUrl}${resource}`, options);
    }

    return nativeFetch(resource, options);
  };
}

async function verifyFixtures(lines) {
  for (const expectation of expectations) {
    const payload = await fetchJson(expectation.path);
    const warnings = validateSessionPayload(payload);
    const timelineLength = Array.isArray(payload.timeline) ? payload.timeline.length : 0;
    const widgetLength = Array.isArray(payload.widgets) ? payload.widgets.length : 0;

    assert(payload.topic === expectation.topic, `${expectation.name}: expected topic ${expectation.topic}, got ${payload.topic}`);
    assert(timelineLength === expectation.timelineLength, `${expectation.name}: expected timeline length ${expectation.timelineLength}, got ${timelineLength}`);
    assert(widgetLength === expectation.widgetLength, `${expectation.name}: expected widget length ${expectation.widgetLength}, got ${widgetLength}`);
    assert(warnings.length === expectation.warningCount, `${expectation.name}: expected ${expectation.warningCount} warnings, got ${warnings.length}`);

    for (const fragment of expectation.warningIncludes || []) {
      assert(warnings.includes(fragment), `${expectation.name}: missing warning "${fragment}"`);
    }

    lines.push(
      `${expectation.name}: PASS — ${expectation.path} → topic="${payload.topic}", timeline=${timelineLength}, widgets=${widgetLength}, warnings=${warnings.length}`
    );
    if (warnings.length) {
      lines.push(`  warnings: ${warnings.join(' | ')}`);
    }
  }
}

async function verifyTranscriptIngestion(lines) {
  const originalStore = await fetchJson('/api/transcript-ingestion');
  const startingCount = Array.isArray(originalStore.items) ? originalStore.items.length : 0;
  const sample = {
    speaker: 'Verifier',
    time: '00:00',
    text: `fixture verification transcript sample ${Date.now()}`,
    source: 'verify-fixtures'
  };

  try {
    const postBody = await fetchJson('/api/transcript-ingestion', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(sample)
    });

    assert(postBody.ok === true, 'transcript-ingestion: expected ok=true from POST response');

    const updatedStore = await fetchJson('/api/transcript-ingestion');
    const updatedCount = Array.isArray(updatedStore.items) ? updatedStore.items.length : 0;
    const found = updatedStore.items?.some((item) => item.text === sample.text && item.source === sample.source);

    assert(found, 'transcript-ingestion: ingested sample was not visible in stored items');
    assert(updatedCount === startingCount + 1, `transcript-ingestion: expected item count ${startingCount + 1}, got ${updatedCount}`);

    lines.push(
      `transcript-ingestion: PASS — GET/POST /api/transcript-ingestion → items ${startingCount}→${updatedCount}, sample id="${postBody.item.id}" visible in store`
    );

    const originalFetch = globalThis.fetch;
    const originalLocation = globalThis.location;

    globalThis.fetch = createSessionServiceFetch(originalFetch);
    globalThis.location = new URL(`${baseUrl}/`);

    try {
      const { raw, session, issues } = await loadSession();

      assert(issues.length === 0, `understanding-layer: expected 0 validation issues, got ${issues.length}`);
      assert(raw.summary.includes('Displaying'), 'understanding-layer: expected merged summary to describe ingested transcript items');
      assert(raw.summary.includes('/api/transcript-ingestion'), 'understanding-layer: expected merged summary to mention transcript-ingestion source');
      assert(session.session.status === 'listening', `understanding-layer: expected session status listening, got ${session.session.status}`);
      assert(session.timeline.length === updatedCount, `understanding-layer: expected timeline length ${updatedCount}, got ${session.timeline.length}`);
      assert(session.timeline.some((item) => item.text === sample.text && item.speaker === sample.speaker), 'understanding-layer: expected ingested transcript sample in merged timeline');
      assert(session.widgets.length === 5, `understanding-layer: expected 5 widgets from base session, got ${session.widgets.length}`);
      assert(session.topic === 'Quadratic Equations', `understanding-layer: expected topic Quadratic Equations, got ${session.topic}`);

      lines.push(
        `understanding-layer: PASS — loadSession() merges live transcript items into summary/timeline while preserving topic="${session.topic}" and widgets=${session.widgets.length}`
      );
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.location = originalLocation;
    }
  } finally {
    await writeFile(transcriptStorePath, `${JSON.stringify(originalStore, null, 2)}\n`, 'utf8');
  }
}

async function main() {
  const server = spawn(process.execPath, ['server/dev-server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  let serverStartError = null;
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  server.on('error', (error) => {
    serverStartError = error;
  });

  try {
    await waitForServer(`${baseUrl}/api/mock-session`);

    if (serverStartError) {
      throw new Error(`Server failed to start: ${serverStartError.message}`);
    }

    const lines = [];
    await verifyFixtures(lines);
    await verifyTranscriptIngestion(lines);

    console.log('Fixture + transcript-ingestion verification passed.');
    for (const line of lines) {
      console.log(line);
    }
    console.log('Warning-path expectation: only fixture=invalid should produce validation warnings.');
  } finally {
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise((resolve) => server.once('exit', resolve));
    }
    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
  }
}

main().catch((error) => {
  console.error(`Fixture + transcript-ingestion verification failed: ${error.message}`);
  process.exitCode = 1;
});
