# Spec: Coze Agent Configuration UI

## ADDED Requirements

### Requirement: Coze Agent Read-Only View
The configuration interface SHALL present a read-only view for agents imported from Coze, preventing modification of logic that resides externally.

#### Scenario: Viewing a Coze Agent
Given I am on the Agent Configuration page
And the agent was imported from Coze (has `cozeBotId`)
Then I should see a "Coze Agent" indicator
And the "Model" and "Prompt" sections should be hidden or read-only
And I should see a link to open the bot in Coze
And I should see a "Sync" button to update details from Coze

### Requirement: Coze Agent Synchronization
Users SHALL be able to synchronize the local agent metadata with the remote Coze bot configuration.

#### Scenario: Syncing Coze Agent
Given I am viewing a Coze Agent
When I click "Sync"
Then the system SHALL fetch the latest metadata from the Coze API, including:
  - Basic Info: name, description, avatar
  - Onboarding: opening statement, suggested questions
  - Configuration: auto-suggestion settings
  - Variables: form fields
And the agent's local details SHALL be updated to match
And a success notification should appear

## MODIFIED Requirements

### Requirement: Standard Agent Configuration
The standard configuration view SHALL remain the default for native agents.

#### Scenario: Standard Agent View
Given I am on the Agent Configuration page
And the agent is a native BuildingAI agent
Then I should see the standard Model, Prompt, and Tool configuration sections (unchanged)
