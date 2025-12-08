# AI Schedule Dialogue

## ADDED Requirements

### Requirement: Structured Model Responses
The AI schedule assistant MUST enforce a JSON Schema contract for model responses whenever the selected provider supports structured output, and MUST gracefully fall back (with logging) when that capability is absent.

#### Scenario: Schema-enabled provider
- GIVEN the schedule assistant selects a chat model that declares JSON Schema support
- WHEN the parse service sends the completion request
- THEN the payload includes `response_format: { type: "json_schema", json_schema: <schedule schema> }`
- AND the schema defines `reply`, `intent`, `missing_fields`, `follow_up_question`, `target_event_id`, and `proposal` (including timezone defaults)
- AND the response is parsed directly without string post-processing.

#### Scenario: Fallback provider
- GIVEN the active model does not support JSON Schema responses
- WHEN the parse service sends the completion request
- THEN it omits the `response_format` parameter
- AND records a structured log/metric indicating that schema enforcement was skipped.

### Requirement: Console Schema Visibility
Console operators MUST see the exact JSON Schema contract (name, summary, strict flag, raw schema JSON) inside the AI schedule configuration UI so they can keep the prompt template aligned with the enforced structure.

#### Scenario: Schema preview available
- GIVEN an authorized operator opens the AI schedule config page
- WHEN the page loads
- THEN it calls `/consoleapi/user-schedule/schema` (optionally with a timezone) and renders the returned schema summary plus formatted JSON.

### Requirement: Relaxed Schedule Fields
The JSON Schema contract MUST treat the schedule title as the only required business field, allow optional start/end times, and expand the priority enum to include a `none` state so the AI no longer insists on missing timestamps or priorities when the user does not care.

#### Scenario: Missing fields only include title
- GIVEN the AI detects an intent but the user did not supply a title
- WHEN it responds with the structured payload
- THEN `missing_fields` contains only `["title"]`, even if other properties such as `startTime` or `location` are absent.
- AND the schema exposes `priority: ["high","medium","low","none"]` so downstream tooling can store “no priority” explicitly.
