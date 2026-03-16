# Audio Spike Decision

## Task Scope
Select the narrowest practical path for first audio integration under the current constraints:
- desktop web app
- desktop-native capture preference
- local-first processing
- no architecture redesign

## Decision
Use a **local helper process** as the first desktop-native capture path, with the prototype app continuing to run as a local web app.

## Why This Path
- Keeps the current app shape intact
- Avoids forcing a packaging/runtime migration right now
- Matches desktop-native capture preference better than browser-only media APIs
- Supports local-first processing without requiring cloud capture services

## First Spike Shape
1. Local helper captures audio on the host machine.
2. Helper writes or streams chunks to a local endpoint/process.
3. Existing app pipeline later consumes transcript/session updates from that local source.

## Explicit Non-Decisions
- Not switching to Electron/Tauri right now
- Not implementing cloud-first transcription as the primary path
- Not redesigning the frontend architecture for capture concerns

## Success Condition for This Task
A concrete first capture path is selected and documented without widening scope beyond what is needed for the next implementation task.
