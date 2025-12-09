# Design: Import Coze Agent

## Architecture

The integration consists of two parts: **Management (Import)** and **Runtime (Chat)**.

### Management Flow (Import)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant CozeAPI

    User->>Frontend: Open "Import Agent" -> "Coze" Tab
    Frontend->>Backend: GET /console/api/ai-agent/coze/list
    Backend->>CozeAPI: GET /v1/space/published_bots_list (using Env Config)
    CozeAPI-->>Backend: List of Bots
    Backend-->>Frontend: List of Bots
    User->>Frontend: Select Bot & Click "Import"
    Frontend->>Backend: POST /console/api/ai-agent/import/coze { cozeBotId, name, ... }
    Backend->>Backend: Create Agent Record (provider='coze', metadata={bot_id})
    Backend->>Backend: Download Avatar & Sync Basic Info
    Backend-->>Frontend: Success
```

### Runtime Flow (Chat)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant CozeAPI

    User->>Frontend: Send Message
    Frontend->>Backend: POST /api/ai-agent/chat/completions
    Backend->>Backend: Check Agent Provider
    alt Provider is Coze
        Backend->>CozeAPI: POST /v3/chat (Stream)
        loop Stream Chunks
            CozeAPI-->>Backend: SSE Event (delta)
            Backend-->>Frontend: SSE Event (delta)
        end
    else Provider is Native
        Backend->>Backend: Execute Local LLM Chain
    end
```

## Configuration

The backend requires the following environment variables:
- `COZE_API_BASE`: Base URL for Coze API (e.g., `https://api.coze.cn`).
- `COZE_API_TOKEN`: Personal Access Token or OAuth Token.
- `COZE_SPACE_ID`: The specific Space ID to list bots from.

## Data Mapping

When importing, we map basic metadata for display purposes. The execution logic resides in Coze.

| Coze Field | BuildingAI Field | Notes |
| :--- | :--- | :--- |
| `bot_id` | `thirdPartyIntegration.coze.botId` | Stored in JSON metadata/config. |
| `bot_name` | `name` | |
| `description` | `description` | |
| `icon_url` | `avatar` | Downloaded to local storage. |
| - | `model` | Set to a placeholder like `coze-proxy`. |
| - | `prompt` | Not synced (hidden or read-only), as it lives in Coze. |

## Chat Implementation Details

- **Session Management**: Coze requires a `conversation_id` and `user_id`.
    - `user_id`: Map from BuildingAI User ID.
    - `conversation_id`: Map from BuildingAI Chat Session ID.
- **Streaming**: Coze returns SSE events (`conversation.message.delta`, `conversation.message.completed`). We need to parse these and convert them to BuildingAI's standard SSE format to ensure the frontend renders correctly without changes.
- **Inputs**: Coze bots might require additional inputs. For MVP, we map the user's message to the primary input.

## Security

- **Token Storage**: The `COZE_API_TOKEN` is stored in the backend environment, not exposed to the frontend.
- **Access Control**: Only admins or authorized users should be able to list and import bots from the organization's Coze space.
