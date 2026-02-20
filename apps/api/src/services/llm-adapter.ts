// ─────────────────────────────────────────────────────────────
// LLM Adapter — Support for multiple providers
// Easily switch between Groq, Anthropic, OpenAI, Minimax, etc.
// ─────────────────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface LLMOptions {
  /** Override max_tokens for this call (useful for low-output tasks like tool planning). */
  maxTokens?: number;
  /** Override temperature. */
  temperature?: number;
}

export interface LLMProvider {
  name: string;
  complete(prompt: string, messages?: Message[], options?: LLMOptions): Promise<LLMResponse>;
}

// ─── Groq rate-limiter (singleton) ────────────────────────────
// Caps to 1 concurrent in-flight request and enforces 400ms minimum
// spacing between starts to avoid triggering burst/concurrency limits.
class GroqRateLimiter {
  private inFlight = 0;
  private lastStart = 0;
  private readonly maxConcurrent = 1;
  private readonly minSpacingMs = 400;

  async acquire(): Promise<void> {
    return new Promise(resolve => {
      const attempt = () => {
        const gap = Date.now() - this.lastStart;
        if (this.inFlight < this.maxConcurrent && gap >= this.minSpacingMs) {
          this.inFlight++;
          this.lastStart = Date.now();
          resolve();
        } else {
          // Wait for whichever constraint clears first, plus small jitter
          const waitMs = Math.max(this.minSpacingMs - gap, 50) + Math.random() * 80;
          setTimeout(attempt, waitMs);
        }
      };
      attempt();
    });
  }

  release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }
}

const groqLimiter = new GroqRateLimiter();

// ─── Groq Provider ───────────────────────────────────────────
class GroqProvider implements LLMProvider {
  name = 'groq';
  private apiKey: string;
  private baseUrl = 'https://api.groq.com/openai/v1';
  private model = 'llama-3.3-70b-versatile'; // Latest model (previous versions decommissioned)

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY not set in environment');
    }
  }

  /** Exponential backoff with jitter — retries only on 429 / 413. */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 4;
    const BASE_MS = 600;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const msg = (err as Error).message ?? '';
        const retryable = msg.includes('429') || msg.includes('rate_limit') || msg.includes('413');
        if (attempt === MAX_RETRIES || !retryable) throw err;
        // 600ms * 2^attempt (0→600 1→1200 2→2400 3→4800) + up to 500ms jitter
        const delay = BASE_MS * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`[Groq] rate-limited (attempt ${attempt + 1}), retrying in ${Math.round(delay)}ms…`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('[Groq] Max retries exceeded');
  }

  async complete(prompt: string, messages?: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const messageList: Message[] = messages ?? [{ role: 'user', content: prompt }];
    const maxTokens = options?.maxTokens ?? 2000;
    const temperature = options?.temperature ?? 0.7;

    await groqLimiter.acquire();
    try {
      return await this.withRetry(async () => {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: messageList,
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Groq API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content: string } }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        if (!data.choices?.[0] || !data.usage) {
          throw new Error('Invalid response format from Groq');
        }

        return {
          content: data.choices[0].message?.content ?? '',
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          costUsd: 0,
        };
      });
    } finally {
      groqLimiter.release();
    }
  }
}

// ─── Minimax M2.5 Provider ──────────────────────────────────
class MinimaxProvider implements LLMProvider {
  name = 'minimax';
  private apiKey: string;
  private baseUrl = 'https://api.minimax.chat/v1';
  private model = 'abab6.5t'; // Minimax M2.5 or latest

  constructor() {
    this.apiKey = process.env.MINIMAX_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('MINIMAX_API_KEY not set in environment');
    }
  }

  async complete(prompt: string, messages?: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const messageList: Message[] = messages || [
      { role: 'user', content: prompt },
    ];
    const maxTokens = options?.maxTokens ?? 3000;
    const temperature = options?.temperature ?? 0.7;

    const response = await fetch(`${this.baseUrl}/text/chatcompletion`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messageList,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Minimax API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content: string } }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    if (!data.choices || !data.choices[0] || !data.usage) {
      throw new Error('Invalid response format from Minimax');
    }

    const content = data.choices[0].message?.content || '';
    const inputTokens = data.usage.input_tokens || 0;
    const outputTokens = data.usage.output_tokens || 0;

    // Minimax pricing: ~$0.0015 per 1K input tokens, ~$0.004 per 1K output tokens
    const costUsd =
      (inputTokens / 1000) * 0.0015 + (outputTokens / 1000) * 0.004;

    return {
      content,
      inputTokens,
      outputTokens,
      costUsd: parseFloat(costUsd.toFixed(6)),
    };
  }
}

// ─── Anthropic Provider (for when you have API key) ──────────
class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';
  private model = 'claude-3-5-sonnet-20241022';

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set in environment');
    }
  }

  async complete(prompt: string, messages?: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const messageList: Message[] = messages || [
      { role: 'user', content: prompt },
    ];
    const maxTokens = options?.maxTokens ?? 3000;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: messageList,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    if (!data.content || !data.usage) {
      throw new Error('Invalid response format from Anthropic');
    }

    const content = data.content.find((c) => c.type === 'text')?.text || '';
    const inputTokens = data.usage.input_tokens || 0;
    const outputTokens = data.usage.output_tokens || 0;

    // Claude 3.5 Sonnet: $3 per 1M input, $15 per 1M output
    const costUsd =
      (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

    return {
      content,
      inputTokens,
      outputTokens,
      costUsd: parseFloat(costUsd.toFixed(6)),
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────
export function createLLMProvider(provider?: string): LLMProvider {
  const selectedProvider =
    provider || process.env.LLM_PROVIDER || 'groq';

  switch (selectedProvider.toLowerCase()) {
    case 'groq':
      return new GroqProvider();
    case 'minimax':
      return new MinimaxProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(
        `Unknown LLM provider: ${selectedProvider}. Supported: groq, minimax, anthropic`
      );
  }
}

// ─── Default provider ────────────────────────────────────────
let defaultProvider: LLMProvider | null = null;

export function setDefaultLLMProvider(provider: LLMProvider): void {
  defaultProvider = provider;
}

export function getDefaultLLMProvider(): LLMProvider {
  if (!defaultProvider) {
    defaultProvider = createLLMProvider();
  }
  return defaultProvider;
}

/**
 * Quick helper to call LLM
 */
export async function callLLM(prompt: string, provider?: string): Promise<LLMResponse> {
  const llm = provider
    ? createLLMProvider(provider)
    : getDefaultLLMProvider();
  return llm.complete(prompt);
}
