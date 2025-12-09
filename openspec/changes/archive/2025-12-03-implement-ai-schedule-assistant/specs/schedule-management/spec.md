# Schedule Management

## ADDED Requirements

### Requirement: Create Schedule
The system MUST allow creating new schedule events with title, start time, end time, location, and description.

#### Scenario: Creating a standard event
- Given a valid event proposal
- When the user confirms the creation
- Then the event is saved to the database
- And the user receives a success confirmation

### Requirement: Update Schedule
The system MUST allow modifying existing events, including changing time, title, or other details.

#### Scenario: Updating event time
- Given an existing event "Team Sync" at 10 AM
- When the user requests to move it to 11 AM and confirms
- Then the event start and end times are updated in the database

### Requirement: Delete Schedule
The system MUST allow deleting events.

#### Scenario: Deleting an event
- Given an existing event
- When the user requests deletion and confirms
- Then the event is removed (or soft-deleted) from the database

### Requirement: Query Schedule
The system MUST allow querying for free time or existing events.

#### Scenario: Finding free time
- Given the user asks "When am I free this afternoon?"
- Then the system retrieves events for the afternoon
- And identifies gaps between events
- And returns a list of available time slots
