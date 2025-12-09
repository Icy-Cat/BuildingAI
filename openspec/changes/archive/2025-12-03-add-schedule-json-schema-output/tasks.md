## 1. Implementation
- [x] 1.1 Capture provider capability needs (which adapters allow `response_format`) and decide how to gate the feature.
- [x] 1.2 Implement a reusable JSON Schema builder for the schedule reply payload and expose it to the AI schedule service.
- [x] 1.3 Update `AiScheduleService.parse` to append the schema-based `response_format` when the current model supports it, with structured logging for fallback paths.
- [x] 1.4 Simplify the system prompt / config to reference the schema contract so it cannot drift from the actual builder output.
- [x] 1.5 Cover the new logic with tests (unit/service) verifying both schema-enabled and fallback behaviours.
- [x] 1.6 Document the new capability flag/environment knob so operators know how to enable/disable schema enforcement.
