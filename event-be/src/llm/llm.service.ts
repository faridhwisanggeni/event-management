import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

export interface ChatCallOptions {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: 'auto' | 'none' | 'required';
  temperature?: number;
}

export interface ChatCallResult {
  completion: ChatCompletion;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY'));
  }

  get chatModel(): string {
    return this.config.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  }

  get embeddingModel(): string {
    return this.config.get<string>('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
  }

  get embeddingDims(): number {
    return Number(this.config.get<string>('OPENAI_EMBEDDING_DIMS') ?? 1536);
  }

  private get timeoutMs(): number {
    return Number(this.config.get<string>('CONCIERGE_LLM_TIMEOUT_MS') ?? 30_000);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.config.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.client = new OpenAI({ apiKey, timeout: this.timeoutMs });
    }
    return this.client;
  }

  async chat(options: ChatCallOptions): Promise<ChatCallResult> {
    const client = this.getClient();
    const start = Date.now();
    const completion = await client.chat.completions.create({
      model: this.chatModel,
      messages: options.messages,
      tools: options.tools,
      tool_choice: options.tools ? options.toolChoice ?? 'auto' : undefined,
      temperature: options.temperature ?? 0.2,
    });
    const latencyMs = Date.now() - start;

    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const toolNames =
      completion.choices[0]?.message?.tool_calls?.map((c) => c.function.name) ?? [];

    this.logger.log({
      msg: 'llm.chat',
      model: this.chatModel,
      latencyMs,
      promptTokens,
      completionTokens,
      toolNames,
    });

    return { completion, latencyMs, promptTokens, completionTokens };
  }

  async embed(input: string): Promise<number[]> {
    const client = this.getClient();
    const start = Date.now();
    const response = await client.embeddings.create({
      model: this.embeddingModel,
      input,
      dimensions: this.embeddingDims,
    });
    const latencyMs = Date.now() - start;

    this.logger.log({
      msg: 'llm.embed',
      model: this.embeddingModel,
      latencyMs,
      promptTokens: response.usage?.prompt_tokens ?? 0,
    });

    return response.data[0].embedding;
  }
}
