# Import Coze Agent Spec

## ADDED Requirements

#### Requirement: List Coze Bots
The system MUST allow users to view a list of available bots from the configured Coze Space.
- **Scenario**: User opens Coze Import tab
    - Given the system is configured with valid Coze credentials
    - When the user opens the "Coze" tab in the import dialog
    - Then the system fetches and displays a list of bots (name, icon, description) from the Coze Space.

#### Requirement: Import/Link Coze Bot
The system MUST allow users to create a local agent that acts as a proxy to a Coze Bot.
- **Scenario**: Import selected bot
    - Given the user has selected a bot from the list
    - When the user clicks "Import"
    - Then the system creates a new Agent record
    - And stores the `cozeBotId` in the agent's configuration
    - And downloads the avatar and syncs the name/description.

#### Requirement: Proxy Chat to Coze
The system MUST route chat messages for Coze-linked agents to the Coze API.
- **Scenario**: Chatting with Coze Agent
    - Given a user sends a message to an agent linked to Coze
    - When the backend processes the message
    - Then it forwards the message to the Coze Chat API (v3)
    - And streams the response back to the user in the standard BuildingAI format.

#### Requirement: Environment Configuration
The system MUST support configuration of Coze API credentials via environment variables (`COZE_API_TOKEN`, `COZE_SPACE_ID`).
