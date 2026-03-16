# Agile Backlog

## Epics
1. Repository and delivery infrastructure
2. Audio capture and transcription pipeline
3. Context extraction and structured reasoning
4. Interactive widget rendering
5. Session management and exports
6. Safety, privacy, and controls
7. Observability and release readiness

## Sprint 1 Candidate Stories
- Initialise monorepo or app structure
- Establish TypeScript, linting, formatting, test harness
- Create base UI shell
- Implement widget renderer using static JSON fixtures
- Define shared schemas for transcript and widget payloads

## Sprint 2 Candidate Stories
- Implement microphone permissions and capture flow
- Stream audio chunks to backend
- Integrate first transcription provider
- Display partial/final transcript updates

## Sprint 3 Candidate Stories
- Build context engine prompt contract
- Add JSON schema validation
- Render glossary, worked example, and question cards
- Add session state store

## Sprint 4 Candidate Stories
- Add pause/mute/delete controls
- Add settings page for local/cloud mode
- Add export summary flow
- Add structured logging and error handling

## Definition of Ready
- user value clearly stated
- dependencies understood
- acceptance criteria written
- test approach identified

## Definition of Done
- code implemented
- tests added where appropriate
- documentation updated
- manual QA completed
- no critical safety regressions
