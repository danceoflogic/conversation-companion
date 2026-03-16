# Conversation Companion — Codex handoff summary

## What this project is
A local prototype for an ambient conversation companion / study-tutoring assistant. It runs a Node dev server and serves a browser UI. The system is moving from static/mock content toward live context generated from captured/transcribed audio.

## Main entry point
- Run with: `npm run dev`
- Server entry: `server/dev-server.js`
- Local URL: `http://127.0.0.1:3088`

## Current architecture at a glance
- `app/` — frontend UI, rendering, widget logic, session model/service
- `server/` — dev server, context generation, env loading
- `scripts/` — verification and capture/transcribe/ingest helpers
- `data/` — mock/session/progress JSON fixtures
- `docs/` — charter, PRD, architecture, roadmap, contracts, handoff notes

## What was recently completed
1. Added browser-triggerable local capture controls through dev-server endpoints.
2. Wired live capture -> transcription -> ingest flow.
3. Switched local transcription path to `whisper.cpp` with a cautious CPU-only profile.
4. Added a silence gate so mostly quiet chunks are skipped.
5. Switched context generation to support OpenAI via local `.env.local`.
6. Began shifting widgets from mock/static content toward live AI-driven context data.
7. Fixed a real bug in concept-focus image fallback logic in `server/dev-server.js`.
8. Improved fallback query handling and simple relevance scoring for concept image lookup.

## Known current behavior
- Dev server runs successfully.
- Homepage responds correctly.
- OpenAI-backed context generation was previously verified with `gpt-4o-mini`.
- `lightning strikes` started returning at least one relevant image after the concept-focus fallback fix.
- `Context Overview` still tends to produce weak/overbroad image matches and may be better treated as primarily text-first unless the UX is adjusted.
- Live widgets can surface generated `decisions`, `action_items`, and `open_questions` ahead of older static ones.

## Likely polish / finish work
1. Review concept-focus UX and decide whether overview-like concepts should show an image at all.
2. Tighten image fallback logic so generic topics do not produce junk matches.
3. Audit the app for any remaining mock/static widget paths that should be replaced with live context data.
4. Improve error handling and loading states around capture/transcription/context generation.
5. Verify the dev UX end-to-end from browser controls through widget updates.
6. Improve configuration ergonomics so the project is easier to run in a fresh environment.
7. Update docs/README to reflect the current live pipeline and required local setup.

## Important local-only details
- The original local setup used `.env.local` with secrets and local binary/model paths.
- The upload bundle intentionally excludes:
  - `.env.local`
  - `captures/`
  - `vendor/whisper.cpp/`
  - `.venv-whisper-build/`
  - `node_modules/`
- The receiving environment may need to:
  - provide an OpenAI API key
  - build/install `whisper.cpp` or replace the transcription backend
  - update local paths in `.env.local`

## Suggested first actions for Codex
1. Read `README.md`, `docs/12-prototype-refactor.md`, `docs/13-session-service-layer.md`, `docs/16-handoff.md`.
2. Inspect `server/dev-server.js`, `server/context-engine.js`, `app/app.js`, and widget renderer files.
3. Run the project locally if the environment supports it.
4. Focus on finishing the live-data path and smoothing the concept-focus/image behavior.

## Constraints / intent
- Preserve the current project direction instead of rewriting it from scratch.
- Prefer targeted polish over large architectural churn.
- Keep the dev server workflow simple.
- Treat this as a prototype being refined toward a stable demo.
