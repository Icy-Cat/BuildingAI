import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

// 顾客订单格式
interface AgentChatDto {
  userMessage: string;
  userId?: string;
}

// 后厨回复格式
interface CozeResponse {
  code: number;
  msg: string;
  data: {
    messages: Array<{
      role: 'assistant' | 'user';
      content: string;
    }>;
  };
}

@Injectable()
export class AgentService {
  private readonly cozeApiKey: string;
  private readonly cozeAgentId: string;
  private readonly cozeBaseUrl: string;
  private readonly cozeChatEndpoint: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // 读取配置
    this.cozeApiKey = this.configService.get<string>('COZE_API_KEY');
    this.cozeAgentId = this.configService.get<string>('COZE_AGENT_ID');
    this.cozeBaseUrl = this.configService.get<string>('COZE_API_BASE_URL');
    this.cozeChatEndpoint = this.configService.get<string>('COZE_CHAT_ENDPOINT');

    // 检查凭证是否齐全
    if (!this.cozeApiKey || !this.cozeAgentId || !this.cozeBaseUrl || !this.cozeChatEndpoint) {
      throw new Error('Coze 凭证没准备好！请检查 .env 文件中的 COZE_API_BASE_URL, COZE_CHAT_ENDPOINT 等配置');
    }
  }

  // 核心工作流程
  async chatWithAgent(dto: AgentChatDto): Promise<string> {
    try {
      // 1. 整理订单格式
      const requestData = {
        agent_id: this.cozeAgentId,
        user: dto.userId ? { user_id: dto.userId } : { user_id: 'default_user' },
        messages: [{ role: 'user', content: dto.userMessage }],
        stream: false,
      };
      
      // 修复：确保拼接后的 URL 是完整的 Coze API 地址
      const fullCozeUrl = `${this.cozeBaseUrl}${this.cozeChatEndpoint}`;

      // 2. 打电话给后厨（调用 Coze API）
      const response = await firstValueFrom(
        this.httpService.post<CozeResponse>(fullCozeUrl, requestData, {
          headers: {
            'Authorization': `Bearer ${this.cozeApiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      // 3. 处理后厨回复
      const cozeData = response.data;
      if (cozeData.code !== 0) {
        throw new Error(`后厨说：${cozeData.msg}`);
      }

      // 4. 提取菜品
      const agentReply = cozeData.data.messages.findLast(
        (msg) => msg.role === 'assistant',
      );

      return agentReply?.content || '后厨暂时没回复～';
    } catch (error) {
      console.error('对接后厨失败：', error);
      throw new HttpException(
        '调用 AI 助手失败，请稍后重试',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}