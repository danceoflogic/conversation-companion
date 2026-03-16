You are taking over a local prototype called **Conversation Companion**.

Your job is to **polish it off without unnecessary rewrites**. Preserve the existing direction and improve what is already there.

## Project goal
This is an ambient conversation companion / study-tutoring assistant prototype. It serves a browser UI from a Node dev server and is moving from mock/static content toward live context derived from captured/transcribed audio.

## What to do first
1. Read:
   - `README.md`
   - `docs/12-prototype-refactor.md`
   - `docs/13-session-service-layer.md`
   - `docs/16-handoff.md`
   - `CODEX_HANDOFF_SUMMARY.md`
2. Inspect the main files:
   - `server/dev-server.js`
   - `server/context-engine.js`
   - `app/app.js`
   - `app/renderers.js`
   - `app/widget-renderers.js`
   - `app/session-service.js`
3. Understand the current live pipeline before changing architecture.

## Current known status
- `npm run dev` starts the local dev server.
- The app is served at `http://127.0.0.1:3088` in the original environment.
- Local capture controls were added through dev-server endpoints.
- Live capture -> transcription -> ingest -> context flow was partially verified.
- `whisper.cpp` was used locally for transcription in the original environment, but the bundle you received does not include the local built dependency tree.
- OpenAI-backed context generation was previously used through `.env.local`.
- A recent bug in concept-focus image fallback logic was fixed.
- After the fix, specific concepts like `lightning strikes` performed better, but broad overview-like concepts still produced weak image results.
- Some widgets are already moving from static/mock data to live AI-generated context data.

## Primary objectives
1. Get the project into a coherent, runnable, understandable state.
2. Finish or polish the live-data path so the UI consistently reflects current generated context instead of stale/mock placeholders.
3. Improve concept-focus behavior, especially image selection/fallback quality.
4. Clean up rough edges in UX, loading states, error handling, and developer ergonomics.
5. Update docs/setup instructions to match reality.

## What not to do
- Do not rewrite the whole app from scratch.
- Do not replace the architecture unless there is a clear, local justification.
- Do not add unnecessary framework churn.
- Do not remove working prototype behavior just because it is imperfect.

## Specific areas to investigate
- Whether `Context Overview` and similarly broad concepts should be text-first instead of forcing weak image matches.
- Whether any old mock widget rendering paths still override or dilute live data.
- Whether API responses between server and client are fully aligned with the intended widget model.
- Whether the capture/transcription/context states are clearly surfaced in the UI.
- Whether config can be made less fragile for a fresh developer environment.

## Deliverable style
Please produce:
1. A concise summary of what you found.
2. A focused list of changes made.
3. Any follow-up recommendations.
4. If something cannot be fully completed because of missing local dependencies (e.g. whisper.cpp build artifacts or API keys), isolate that cleanly and still improve everything else.

## Working style
- Prefer small, high-leverage fixes.
- Keep the current coding style unless there is a good reason not to.
- Preserve intent.
- Optimize for a strong prototype/demo experience.
