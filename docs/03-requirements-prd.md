# Product Requirements Document (PRD)

## Product Goal
Create an application that converts live conversation into a dynamic interactive knowledge surface.

## MVP Positioning
Study / Tutoring Companion

## Primary User
A learner or tutor running a session on a trusted device who wants real-time support: transcript, summaries, key concepts, examples, misconceptions, and follow-up prompts.

## User Stories
1. As a student, I want a live transcript so I can keep track of what was said.
2. As a tutor, I want key concepts highlighted so I can check understanding.
3. As a student, I want worked examples generated from the current topic.
4. As a user, I want clear listening controls so I know when the app is active.
5. As a user, I want my session data to be easy to delete.
6. As a product owner, I want structured outputs so the UI is deterministic and testable.

## Functional Requirements
### Audio Capture
- Start/stop/pause microphone capture
- Clear active listening indicator
- Device microphone selection

### Speech-to-Text
- Near real-time transcription in rolling chunks
- Transcript confidence metadata where available
- Graceful handling of silence and noise

### Context Engine
- Rolling session summary
- Topic detection
- Concept extraction
- Question detection
- Misconception candidate detection
- Widget recommendation logic

### Interactive UI
- Transcript panel
- Summary panel
- Topic banner
- Widget stack with at least:
  - glossary card
  - worked example card
  - follow-up questions card
  - common mistakes card
  - quick quiz card

### Session Management
- Save session summary
- Optional transcript persistence
- Delete session data
- Export notes

## Non-Functional Requirements
- Responsive UI updates within acceptable latency for conversation support
- Strong privacy defaults
- Structured logging and observability
- Clear error states and fallback behavior
- Modular services and testable contracts

## Safety Requirements
- Explicit user-controlled listening only
- No hidden background recording mode in MVP
- Easy mute/pause and deletion
- Clear disclosure of cloud/local processing mode
- No automatic third-party sharing

## Acceptance Criteria for MVP
- User can start a session and see transcript updates
- System can identify a dominant topic from transcript chunks
- System can render at least 5 widget types from structured JSON
- User can pause listening and delete session data
- End-to-end demo works reliably on a representative tutoring scenario
