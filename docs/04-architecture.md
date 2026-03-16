# Architecture

## Recommended Stack
- Frontend: Next.js + TypeScript
- Backend/API: Node.js + TypeScript
- Real-time transport: WebSocket
- Speech-to-text: Whisper/faster-whisper initially via service abstraction
- Reasoning engine: cloud LLM first, local model optional later
- Persistence: PostgreSQL for sessions/metadata, object/file storage optional for exports
- Queue/background jobs: lightweight job runner initially, expandable later

## High-Level Components
1. **Client App**
   - microphone capture
   - transcript display
   - interactive widget rendering
   - session controls

2. **Audio Ingestion Service**
   - receives audio chunks
   - normalises formats
   - forwards to transcription layer

3. **Transcription Service**
   - converts chunked audio to text
   - emits partial and final transcript events

4. **Context Engine**
   - maintains rolling transcript buffer
   - extracts topics, concepts, and questions
   - prepares structured prompts
   - validates JSON outputs

5. **Widget Orchestrator**
   - converts structured model output into UI-ready payloads
   - applies confidence thresholds and fallback logic

6. **Session Store**
   - transcript fragments
   - summaries
   - widget state
   - user settings

## Initial Data Flow
1. User starts listening.
2. Client streams audio chunks.
3. Transcription service returns transcript segments.
4. Context engine updates rolling state.
5. LLM returns structured JSON.
6. Widget orchestrator validates and publishes UI payload.
7. Client re-renders live display.

## Design Principles
- schema-first contracts between services
- LLM outputs must be validated before rendering
- deterministic widget rendering from typed payloads
- pluggable STT and LLM providers
- privacy controls enforced at session boundary

## Suggested Service Interfaces
### Transcript Event
- sessionId
- timestampStart
- timestampEnd
- text
- confidence
- speakerLabel (optional future)

### Context Output
- summary
- topic
- concepts[]
- questions[]
- risks[]
- widgets[]

### Widget Types (MVP)
- glossary
- worked_example
- common_mistakes
- quiz
- follow_up_questions

## Risks to Mitigate in Architecture
- runaway latency from too-frequent reasoning calls
- malformed JSON from model output
- transcript drift due to partial updates
- poor UX under noisy audio conditions

## Near-Term Technical Decision
Build the system with provider abstractions from the start so STT and LLM backends can be swapped without rewriting the UI layer.
