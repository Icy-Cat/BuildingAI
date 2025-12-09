# Design: AI Intelligent Schedule Assistant

## Architecture

### Frontend (Vue.js/Nuxt)
- **AI Chat Widget**: A floating or embedded chat interface.
- **Message Components**:
    - `UserMessage`: Displays user input.
    - `AIMessage`: Displays text responses.
    - `ScheduleCard`: A specialized component to display the structured proposal (e.g., "Create Event: Meeting at 3 PM").
        - Actions: "Confirm", "Edit", "Cancel".

### Backend (NestJS)
- **UserScheduleModule**: (New module to avoid conflict with existing system `ScheduleModule`)
    - Handles schedule data persistence and business logic.
- **AIScheduleService**:
    - Orchestrates the conversation.
    - Uses `@buildingai/ai-sdk` to interact with LLM providers.
    - Validates LLM output against the expected schema.
- **API Endpoints**:
    - `POST /api/user-schedule/chat`: Sends user message, returns AI response (text + optional proposal).
    - `POST /api/user-schedule/execute`: Executes a confirmed proposal.

### AI Integration
- **SDK**: Use `@buildingai/ai-sdk` `TextGenerator` for consistent model interaction.
- **Model**: Use a capable instruction-following model (e.g., GPT-4o, Claude 3.5 Sonnet).
- **Prompting**: System prompt will define the JSON schema for intents (Create, Update, Delete, Query) and slots (Time, Title, Location).
- **Context**: The prompt must include the current server time and user's timezone to resolve relative time references (e.g., "tomorrow").

## Data Flow

1. **User Input**: User types "Book a meeting with Alice tomorrow at 10am".
2. **Intent Parsing**:
    - Backend receives text.
    - Backend constructs prompt with current time.
    - LLM returns JSON: `{ "intent": "create_event", "event": { "title": "Meeting with Alice", "start_time": "...", ... } }`.
3. **Proposal Generation**:
    - Backend returns a "Proposal" object to Frontend.
4. **User Review**:
    - Frontend renders `ScheduleCard`.
    - User reviews details.
5. **Execution**:
    - User clicks "Confirm".
    - Frontend calls `execute` endpoint.
    - Backend saves to DB.
    - Backend returns success message.

## Data Models

### Schedule Event (Database)
*Aligns with frontend `ScheduleItem`*
```typescript
interface ScheduleEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: Date; // Maps to date + time
  endTime: Date;
  priority?: "high" | "medium" | "low";
  category?: "work" | "personal" | "meeting" | "reminder";
  isImportant?: boolean;
  isUrgent?: boolean;
  location?: string;
  attendees?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### AI Proposal (API)
```typescript
interface AIProposal {
  intent: 'create' | 'update' | 'delete' | 'query';
  summary: string;
  data: Partial<ScheduleEvent>; // For create/update
  originalEventId?: string; // For update/delete
}
```
