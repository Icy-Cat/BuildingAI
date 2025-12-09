# Design: Adapt Coze Agent Configuration UI

## Coze Metadata Synchronization

To ensure the local agent representation matches the Coze bot, we will use the Coze Open API to fetch metadata.

### API Usage
We will use the `GET /v1/bot/retrieve` (or SDK equivalent `bots.retrieve`) endpoint to fetch the latest configuration of the bot.
Reference: [Get Bot Metadata](https://www.coze.cn/open/docs/developer_guides/get_metadata_draft_published)

### Data Mapping
When syncing, the following fields will be updated in the local `Agent` entity:

| Coze Field | Local Agent Field | Notes |
| :--- | :--- | :--- |
| `name` | `name` | |
| `description` | `description` | |
| `icon_url` | `avatar` | |
| `bot_id` | `thirdPartyIntegration.coze.botId` | Should match, used for verification |
| `onboarding_info.prologue` | `openingStatement` | Opening speech |
| `onboarding_info.suggested_questions` | `openingQuestions` | List of suggested questions |
| `model_info.suggested_questions_after_answer.enabled` | `autoQuestions.enabled` | Auto follow-up enabled status |
| `user_input_form` | `formFields` | Form variables (needs transformation) |

### Sync Flow
1.  User clicks "Sync" in the UI.
2.  Frontend calls `POST /console/api/ai-agent/:id/sync-coze`.
3.  Backend:
    *   Retrieves the agent and checks for `cozeBotId`.
    *   Calls `CozeService.getBot(cozeBotId)`.
    *   Updates the agent's `name`, `description`, and `avatar` with the response data.
    *   Updates `openingStatement` from `onboarding_info.prologue`.
    *   Updates `openingQuestions` from `onboarding_info.suggested_questions`.
    *   Updates `autoQuestions` from `model_info.suggested_questions_after_answer`.
    *   Updates `formFields` from `user_input_form` (transforming Coze format to BuildingAI format).
    *   Returns the updated agent.
4.  Frontend updates the display.
