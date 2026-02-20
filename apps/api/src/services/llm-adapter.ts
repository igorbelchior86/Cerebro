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

interface RateLimitState {
  remainingTokens: number;
  resetTokensAt: number;
  remainingRequests: number;
  resetRequestsAt: number;
}

class GroqRateLimiter {
  private inFlight = 0;
  private lastStart = 0;
  private readonly maxConcurrent = 1;
  private readonly minSpacingMs = 1000; // Back to 1s min, but now header-aware

  private state: RateLimitState = {
    remainingTokens: 30000,
    resetTokensAt: 0,
    remainingRequests: 30,
    resetRequestsAt: 0,
  };

  update(headers: Headers) {
    const remainingTokens = parseInt(headers.get('x-ratelimit-remaining-tokens') || '');
    const resetTokens = headers.get('x-ratelimit-reset-tokens');
    const remainingRequests = parseInt(headers.get('x-ratelimit-remaining-requests') || '');
    const resetRequests = headers.get('x-ratelimit-reset-requests');

    if (!isNaN(remainingTokens)) this.state.remainingTokens = remainingTokens;
    if (resetTokens) {
      // resetTokens is "60s" or "0.5s" or similar occasionally? Or just seconds.
      // Groq usually returns seconds as float/string.
      const seconds = parseFloat(resetTokens.replace('s', ''));
      this.state.resetTokensAt = Date.now() + (seconds * 1000);
    }

    if (!isNaN(remainingRequests)) this.state.remainingRequests = remainingRequests;
    if (resetRequests) {
      const seconds = parseFloat(resetRequests.replace('s', ''));
      this.state.resetRequestsAt = Date.now() + (seconds * 1000);
    }

    if (this.state.remainingTokens < 2000) {
      console.warn(`[Groq] Low tokens remaining: ${this.state.remainingTokens}. Reset in ${Math.round((this.state.resetTokensAt - Date.now()) / 1000)}s`);
    }
  }

  async acquire(estimatedTokens = 1500): Promise<void> {
    return new Promise(resolve => {
      const attempt = () => {
        const now = Date.now();
        const gap = now - this.lastStart;

        // 1. Check Cool-down periods
        if (now < this.state.resetTokensAt && this.state.remainingTokens < estimatedTokens) {
          const wait = this.state.resetTokensAt - now + 100;
          setTimeout(attempt, wait);
          return;
        }

        if (now < this.state.resetRequestsAt && this.state.remainingRequests < 1) {
          const wait = this.state.resetRequestsAt - now + 100;
          setTimeout(attempt, wait);
          return;
        }

        // 2. Standard concurrency/spacing
        if (this.inFlight < this.maxConcurrent && gap >= this.minSpacingMs) {
          this.inFlight++;
          this.lastStart = now;
          resolve();
        } else {
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
  private model = 'llama-3.1-8b-instant'; // Much higher TPM limits on Free Tier than 70b

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY not set in environment');
    }
  }

  /** Exponential backoff with jitter — retries only on 429 / 413. */
  private async withRetry<T>(fn: (attempt: number) => Promise<T>): Promise<T> {
    const MAX_RETRIES = 5;
    const BASE_MS = 2000;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        const msg = (err as Error).message ?? '';
        const is429 = msg.includes('429') || msg.includes('rate_limit');
        const retryable = is429 || msg.includes('413');

        if (attempt === MAX_RETRIES || !retryable) throw err;

        let delay = BASE_MS * Math.pow(2, attempt) + Math.random() * 500;

        // If we have a 429, the error might contain hints or the limiter might have been updated
        if (is429) {
          delay = Math.max(delay, 5000); // Minimum 5s on 429
        }

        console.warn(`[Groq] rate-limited (attempt ${attempt + 1}), retrying in ${Math.round(delay)}ms…`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('[Groq] Max retries exceeded');
  }

  async complete(prompt: string, messages?: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const messageList: Message[] = messages ?? [{ role: 'user', content: prompt }];
    const maxTokens = options?.maxTokens ?? parseInt(process.env.LLM_MAX_TOKENS || '1200', 10);
    const temperature = options?.temperature ?? parseFloat(process.env.LLM_TEMPERATURE || '0.2');

    const estimatedTokens = (JSON.stringify(messageList).length / 4) + maxTokens;
    await groqLimiter.acquire(estimatedTokens);
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

        // Always update limiter state if headers are present
        groqLimiter.update(response.headers);

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
    const maxTokens = options?.maxTokens ?? parseInt(process.env.LLM_MAX_TOKENS || '3000', 10);
    const temperature = options?.temperature ?? parseFloat(process.env.LLM_TEMPERATURE || '0.2');

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
    const maxTokens = options?.maxTokens ?? parseInt(process.env.LLM_MAX_TOKENS || '3000', 10);

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

// ─── Gemini Provider ─────────────────────────────────────────
class GeminiRateLimiter {
  private minuteRequestTimestamps: number[] = [];
  private dayRequestTimestamps: number[] = [];
  private minuteTokenSamples: Array<{ ts: number; tokens: number }> = [];

  private prune(now: number) {
    const minuteAgo = now - 60_000;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    this.minuteRequestTimestamps = this.minuteRequestTimestamps.filter((t) => t > minuteAgo);
    this.dayRequestTimestamps = this.dayRequestTimestamps.filter((t) => t > dayAgo);
    this.minuteTokenSamples = this.minuteTokenSamples.filter((s) => s.ts > minuteAgo);
  }

  async acquire(estimatedInputTokens: number, limits: { rpm: number; rpd: number; tpm: number }) {
    const MAX_WAIT_MS = 30_000;
    const start = Date.now();

    while (true) {
      const now = Date.now();
      this.prune(now);

      const minuteRequests = this.minuteRequestTimestamps.length;
      const dayRequests = this.dayRequestTimestamps.length;
      const minuteTokens = this.minuteTokenSamples.reduce((sum, item) => sum + item.tokens, 0);

      const rpmBlocked = minuteRequests >= limits.rpm;
      const rpdBlocked = dayRequests >= limits.rpd;
      const tpmBlocked = (minuteTokens + estimatedInputTokens) > limits.tpm;

      if (!rpmBlocked && !rpdBlocked && !tpmBlocked) {
        this.minuteRequestTimestamps.push(now);
        this.dayRequestTimestamps.push(now);
        this.minuteTokenSamples.push({ ts: now, tokens: estimatedInputTokens });
        return;
      }

      if (rpdBlocked) {
        throw new Error(`[GeminiLimiter] RPD limit reached (${limits.rpd}/day). Waiting for daily reset.`);
      }

      if (Date.now() - start > MAX_WAIT_MS) {
        throw new Error('[GeminiLimiter] Wait timeout while respecting free-tier limits');
      }

      const waitMs = rpmBlocked ? 1200 : 900;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  recordActualInputTokens(tokens: number) {
    const now = Date.now();
    this.minuteTokenSamples.push({ ts: now, tokens });
    this.prune(now);
  }
}

const geminiLimiter = new GeminiRateLimiter();

class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not set in environment');
    }
  }

  async complete(prompt: string, messages?: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const messageList: Message[] = messages || [
      { role: 'user', content: prompt }
    ];
    const maxTokens = options?.maxTokens ?? parseInt(process.env.LLM_MAX_TOKENS || '3000', 10);
    const temperature = options?.temperature ?? parseFloat(process.env.LLM_TEMPERATURE || '0.2');

    // Convert to Gemini format
    const contents = messageList.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const rpm = parseInt(process.env.GEMINI_LIMIT_RPM || '5', 10);
    const rpd = parseInt(process.env.GEMINI_LIMIT_RPD || '20', 10);
    const tpm = parseInt(process.env.GEMINI_LIMIT_TPM || '250000', 10);
    const retryMax = parseInt(process.env.GEMINI_RETRY_MAX || '2', 10);
    const estimatedInputTokens = Math.max(500, Math.ceil(JSON.stringify(contents).length / 4));

    await geminiLimiter.acquire(estimatedInputTokens, { rpm, rpd, tpm });

    let response: Response | null = null;
    let lastError = '';
    for (let attempt = 0; attempt <= retryMax; attempt++) {
      response = await fetch(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            }
          }),
        }
      );

      if (response.ok) break;
      const bodyText = await response.text();
      lastError = `Gemini API error: ${response.status} - ${bodyText}`;
      if (response.status !== 429 || attempt === retryMax) break;

      const retryMatch = bodyText.match(/retry in\\s+([0-9.]+)s/i);
      const retrySeconds = retryMatch?.[1] ? parseFloat(retryMatch[1]) : NaN;
      const retryMs = Number.isFinite(retrySeconds) ? Math.ceil(retrySeconds * 1000) : (1200 * (attempt + 1));
      await new Promise((r) => setTimeout(r, retryMs));
    }

    if (!response || !response.ok) {
      throw new Error(lastError || 'Gemini API call failed');
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
    };

    if (!data.candidates?.[0]?.content?.parts?.[0]) {
      throw new Error('Invalid response format from Gemini');
    }

    const content = data.candidates[0].content.parts[0].text || '';
    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    geminiLimiter.recordActualInputTokens(inputTokens);

    return {
      content,
      inputTokens,
      outputTokens,
      costUsd: 0, // Free tier
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────
export function createLLMProvider(provider?: string): LLMProvider {
  const selectedProvider =
    provider || process.env.LLM_PROVIDER || 'gemini';

  switch (selectedProvider.toLowerCase()) {
    case 'groq':
      return new GroqProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'minimax':
      return new MinimaxProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(
        `Unknown LLM provider: ${selectedProvider}. Supported: groq, gemini, minimax, anthropic`
      );
  }
}

// ─── Default provider ────────────────────────────────────────
let defaultProvider: LLMProvider | null = null;

export function setDefaultLLMProvider(provider: LLMProvider): void {
  defaultProvider = provider;
}

export function resetDefaultLLMProvider(): void {
  defaultProvider = null;
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
