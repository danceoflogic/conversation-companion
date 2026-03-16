# Conversation Companion — Handoff

## Project location
`/home/stduser/.openclaw/workspace/conversation-companion`

## Current state
The project has a working local-first pipeline:
- desktop-native local audio capture
- local Whisper transcription
- local transcript ingestion
- UI display of live transcript data
- local context-understanding block in the UI

## Working commands
### Start dev server
```bash
cd /home/stduser/.openclaw/workspace/conversation-companion
npm run dev
```

### Run full verification
```bash
cd /home/stduser/.openclaw/workspace/conversation-companion
npm run verify
```

### Run local capture → whisper → ingest
```bash
cd /home/stduser/.openclaw/workspace/conversation-companion
npm run capture:local
```

## Live app URLs
- App: `http://127.0.0.1:3088/`
- Progress page: `http://127.0.0.1:3088/progress-report.html`
- Transcript ingestion store: `http://127.0.0.1:3088/api/transcript-ingestion`
- Context endpoint: `http://127.0.0.1:3088/api/context-understanding`

## Important working details
- Proven mic source for local capture:
  `alsa_input.usb-046d_HD_Pro_Webcam_C920_8185B3DF-02.analog-stereo`
- The project capture/transcription path now requests FP32 explicitly for Whisper.
- The transcript store can be cleared via the app button or `DELETE /api/transcript-ingestion`.
- Context understanding now supports provider switching by environment; current local setup uses OpenAI from `.env.local`, while the Ollama path remains available as an alternate provider.
- The context engine uses a smaller transcript window plus per-transcript caching so repeated UI refreshes do not re-hit the provider unnecessarily.
- Current default OpenAI model is `gpt-4o-mini`; change with `OPENAI_MODEL=<model>`. Ollama remains available through `CONTEXT_PROVIDER=ollama`.
- The UI context block now exposes topic, summary, latest utterance, concepts, open questions, action items, and decisions.

## Current architecture boundary
Do **not** redesign unless absolutely necessary.
Preferred rule set:
- touch only files directly related to the task
- stop after tests/checks pass
- avoid optional polish
- report blockers immediately

## Next recommended step
Tighten the browser-driven listening loop into a smoother real-time experience.

Suggested next batch:
1. Surface capture phase more clearly in the UI (capturing vs transcribing vs completed/error)
2. Add configurable capture duration and repeat mode from the UI
3. Tune provider selection config so Ollama/OpenAI can switch cleanly by environment
4. Start feeding AI-derived concepts/questions/action items into widget generation

## Notes for restart in a new chat
When resuming, tell the new chat something like:

> Project is in `/home/stduser/.openclaw/workspace/conversation-companion`. Read `docs/16-handoff.md`. Current state: local capture → Whisper → transcript ingestion → UI works. Run `npm run verify` first, then continue with AI context-analysis instead of heuristic keywords/questions.
UI works. Run `npm run verify` first, then continue with AI context-analysis instead of heuristic keywords/questions.
