# Tasks

## Backend
- [x] Create `UserSchedule` entity and migration in `packages/api`. <!-- id: create-schedule-entity -->
- [x] Implement `UserScheduleService` with CRUD methods (create, update, delete, find). <!-- id: implement-schedule-service -->
- [x] Implement `AIScheduleService` using `@buildingai/ai-sdk` to handle LLM interaction. <!-- id: implement-ai-schedule-service -->
- [x] Create `UserScheduleController` with endpoints for AI chat (`/parse`) and execution (`/execute`). <!-- id: create-schedule-controller -->
- [x] Register `UserScheduleModule` in `app.module.ts`. <!-- id: register-module -->
- [x] Add unit tests for `UserScheduleService` and `AIScheduleService`. <!-- id: test-backend-services -->

## Frontend
- [x] Create `ScheduleCard` component to display event details and actions. <!-- id: create-schedule-card -->
- [x] Create `AIChatWidget` component for the conversational interface. <!-- id: create-ai-chat-widget -->
- [x] Integrate `AIChatWidget` into the main layout or calendar page. <!-- id: integrate-chat-widget -->
- [x] Implement API client methods for schedule AI endpoints. <!-- id: implement-frontend-api -->

## Integration & Verification
- [x] Verify end-to-end flow: User types -> AI parses -> Card shows -> User confirms -> Event created. <!-- id: verify-e2e-flow -->
- [x] Verify error handling and ambiguity resolution. <!-- id: verify-error-handling -->
