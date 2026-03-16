# Safety and Privacy Protocol

## Safety Position
This product must not function as a deceptive surveillance tool. The MVP is designed for explicit, user-initiated listening on a trusted device in a consented context.

## Mandatory Safety Controls
- Visible listening indicator at all times while microphone capture is active
- Single-action pause/mute control
- Explicit session start by user
- Explicit disclosure of local vs cloud processing mode
- Easy delete flow for transcript/session data
- No covert startup-on-boot listening mode in MVP
- No silent remote audio streaming feature in MVP

## Privacy Defaults
- Do not retain raw audio by default
- Retain transcript only when user opts in or session save is selected
- Minimise sensitive data persistence
- Encrypt stored session metadata where feasible
- Avoid unnecessary third-party transmission

## Consent Guidance
- Use in personal study/tutoring or clearly consented settings only
- Shared-room or public-space use must require clear notice and permission
- Product copy and onboarding should explicitly instruct lawful and ethical usage

## Model Safety
- Mark uncertain outputs where confidence is low
- Avoid presenting inferred facts as certain truth without confidence controls
- Provide 'verify' links or prompts where external claims are made
- Prefer structured educational assistance over authoritative medical/legal/financial claims in early versions

## Operational Controls
- Audit logs for admin/debug use without exposing raw private content unnecessarily
- Configurable retention window
- Data deletion workflow
- Error handling that fails safe rather than hiding issues

## Go / No-Go Principle
If a feature meaningfully increases covert monitoring risk without clear user benefit, it should not ship in MVP.
