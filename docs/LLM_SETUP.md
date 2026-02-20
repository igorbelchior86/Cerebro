# LLM Setup — Groq, Minimax & Anthropic

## Quick Start (Free Groq)

### 1. Get your Groq API Key

1. Go to <https://console.groq.com>
2. Sign up (completely free, no credit card needed)
3. Copy your API key
4. Add to your `.env`:

```bash
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here
```

### 2. That's it

The DiagnoseService will automatically use Groq for all LLM calls.

---

## Supported Providers

### Groq (Recommended for Free Usage)

- **Cost**: Free (no limits currently)
- **Speed**: Ultra-fast (50+ tokens/sec)
- **Model Used**: llama-3.1-70b-versatile
- **Setup**:

  ```bash
  LLM_PROVIDER=groq
  GROQ_API_KEY=gsk_...
  ```

- **Get key**: <https://console.groq.com>

### Minimax M2.5

- **Cost**: ~$0.0015 per 1K input tokens, ~$0.004 per 1K output
- **Speed**: Good
- **Model Used**: abab6.5t (M2.5 or latest)
- **Setup**:

  ```bash
  LLM_PROVIDER=minimax
  MINIMAX_API_KEY=sk_...
  ```

- **Get key**: <https://platform.minimaxi.com>
- **Free Tier**: Yes, available

### Anthropic Claude (Paid)

- **Cost**: $3 per 1M input tokens, $15 per 1M output tokens
- **Speed**: Good
- **Model Used**: claude-3-5-sonnet-20241022
- **Setup**:

  ```bash
  LLM_PROVIDER=anthropic
  ANTHROPIC_API_KEY=sk-ant-...
  ```

- **Get key**: <https://console.anthropic.com>

---

## How to Switch Providers

Simply change the `LLM_PROVIDER` env variable:

```bash
# Switch to Minimax
export LLM_PROVIDER=minimax

# Switch to Anthropic
export LLM_PROVIDER=anthropic

# Back to Groq
export LLM_PROVIDER=groq
```

Or set in your `.env` file:

```
LLM_PROVIDER=groq
```

The adapter will automatically use the correct API with the corresponding API key.

---

## Groq vs Minimax vs Anthropic

| Feature | Groq | Minimax | Anthropic |
|---------|------|---------|-----------|
| **Cost** | Free | Free tier + paid | Paid only |
| **Speed** | ⚡ Fastest | ⚡ Fast | 🟡 Good |
| **Accuracy** | 🟢 Good | 🟢 Good | 🟢 Excellent |
| **API Setup** | REST | REST | REST |
| **No Credit Card** | ✅ | ✅ | ❌ |

**Recommendation**: Start with **Groq** (free, fast, no credit card). Switch to **Minimax** if you need more credits, or **Anthropic** for highest quality.

---

## Testing Your Setup

Once you've configured your LLM provider:

```bash
# Start the development server
pnpm dev

# Call the diagnose endpoint
curl -X POST http://localhost:3001/diagnose \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-session"}'
```

If the response includes valid diagnosis with token counts and cost, you're good to go!

---

## Code Example

```typescript
import { getDefaultLLMProvider } from './services/llm-adapter.js';

// Use whatever LLM is configured
const llm = getDefaultLLMProvider();
const response = await llm.complete(yourPrompt);

console.log(`Tokens: ${response.inputTokens} input, ${response.outputTokens} output`);
console.log(`Cost: $${response.costUsd}`);
console.log(`Response: ${response.content}`);
```

---

## Adding New LLM Providers

To add a new provider (e.g., OpenAI, Together AI, DeepSeek):

1. Create a new class in `apps/api/src/services/llm-adapter.ts` implementing `LLMProvider`
2. Add to the factory function's switch statement
3. Add the API key to `env.example`
4. Done!

Example:

```typescript
class OpenAIProvider implements LLMProvider {
  name = 'openai';
  async complete(prompt: string): Promise<LLMResponse> {
    // Your OpenAI API call here
  }
}
```

---

## Troubleshooting

### "API key not set"

- Make sure you've added the API key to `.env` with the correct env variable name
- Current variable depends on provider:
  - Groq: `GROQ_API_KEY`
  - Minimax: `MINIMAX_API_KEY`
  - Anthropic: `ANTHROPIC_API_KEY`

### "Invalid response format"

- Check that the API key is valid
- Ensure network connectivity
- Try a different provider to isolate the issue

### Slow responses

- Groq is fastest (~50 tokens/sec)
- Minimax is good (~30-40 tokens/sec)
- Consider switching to Groq if on another provider
