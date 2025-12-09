# Change: Add JSON Schema Output for AI Schedule Assistant

## Why
- Schedule parsing currently relies on a handwritten JSON example inside the system prompt and fragile string parsing.
- Without deterministic structure we get brittle parsing, especially once we plug in new providers (e.g., Doubao) that already support native `response_format`.
- Product wants schedule proposals and clarifying questions to always follow a typed contract before they reach the UI.

## What Changes
- Add a reusable JSON Schema builder that mirrors the existing proposal payload (reply, intent, proposal, missing fields, etc.) and injects the runtime timezone default.
- Update the AI schedule parsing service so that supported providers send `response_format: { type: "json_schema", ... }` along with existing messages, while gracefully skipping it for incompatible providers.
- Simplify / align the system prompt so it references the schema contract instead of duplicating JSON examples.
- Provide configuration + logging knobs so ops can confirm whether a given provider is running in schema-enforced or fallback mode.

## Impact
- Specs: `ai-schedule-dialogue`
- Code: `packages/api/src/modules/user-schedule/services/ai-schedule.service.ts`, `packages/@buildingai/ai-sdk`, provider config, and related logging.
- Risk: Low — feature is additive but we need to ensure providers without schema support continue to work.
