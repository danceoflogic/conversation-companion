# Session Service Layer

## Purpose
Introduce a dedicated session-loading layer so the prototype stops mixing network fetch logic, payload validation, normalization, and rendering in one file.

## New Modules
- `app/session-service.js`
  - fetches session payloads
  - validates required top-level structures
  - returns normalized session data plus validation issues
- `app/renderers.js`
  - transcript rendering helper
  - activity rendering helper
  - concept chip rendering helper

## Benefit
This moves the prototype toward a layered shape:
1. data fetch / validation
2. session normalization
3. rendering helpers
4. top-level app orchestration

## Next Steps
- surface validation issues visibly in the UI
- move widget rendering into the shared renderer layer fully
- prepare replacement of mock endpoint with live event-backed data source
