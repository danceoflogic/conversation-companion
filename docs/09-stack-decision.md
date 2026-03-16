# Stack Decision

## Selected Direction for 0.1.x
Desktop-first web app prototype served locally with a lightweight Node.js server and static frontend assets.

## Rationale
- Fastest route to a runnable prototype
- Keeps the architecture inspectable and easy to evolve
- Avoids heavyweight framework churn before core interaction patterns are proven
- Leaves room to migrate to Next.js, Tauri, or Electron once the product shape stabilises

## Near-Term Technical Scope
- Static frontend shell
- Mock transcript fixtures
- Schema-like contract modules
- Local development server
- No live audio capture yet in 0.1.x
