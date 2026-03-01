# Title: RateLimiter Decorator in LLM Adapter
# What changed
Extracted rate-limiting logic (`GroqRateLimiter`, `GeminiRateLimiter`) from inside the individual provider classes (`GroqProvider`, `GeminiProvider`). Introduced a unified `RateLimiter` interface. Created a `RateLimitedProvider` class (Decorator pattern) that wraps any `LLMProvider` instance and orchestrates the token estimation, rate limiter acquisition, and release automatically. Updated the factory function (`createLLMProvider`) to optionally inject the rate limiters.

# Why it changed
The `llm-adapter.ts` file had high coupling between the core logic of calling an LLM endpoint and the strategy for rate limiting. This violated the Single Responsibility Principle and made it hard to implement new providers or swap limiting strategies. By using the Decorator pattern, rate limiting is now composable and applied externally to the provider.

# Impact (UI / logic / data)
- **Logic**: The providers now only handle building the payload and calling the external APIs. The decorator adds the rate limit constraints transparently.
- **Data**: No changes to the `LLMResponse` payload or data structure.
- **UI**: No impact on the UI.

# Files touched
- `apps/api/src/services/llm-adapter.ts`

# Date
2026-03-01
