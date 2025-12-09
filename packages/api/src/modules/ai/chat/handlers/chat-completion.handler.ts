import { getProvider, McpServerHttp, TextGenerator } from "@buildingai/ai-sdk";
import { McpServerSSE } from "@buildingai/ai-sdk/utils/mcp/sse";
import { MCPTool } from "@buildingai/ai-sdk/utils/mcp/type";
import { SecretService } from "@buildingai/core/modules/secret/services/secret.service";
import { AiMcpServer } from "@buildingai/db/entities/ai-mcp-server.entity";
import { AiModel } from "@buildingai/db/entities/ai-model.entity";
import { getProviderSecret } from "@buildingai/utils";
import { Injectable, Logger } from "@nestjs/common";
import type { Response } from "express";
import type {
    ChatCompletionCreateParams,
    ChatCompletionFunctionTool,
    ChatCompletionMessageParam,
} from "openai/resources/index";

import { ToolCallCommandHandler } from "./tool-call.handler";

/**
 * Chat completion result for normal mode
 */
export interface ChatCompletionResult {
    response: any;
    mcpToolCalls: any[];
    usedTools: Set<string>;
}

/**
 * Chat Completion Command Handler
 *
 * Handles AI chat completion logic for both normal and streaming modes.
 */
@Injectable()
export class ChatCompletionCommandHandler {
    private readonly logger = new Logger(ChatCompletionCommandHandler.name);

    constructor(
        private readonly secretService: SecretService,
        private readonly toolCallHandler: ToolCallCommandHandler,
    ) {}

    /**
     * Execute normal (non-streaming) chat completion with tool call support
     *
     * @param params - Execution parameters
     * @returns Chat completion result
     */
    async executeCompletion(params: {
        model: AiModel;
        messages: ChatCompletionMessageParam[];
        tools: ChatCompletionFunctionTool[];
        toolToServerMap: Map<
            string,
            { server: AiMcpServer; tool: MCPTool; mcpServer: McpServerSSE | McpServerHttp }
        >;
    }): Promise<ChatCompletionResult> {
        const { model, messages, tools, toolToServerMap } = params;

        const provider = await this.getProvider(model);
        const client = new TextGenerator(provider);
        const opts = this.buildModelOptions(model);

        let currentMessages = [...messages];
        let finalResponse: any = null;
        let hasToolCalls = false;
        const mcpToolCalls: any[] = [];
        const usedTools = new Set<string>();

        // Tool call loop
        do {
            hasToolCalls = false;

            const chatParams: ChatCompletionCreateParams = {
                model: model.model,
                messages: currentMessages,
                ...opts,
            };

            if (tools.length > 0) {
                chatParams.tools = tools;
                chatParams.tool_choice = "auto";
            }

            // Call AI service
            const response = await client.chat.create(chatParams);
            finalResponse = response;

            // Check for tool calls
            const assistantMessage = response.choices[0].message;
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                hasToolCalls = true;

                // Add AI response to messages
                currentMessages.push(assistantMessage);

                // Execute tool calls
                const { results, usedToolNames } = await this.toolCallHandler.executeToolCalls(
                    assistantMessage.tool_calls,
                    toolToServerMap,
                );

                // Track used tools
                usedToolNames.forEach((toolName) => usedTools.add(toolName));

                // Add tool results to messages and collect mcp tool calls
                for (let i = 0; i < results.length; i++) {
                    const result = results[i];
                    const toolCall = assistantMessage.tool_calls[i];

                    const toolContent = JSON.stringify(result.toolResult);
                    this.logger.debug(
                        `📥 工具结果添加到消息列表: ${toolContent.substring(0, 200)}...`,
                    );

                    currentMessages.push({
                        role: "tool",
                        content: toolContent,
                        tool_call_id: toolCall.id,
                    });

                    if (result.mcpToolCall) {
                        mcpToolCalls.push(result.mcpToolCall);
                    }
                }

                this.logger.debug(
                    `🔄 工具调用完成，继续下一轮 AI 调用，当前消息数: ${currentMessages.length}`,
                );
            } else {
                this.logger.debug(
                    `✅ AI 返回最终回答（无工具调用）: ${assistantMessage.content?.substring(0, 100)}...`,
                );
            }
        } while (hasToolCalls);

        this.logger.debug(
            `🎯 聊天完成，总轮数: ${mcpToolCalls.length > 0 ? "使用了工具" : "未使用工具"}, 最终响应长度: ${finalResponse.choices[0].message.content?.length || 0}`,
        );

        return {
            response: finalResponse,
            mcpToolCalls,
            usedTools,
        };
    }

    /**
     * Execute streaming chat completion with tool call support
     *
     * @param params - Execution parameters
     * @param res - Express response object for SSE
     */
    async executeStreamCompletion(
        params: {
            model: AiModel;
            messages: ChatCompletionMessageParam[];
            tools: ChatCompletionFunctionTool[];
            toolToServerMap: Map<
                string,
                { server: AiMcpServer; tool: MCPTool; mcpServer: McpServerSSE | McpServerHttp }
            >;
        },
        res: Response,
    ): Promise<{
        fullResponse: string;
        finalChatCompletion: any;
        mcpToolCalls: any[];
        usedTools: Set<string>;
        reasoningContent: string;
        reasoningStartTime: number | null;
        reasoningEndTime: number | null;
    }> {
        const { model, messages, tools, toolToServerMap } = params;

        const provider = await this.getProvider(model);
        const client = new TextGenerator(provider);
        const opts = this.buildModelOptions(model);

        let currentMessages = [...messages];
        let fullResponse = "";
        let finalChatCompletion: any = null;
        let hasToolCalls = false;
        const mcpToolCalls: any[] = [];
        const usedTools = new Set<string>();
        let reasoningContent = "";
        let reasoningStartTime: number | null = null;
        let reasoningEndTime: number | null = null;
        let roundCount = 0;

        // Tool call loop
        do {
            hasToolCalls = false;
            roundCount++;
            this.logger.debug(
                `🔄 开始第 ${roundCount} 轮 AI 调用，消息数: ${currentMessages.length}`,
            );

            const chatParams: ChatCompletionCreateParams = {
                model: model.model,
                messages: currentMessages,
                ...opts,
            };

            if (tools.length > 0) {
                chatParams.tools = tools;
                chatParams.tool_choice = "auto";
            }

            const stream = await client.chat.stream(chatParams);

            let roundResponse = "";
            // Stream processing
            for await (const chunk of stream) {
                // Send content chunks
                if (chunk.choices[0].delta.content) {
                    res.write(
                        `data: ${JSON.stringify({
                            type: "chunk",
                            data: chunk.choices[0].delta.content,
                        })}\n\n`,
                    );
                    roundResponse += chunk.choices[0].delta.content;
                    fullResponse += chunk.choices[0].delta.content;
                }

                // Handle reasoning content (e.g., DeepSeek models)
                if (chunk.choices[0].delta?.reasoning_content) {
                    if (!reasoningStartTime) {
                        reasoningStartTime = Date.now();
                    }
                    reasoningEndTime = Date.now();
                    reasoningContent += chunk.choices[0].delta.reasoning_content;
                    res.write(
                        `data: ${JSON.stringify({
                            type: "reasoning",
                            data: chunk.choices[0].delta.reasoning_content,
                        })}\n\n`,
                    );
                }

                // Handle tool call detection (streaming hint)
                if (chunk.choices[0].delta?.tool_calls) {
                    const toolCalls = chunk.choices[0].delta.tool_calls;
                    for (const toolCall of toolCalls) {
                        if (toolCall.type !== "function") continue;

                        if (toolCall.function?.name) {
                            const mcpServerUsed = toolToServerMap.get(toolCall.function.name);

                            res.write(
                                `data: ${JSON.stringify({
                                    type: "mcp_tool_detected",
                                    data: {
                                        id: toolCall.id,
                                        mcpServer: mcpServerUsed?.server,
                                        tool: mcpServerUsed?.tool,
                                        error: null,
                                        input: null,
                                        output: null,
                                        timestamp: null,
                                        status: "success",
                                        duration: null,
                                    },
                                })}\n\n`,
                            );
                        }
                    }
                }
            }

            if (roundResponse) {
                this.logger.debug(
                    `📝 第 ${roundCount} 轮响应内容: ${roundResponse.substring(0, 100)}...`,
                );
            }

            finalChatCompletion = await stream.finalChatCompletion();

            // Check for tool calls
            const assistantMessage = finalChatCompletion.choices[0].message;
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                hasToolCalls = true;
                this.logger.debug(
                    `🔧 第 ${roundCount} 轮检测到 ${assistantMessage.tool_calls.length} 个工具调用`,
                );

                // Add AI response to messages (remove reasoning_content to avoid sending in tool calls)
                const cleanAssistantMessage = {
                    ...assistantMessage,
                    reasoning_content: undefined,
                };
                currentMessages.push(cleanAssistantMessage);

                // Execute each tool call
                for (const toolCall of assistantMessage.tool_calls) {
                    if (toolCall.type !== "function") continue;

                    const mcpServerUsed = toolToServerMap.get(toolCall.function.name);
                    const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

                    // Send tool start status
                    res.write(
                        `data: ${JSON.stringify({
                            type: "mcp_tool_start",
                            data: {
                                id: toolCall.id,
                                mcpServer: mcpServerUsed?.server,
                                tool: mcpServerUsed?.tool,
                                error: null,
                                input: toolArgs,
                                output: null,
                                timestamp: null,
                                status: "success",
                                duration: null,
                            },
                        })}\n\n`,
                    );

                    // Execute tool call
                    const result = await this.toolCallHandler.executeToolCall(
                        toolCall,
                        toolToServerMap,
                    );

                    if (result.mcpToolCall) {
                        mcpToolCalls.push(result.mcpToolCall);

                        if (result.mcpToolCall.status === "success") {
                            usedTools.add(toolCall.function.name);

                            // Send tool result
                            res.write(
                                `data: ${JSON.stringify({
                                    type: "mcp_tool_result",
                                    data: result.mcpToolCall,
                                })}\n\n`,
                            );
                        } else {
                            // Send tool error
                            res.write(
                                `data: ${JSON.stringify({
                                    type: "mcp_tool_error",
                                    data: result.mcpToolCall,
                                })}\n\n`,
                            );
                        }
                    }

                    // Add tool result to messages
                    const toolContent = JSON.stringify(result.toolResult);
                    this.logger.debug(
                        `📥 工具 ${toolCall.function.name} 结果添加到消息列表: ${toolContent.substring(0, 200)}...`,
                    );

                    currentMessages.push({
                        role: "tool",
                        content: toolContent,
                        tool_call_id: toolCall.id,
                    });
                }
            } else {
                this.logger.debug(`✅ 第 ${roundCount} 轮返回最终回答（无工具调用）`);
            }
        } while (hasToolCalls);

        this.logger.debug(
            `🎯 流式聊天完成，共 ${roundCount} 轮，最终响应长度: ${fullResponse.length}`,
        );

        return {
            fullResponse,
            finalChatCompletion,
            mcpToolCalls,
            usedTools,
            reasoningContent,
            reasoningStartTime,
            reasoningEndTime,
        };
    }

    /**
     * Get provider instance with secrets
     *
     * @param model - AI Model
     * @returns Provider instance
     */
    private async getProvider(model: AiModel) {
        const providerSecret = await this.secretService.getConfigKeyValuePairs(
            model.provider.bindSecretId,
        );

        return getProvider(model.provider.provider, {
            apiKey: getProviderSecret("apiKey", providerSecret),
            baseURL: getProviderSecret("baseUrl", providerSecret),
        });
    }

    /**
     * Build model options from model config
     *
     * @param model - AI Model
     * @returns Model options object
     */
    private buildModelOptions(model: AiModel): Record<string, any> {
        // modelConfig 是数组，需要转换为对象
        if (!model.modelConfig || !Array.isArray(model.modelConfig)) {
            this.logger.debug("🔧 模型配置参数: {} (无配置或格式错误)");
            return {};
        }

        const opts = model.modelConfig
            .filter((item) => item.enable && item.field) // 过滤启用的配置并确保 field 存在
            .map((item) => {
                let fieldName = item.field;
                let fieldValue = item.value;

                // 移除字段名中多余的引号
                if (fieldName.startsWith('"') && fieldName.endsWith('"')) {
                    fieldName = fieldName.slice(1, -1);
                }

                // 处理特殊值类型
                if (fieldValue === null) {
                    // 对于 null 值，跳过该参数（除非是明确需要 null 的参数）
                    return null;
                }

                // 尝试解析 JSON 字符串值
                if (
                    typeof fieldValue === "string" &&
                    (fieldValue.startsWith("{") || fieldValue.startsWith("["))
                ) {
                    try {
                        fieldValue = JSON.parse(fieldValue);
                    } catch (e) {
                        // 解析失败时保持原字符串值
                        this.logger.debug(`⚠️ 无法解析参数值 ${fieldName}: ${fieldValue} ${e}`);
                    }
                }

                return {
                    [fieldName]: fieldValue,
                };
            })
            .filter((item) => item !== null); // 移除 null 条目

        const result = Object.assign({}, ...opts);
        this.logger.debug(`🔧 模型配置参数: ${JSON.stringify(result)}`);

        return result;
    }
}
