# Prototype Refactor Notes

## Purpose
Reduce coupling between raw mock payloads, UI rendering, and future live-data ingestion.

## Changes Introduced
- Added `app/session-model.js` for payload normalization and timeline/session helpers.
- Added `app/widget-renderers.js` for widget rendering logic.
- Simplified `app/app.js` so it orchestrates loading, state progression, and DOM updates rather than embedding all transformation logic inline.

## Why This Matters
- Easier migration to stronger typed contracts later
- Cleaner path toward swapping mock data for live transcript events
- Better portability across future shells, including Android-targeted clients
- More testable component boundaries

## Next Refactor Targets
- Introduce dedicated data service layer for API calls
- Move DOM rendering into more composable view helpers
- Add basic schema validation for incoming session payloads
