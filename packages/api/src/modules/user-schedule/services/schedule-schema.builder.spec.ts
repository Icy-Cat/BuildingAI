import { buildScheduleResponseSchema } from "./schedule-schema.builder";

describe("buildScheduleResponseSchema", () => {
    it("injects timezone defaults into the schema contract", () => {
        const schema = buildScheduleResponseSchema("UTC");
        const timezoneProperty =
            schema.schema.properties.proposal.properties.timezone;

        expect(schema.name).toBe("buildingai_schedule_response");
        expect(timezoneProperty.default).toBe("UTC");
        expect(schema.summary).toContain("UTC");
    });

    it("exposes relaxed required fields and new priority options", () => {
        const schema = buildScheduleResponseSchema("UTC");
        const missingFieldsEnum =
            schema.schema.properties.missing_fields.items.enum;
        const priorityEnum =
            schema.schema.properties.proposal.properties.priority.enum;

        expect(missingFieldsEnum).toEqual(["title"]);
        expect(priorityEnum).toEqual(["high", "medium", "low", "none"]);
    });
});
