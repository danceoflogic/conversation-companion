# Fixture, transcript-ingestion, and understanding-layer verification

Use one command to verify the three fixture modes exposed by the dev server, the local transcript-ingestion path, **and** the understanding-layer merge that feeds context-summary/timeline data into the UI session model:

```bash
npm run verify
```

Compatibility alias:

```bash
npm run verify:fixtures
```

## What it checks

The script boots the local dev server on a temporary port, requests each fixture endpoint, validates the returned payload shape with the same `validateSessionPayload()` function used by the app, verifies `GET`/`POST` availability for `/api/transcript-ingestion`, and then calls `loadSession()` from `app/session-service.js` against the live dev-server endpoints.

The transcript-ingestion step posts a unique sample item, confirms that it becomes visible in the stored items returned by the server, and then reuses that sample to prove the understanding-layer merge updates the session summary and timeline while keeping base-session UI widget data available. After the check, the original local store file is restored so the verification run does not leave extra test data behind.

### Expected results

- `GET /api/mock-session`
  - topic: `Quadratic Equations`
  - timeline entries: `5`
  - widgets: `5`
  - validation warnings: `0`
- `GET /api/mock-session?fixture=invalid`
  - topic: `Broken Session`
  - timeline entries: `0` from the verifier's safe count because the payload is intentionally malformed
  - widgets: `0` from the verifier's safe count because the payload is intentionally malformed
  - validation warnings: `3`
  - expected warnings:
    - `Timeline must be an array.`
    - `Widgets must be an array.`
    - `Concepts must be an array.`
- `GET /api/mock-session?fixture=geometry`
  - topic: `Circle Theorems`
  - timeline entries: `3`
  - widgets: `5`
  - validation warnings: `0`
- `GET` + `POST /api/transcript-ingestion`
  - endpoint responds successfully
  - posted verification item becomes visible in `items[]`
  - item count increases by `1` during the check
  - original local store content is restored afterwards
- understanding-layer merge via `loadSession()`
  - merged `summary` references the ingested transcript path
  - merged `timeline[]` includes the posted sample item
  - session status switches to `listening`
  - base-session topic remains available
  - base-session widget payloads remain available for the UI (`widgets.length === 5`)

## Pass criteria

The command should finish with `Fixture + transcript-ingestion verification passed.` and summary lines for each fixture plus the transcript-ingestion and understanding-layer checks. If any fixture regresses, the warning path changes unexpectedly, the merged summary/timeline behavior breaks, or the ingestion sample is not visible in stored items, the command exits non-zero.
