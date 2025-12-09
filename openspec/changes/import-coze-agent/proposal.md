# Import Coze Agent Proposal

## Summary
This proposal introduces the capability to integrate Coze agents into BuildingAI. Instead of copying the configuration, this feature allows users to "link" or "proxy" an existing Coze bot. Users will select a bot from a configured Coze Space (via environment variables), and the system will create a local reference. All chat interactions with this agent in BuildingAI will be forwarded to the Coze API.

## Motivation
Users often maintain complex agents on Coze (using Coze's specific plugins, workflows, and knowledge bases) that cannot be easily replicated by simply copying the prompt. By acting as a proxy, BuildingAI allows users to leverage Coze's native capabilities while managing the agent within the BuildingAI interface.

## Proposed Changes
1.  **Configuration**:
    - Add system-level configuration (Environment Variables) for Coze API access: `COZE_API_TOKEN`, `COZE_SPACE_ID`, `COZE_API_BASE`.

2.  **Frontend**:
    - Update the "Import Agent" dialog (`agent-dsl-import.vue`) to include a "Coze" tab.
    - **List & Select**: Instead of manual ID entry, fetch and display a list of published/draft bots from the configured Coze Space.
    - **Import/Update**: Allow users to select a bot to import (create new) or update (sync metadata of existing linked agent).

3.  **Backend**:
    - **Management API**:
        - `GET /console/api/ai-agent/coze/list`: Fetch bot list from Coze Space.
        - `POST /console/api/ai-agent/import/coze`: Create a local agent record that links to the Coze Bot ID.
    - **Chat Engine**:
        - Modify `AiAgentChatService` to support a new agent mode/provider (e.g., `provider: 'coze'`).
        - When chatting with a Coze-linked agent, bypass local LLM chains and forward the message to Coze's Chat API (v3).
        - Handle streaming responses from Coze and convert them to BuildingAI's stream format.

## Design Details
Please refer to [design.md](./design.md) for architectural details and data mapping strategies.

## Alternatives Considered
- **Full Migration**: Trying to replicate Coze's workflows and plugins locally. This is too complex and prone to feature parity issues. Proxying is more reliable for complex Coze bots.
