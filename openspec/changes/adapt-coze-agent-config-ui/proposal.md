# Adapt Coze Agent Configuration UI

## Summary
This proposal aims to adapt the Agent Configuration (Orchestration) interface for agents imported from Coze. Since the logic and configuration of these agents are managed on the Coze platform, the local interface should reflect this by disabling incompatible settings (like prompt editing and model selection) and providing Coze-specific controls (like synchronization and deep links).

## Motivation
Currently, when a user imports a Coze agent, the configuration interface might still show the standard controls for native agents (Prompt, Model, Tools). This is misleading because changes made locally might not propagate to Coze, or might be overwritten. Users need a clear indication that this is a "Coze Proxy" agent and should be directed to Coze for core logic changes.

## Proposed Changes

### Frontend
1.  **Agent Configuration Page (`agent-configuration.vue`)**:
    -   **Detection**: Check if the agent has a `provider` or `thirdPartyIntegration` type of 'coze'.
    -   **Read-Only Mode**: If it is a Coze agent:
        -   Hide or disable the **Model Selection** dropdown.
        -   Hide or disable the **Prompt/Persona** editor.
        -   Hide or disable **Knowledge Base** and **Tools** selection (unless we support hybrid mode, but assuming pure proxy for now).
    -   **Coze Info Panel**:
        -   Display the **Coze Bot ID**.
        -   Provide a **"Edit in Coze"** link (external).
        -   Add a **"Sync"** button to re-fetch metadata (name, description, avatar) from Coze.

### Backend
-   No major backend changes expected, assuming the `sync` endpoint already exists or the `import` endpoint can be reused for updates. If not, ensure `POST /console/api/ai-agent/import/coze` handles updates for existing agents.

## Design Details
See `design.md` (if needed, but this is primarily a UI state change).

## Alternatives Considered
-   **Two-way Sync**: Allowing users to edit prompts locally and push to Coze. This is complex due to API limitations and versioning on Coze's side. Read-only + Link is safer.
