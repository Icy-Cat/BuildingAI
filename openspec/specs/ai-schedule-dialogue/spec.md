# ai-schedule-dialogue Specification

## Purpose
TBD - created by archiving change add-schedule-json-schema-output. Update Purpose after archive.
## Requirements
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

### Requirement: Chat Interface
The system MUST provide a conversational interface for users to interact with the schedule assistant.

#### Scenario: Opening the assistant
- Given the user is on the calendar page
- When they click the "AI Assistant" button
- Then a chat window opens with a welcome message "How can I help you with your schedule today?"

### Requirement: Intent Recognition
The system MUST analyze user input to identify the user's intent: Create, Update, Reschedule, Delete, Batch Operation, or Query.

#### Scenario: Creating a simple event
- Given the user types "Lunch with Mom tomorrow at 12"
- Then the system identifies the intent as `create_event`
- And extracts the title "Lunch with Mom" and time "Tomorrow 12:00 PM"

#### Scenario: Rescheduling an event
- Given the user types "Move my 3pm meeting to 4pm"
- Then the system identifies the intent as `reschedule_event`
- And identifies the target event at 3pm and the new time 4pm

### Requirement: Proposal Presentation
The system MUST present identified intents as structured proposals (cards) for user confirmation before execution.

#### Scenario: Displaying a creation proposal
- Given the system has parsed a `create_event` intent
- Then it displays a card showing:
    - Title: Lunch with Mom
    - Time: [Date] 12:00 PM - 1:00 PM
    - Action Buttons: "Confirm", "Edit"

### Requirement: Ambiguity Handling
The system MUST ask clarifying questions when the user's request is ambiguous or incomplete.

#### Scenario: Ambiguous time
- Given the user types "Schedule a meeting"
- Then the system responds "Sure, what time and date should I schedule that for?"

