export interface ScheduleSchemaDefinition {
    name: string;
    strict: boolean;
    schema: Record<string, any>;
    summary: string;
}

const SCHEMA_NAME = "buildingai_schedule_response";

/**
 * Builds the JSON Schema contract that the AI schedule assistant must follow.
 * The timezone gets injected at runtime so providers can rely on a concrete default.
 */
export function buildScheduleResponseSchema(timezone: string): ScheduleSchemaDefinition {
    const schema = {
        type: "object",
        additionalProperties: false,
        required: ["reply", "intent"],
        properties: {
            reply: {
                type: "string",
                description: "Friendly acknowledgement that can be shown to the user.",
                minLength: 1,
            },
            intent: {
                type: "string",
                description: "User intent that determines which schedule action to perform.",
                enum: ["create", "update", "delete", "query"],
            },
            confidence: {
                type: "number",
                description: "Confidence score for the detected intent (0-1).",
                minimum: 0,
                maximum: 1,
            },
            follow_up_question: {
                type: ["string", "null"],
                description: "Clarifying question that must be provided whenever information is missing.",
            },
            missing_fields: {
                type: "array",
                description: "Names of required fields that are missing from the user input (only title is required).",
                items: {
                    type: "string",
                    enum: ["title"],
                },
                uniqueItems: true,
            },
            target_event_id: {
                type: ["string", "null"],
                description: "Target schedule id that must be set for update/delete intents.",
            },
            proposal: {
                type: "object",
                description: "Structured payload for the proposed schedule change.",
                additionalProperties: false,
                properties: {
                    title: { type: "string", description: "Schedule title." },
                    description: { type: "string", description: "Additional context or description." },
                    startTime: {
                        type: "string",
                        format: "date-time",
                        description: "ISO8601 timestamp for the start of the event.",
                    },
                    endTime: {
                        type: "string",
                        format: "date-time",
                        description: "ISO8601 timestamp for the end of the event.",
                    },
                    location: { type: "string", description: "Optional location hints if available." },
                    attendees: { type: "string", description: "Comma separated attendee names or emails." },
                    category: {
                        type: "string",
                        enum: ["work", "personal", "meeting", "reminder"],
                        description: "High-level category for the event.",
                    },
                    priority: {
                        type: "string",
                        enum: ["high", "medium", "low", "none"],
                        description:
                            'Optional priority indicator. Use "none" when the user explicitly says no priority.',
                    },
                    isImportant: { type: "boolean", description: "Marks if the task is important." },
                    isUrgent: { type: "boolean", description: "Marks if the task is urgent." },
                    timezone: {
                        type: "string",
                        description:
                            "Timezone used for start/end time parsing. Defaults to the user's timezone when omitted.",
                        default: timezone,
                    },
                    completed: { type: "boolean", description: "Marks whether the schedule entry is already done." },
                    metadata: {
                        type: "object",
                        description: "Optional metadata map, can contain any serialisable key/value pairs.",
                        additionalProperties: true,
                    },
                },
            },
        },
    };

    const summary = [
        "- reply: friendly acknowledgement shown to the end user.",
        '- intent: "create" | "update" | "delete" | "query".',
        "- proposal: structured payload mirroring the calendar entry (title, optional start/end times, category, etc.).",
        "- missing_fields: only used when the title is missing. All other fields are optional and should be omitted if unknown.",
        "- follow_up_question: clarifying question tied to missing_fields or null.",
        "- target_event_id: existing schedule id required for update/delete intents or null.",
        `- proposal.timezone defaults to ${timezone} when unspecified so timestamps can be normalised.`,
    ].join("\n");

    return {
        name: SCHEMA_NAME,
        strict: true,
        schema,
        summary,
    };
}
