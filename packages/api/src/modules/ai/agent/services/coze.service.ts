import { CozeAPI, RoleType } from "@coze/api";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CozeService {
    private readonly logger = new Logger(CozeService.name);
    private client: CozeAPI;
    private spaceId: string;

    constructor(private readonly configService: ConfigService) {
        const token = this.configService.get<string>("COZE_API_TOKEN");
        const baseURL = this.configService.get<string>("COZE_API_BASE") || "https://api.coze.cn";
        this.spaceId = this.configService.get<string>("COZE_SPACE_ID");

        if (token) {
            this.client = new CozeAPI({
                token,
                baseURL,
                allowPersonalAccessTokenInBrowser: false,
            });
        } else {
            this.logger.warn("COZE_API_TOKEN is not configured");
        }
    }

    isConfigured(): boolean {
        return !!this.client && !!this.spaceId;
    }

    async listBots(page = 1, pageSize = 20) {
        if (!this.isConfigured()) {
            throw new Error("Coze API is not configured");
        }

        try {
            // Using the SDK to list published bots in the space
            // Note: The SDK method might differ, assuming standard mapping
            const response = await this.client.bots.listNew({
                workspace_id: this.spaceId,
                page_num: page,
                page_size: pageSize,
                // publish_status: "all",
            });
            return response;
        } catch (error) {
            this.logger.error("Failed to list Coze bots", error);
            throw error;
        }
    }

    async getBot(botId: string) {
        if (!this.isConfigured()) {
            throw new Error("Coze API is not configured");
        }
        try {
            const response = await this.client.bots.retrieve({
                bot_id: botId,
            });
            return response;
        } catch (error) {
            this.logger.error(`Failed to get Coze bot ${botId}`, error);
            throw error;
        }
    }

    async chat(botId: string, userId: string, message: string, conversationId?: string) {
        if (!this.isConfigured()) {
            throw new Error("Coze API is not configured");
        }

        try {
            const stream = await this.client.chat.stream({
                bot_id: botId,
                user_id: userId,
                conversation_id: conversationId,
                additional_messages: [
                    {
                        role: RoleType.User,
                        content: message,
                        content_type: "text",
                    },
                ],
                auto_save_history: true,
            });
            return stream;
        } catch (error) {
            this.logger.error(`Failed to chat with Coze bot ${botId}`, error);
            throw error;
        }
    }
}
