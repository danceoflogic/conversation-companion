# Data Contracts

## Mock Session Contract
The prototype currently uses a single mock session payload served from `data/mock-session.json`.

### Top-level fields
- `session`: metadata about current run state
- `summary`: rolling session summary
- `topic`: dominant detected topic
- `concepts[]`: extracted concepts for chip rendering
- `timeline[]`: ordered transcript events with optional summary/widget hints
- `widgets[]`: currently available widget payloads

## Transcript Timeline Event
- `time: string`
- `speaker: string`
- `text: string`
- `summary?: string`
- `widgets?: string[]`

## Widget Types in 0.1.x
- `glossary`
- `worked_example`
- `common_mistakes`
- `quiz`
- `follow_up_questions`
- `open_questions`
- `action_items`
- `decisions`

## Transcript Context Contract
The local development server exposes `GET /api/context-understanding` to derive a structured understanding layer from stored transcript-ingestion items.

### Top-level fields
- `available: boolean`
- `source: string`
- `provider: string`
- `updatedAt: string | null`
- `itemCount: number`
- `contextWindowItems: number`
- `topic: string`
- `summary: string`
- `latestUtterance: string`
- `concepts: string[]`
- `questions: string[]`
- `actionItems: string[]`
- `decisions: string[]`

## Design Intent
The endpoint now prefers provider-backed structured analysis (Ollama in local development) while preserving a heuristic fallback. The contract is shaped so future providers such as ChatGPT can plug in behind the same JSON response without forcing UI rewrites.
