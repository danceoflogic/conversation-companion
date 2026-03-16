# Project Charter

## Project Name
Conversation Companion

## Working Description
A privacy-aware application that listens to live spoken conversation, converts speech into structured context, and presents a dynamic interactive display of useful information relevant to the current discussion.

## Sponsor
Chris

## Product Lead
Nyx

## Mission
Deliver a production-quality application from concept through release using disciplined product management, software engineering process, safety controls, and structured versioning.

## Problem Statement
People often discuss complex topics without immediate access to context, definitions, references, examples, or structured follow-up prompts. Existing assistants are usually request-driven rather than ambient and context-aware. There is room for a consent-first system that transforms live conversation into an interactive, assistive information surface.

## Initial Target Market
Primary: study and tutoring sessions
Secondary: meetings, collaborative learning, accessibility support
Deferred: always-on general ambient room intelligence

## Objectives
1. Build a usable MVP for live study/tutoring support.
2. Ensure privacy, safety, and consent are first-class requirements.
3. Use iterative delivery with clear milestone gates.
4. Produce reusable architecture for future verticals.

## Success Criteria
- Near real-time speech-to-text pipeline working reliably
- Structured topic extraction and widget generation
- Interactive UI that updates from transcript context
- Safe session controls: start, pause, mute, delete
- Internal alpha tested on representative study sessions

## Constraints
- Must follow safety protocols and professional development practices
- Must support structured versioning and phased delivery
- Should avoid stealth or deceptive listening behavior
- Should prefer privacy-preserving defaults

## Assumptions
- Early versions can use cloud LLM reasoning if quality is materially better
- Audio processing may begin with local or hybrid speech recognition
- MVP can focus on a single primary user workflow

## Out of Scope for MVP
- Hidden/background monitoring of third parties
- Multi-room passive surveillance
- Broad enterprise deployment
- Full multimodal mobile/desktop/web parity on day one
