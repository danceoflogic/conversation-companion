# Codex bundle notes

This bundle is intended for upload/review in Codex or another coding agent.

## Included
- app/
- server/
- scripts/
- docs/
- data/
- README.md
- CHANGELOG.md
- package.json
- progress-report.html
- .gitignore
- .env.example

## Excluded on purpose
- .env.local (contains secrets / local API key)
- captures/ (large local recordings and generated artifacts)
- vendor/whisper.cpp/ (large local dependency/build tree)
- .venv-whisper-build/ (local build environment)
- node_modules/ (reinstall instead)
- .git/

## Notes for the receiving agent
- The original project used a local `.env.local` for provider/runtime config.
- If Whisper support is needed, the receiving environment may need to build or install `whisper.cpp` and update `.env.local` paths accordingly.
- The dev server entry point is `npm run dev` which runs `node server/dev-server.js`.
