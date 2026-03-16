# Conversation Companion

An ambient conversation companion that listens to spoken discussion, transcribes it, extracts useful context, and renders an interactive live display with summaries, glossary cards, questions, worked examples, and actionable widgets.

## Project Status
Phase: 0 — Discovery and structured planning
Method: Agile / iterative delivery
Versioning: Semantic Versioning (`0.x` until public beta)

## Product Vision
Build a privacy-aware, consent-first application that can:
- capture live audio from a trusted device microphone
- transcribe speech in near real time
- infer topic, entities, and user intent
- produce structured UI widgets from conversation context
- render an interactive display that updates as the conversation evolves

## Initial Product Direction
The first implementation focus is a **Study / Tutoring Companion** vertical because it is:
- lower risk from a privacy and consent perspective
- easier to validate with real users
- more constrained and therefore better suited to a high-quality MVP
- commercially aligned with future maths tutoring positioning

## Delivery Structure
- `docs/01-project-charter.md`
- `docs/02-swot-analysis.md`
- `docs/03-requirements-prd.md`
- `docs/04-architecture.md`
- `docs/05-safety-privacy.md`
- `docs/06-roadmap.md`
- `docs/07-agile-backlog.md`
- `docs/08-versioning-release-plan.md`

## Planned Delivery Phases
1. Discovery and product definition
2. MVP architecture and prototype
3. Iterative feature development
4. Internal alpha
5. Limited beta
6. Production hardening

## Core Principles
- privacy by default
- explicit user control and visible listening state
- structured outputs over free-form UI generation
- modular architecture
- local-first where practical, cloud-augmented where useful
- professional documentation and release discipline

## Local capture → Whisper → ingest trigger
- Start the dev server with `npm run dev`.
- Run `npm run capture:local` to capture a short local audio sample, transcribe it with Whisper, POST it to `http://127.0.0.1:3088/api/transcript-ingestion`, and verify that the ingested item is present in the local transcript store.
- Useful overrides: `CAPTURE_DURATION=3`, `WHISPER_MODEL=tiny`, `SPEAKER_NAME=Chris`, `AUDIO_SOURCE=alsa_input.usb-046d_HD_Pro_Webcam_C920_8185B3DF-02.analog-stereo`.

## Quickstart (fresh environment)
1. Install Node.js 22+.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env.local` and fill in required values (the default provider is `heuristic` for zero-config startup).
4. Start the app with `npm run dev`.
5. Open `http://127.0.0.1:3088`.

### Minimum working modes
- **UI + mock fixtures only**: no extra dependencies required.
- **Live transcript ingest path**: dev server plus `POST /api/transcript-ingestion` (scripts can do this for you).
- **Full local capture + transcription**: requires local capture tools and a working transcription backend (`whisper.cpp` binaries/models are not bundled in this repo export).
- **AI context enrichment**: requires `OPENAI_API_KEY` (or Ollama config if using that provider).
- Quick temporary local test: `OPENAI_API_KEY=... CONTEXT_PROVIDER=openai npm run dev`.

## Local transcript context summary
- `GET /api/context-understanding` returns structured context JSON derived from stored transcript items (provider-backed when configured, heuristic fallback otherwise).
- Run `npm run verify:context` against a running dev server to verify endpoint shape and topic/summary/latest-utterance output.

## Fixture sanity check
- Run `npm run verify:fixtures` (or `npm run verify`) to verify the default, invalid, and geometry mock-session endpoints, the local transcript-ingestion path, and the understanding-layer merge that keeps context summary/timeline output aligned with UI widget availability.
- Detailed expectations live in `docs/15-fixture-verification.md`.
