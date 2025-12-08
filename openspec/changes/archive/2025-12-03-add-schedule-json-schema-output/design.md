## Context
- The current AI schedule parser depends on a hard-coded JSON example embedded in the system prompt and post-hoc parsing of arbitrary text.
- Providers such as OpenAI, Doubao, etc. now expose native `response_format` hooks so we can force models to emit strict JSON that mirrors our proposal payload structure.
- We must preserve backwards compatibility for providers that do not yet expose the feature.

## Goals / Non-Goals
- Goals: (1) Define a single authoritative JSON Schema for schedule replies. (2) Automatically attach that schema to chat completions when the target provider supports it. (3) Provide observability so ops know which mode is running.
- Non-Goals: Broader refactors of the schedule UI/UX, wholesale provider abstraction rewrites, or new intent types.

## Decisions
1. **Schema Builder Module**: Implement a dedicated helper (e.g., `buildScheduleResponseSchema(timezone)`) that returns `{ name, schema, strict }` so both system prompts and response_format parameters derive from the same source of truth.
2. **Capability Detection**: Introduce a method (e.g., `supportsJsonSchema(providerName)` or per-model flag) so only compatible providers receive the schema parameter. Incompatible providers bypass it but still use the same prompt text.
3. **Prompt Alignment**: Update `buildSystemPrompt` to reference the schema contract (possibly by embedding a short summary or cleaned JSON) instead of duplicating the entire JSON example. This prevents divergence between prompt instructions and enforced schema.
4. **Observability**: Log whether the parse request used schema enforcement vs fallback, and expose a configuration toggle if operators need to disable the feature quickly.

## Risks / Trade-offs
- **Provider Drift**: Some providers may partially implement JSON schema support. Mitigation: allow opt-out per model and log failures.
- **Schema Evolution**: Future fields must be added in one place (the builder) and validated thoroughly. Mitigation: add unit tests for schema shape.
- **Prompt Length**: Injecting large schema JSON could increase token usage. Mitigation: keep prompt summary short and rely on the `response_format` enforcement whenever possible.

## Open Questions
- Do we need an admin UI knob to force-disable schema enforcement globally, or is per-model provider detection enough?
- Are there providers that require a different schema format (e.g., function calling) that we should consider in the future?
