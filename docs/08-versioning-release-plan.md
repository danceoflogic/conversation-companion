# Versioning and Release Plan

## Versioning Model
Semantic Versioning
- `0.x.y` for pre-release iterative development
- `1.0.0` for first stable public release

## Suggested Release Cadence
- `0.1.x` foundation and scaffolding
- `0.2.x` first end-to-end audio/transcript flow
- `0.3.x` first tutoring widgets
- `0.4.x` session controls and exports
- `0.5.x` privacy and reliability improvements
- `0.6.x+` beta hardening and deployment work

## Branching Model
- `main` — stable integration branch
- `develop` — active integration branch (optional if workflow warrants)
- feature branches per story or epic
- release branches for stabilization if complexity grows

## Release Gates
### Before each minor release
- acceptance criteria met
- tests passing
- docs updated
- known risks reviewed
- changelog updated

## Artifact Discipline
Each release should include:
- version number
- changelog entry
- notable risks
- migration/config notes if needed
- test summary

## Governance Note
Do not promote to `1.0.0` until privacy, retention, consent, and deletion controls are production-worthy rather than aspirational.
