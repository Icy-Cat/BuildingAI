/**
 * @fileoverview Console API service functions for AI schedule assistant
 * @description Provide helper methods to manage AI schedule configuration from the console
 *
 * @author BuildingAI
 */

/**
 * Schedule assistant configuration
 * @description Settings used by the AI schedule parser
 */
export interface ScheduleConfig {
    /** AI model used to parse schedule instructions */
    modelId?: string;
    /** Temperature value for the LLM request */
    temperature?: number;
    /** Custom system prompt template */
    systemPrompt?: string;
    /** Number of historical events injected as context */
    contextLimit?: number;
}

/**
 * Get current schedule assistant configuration
 * @returns Promise with configuration payload
 */
export function apiGetScheduleConfig(): Promise<ScheduleConfig> {
    return useConsoleGet("/user-schedule/config");
}

/**
 * Update schedule assistant configuration
 * @param data Partial configuration payload
 * @returns Promise with success flag
 */
export function apiUpdateScheduleConfig(data: ScheduleConfig): Promise<{ success: boolean }> {
    return useConsolePost("/user-schedule/config", data);
}
