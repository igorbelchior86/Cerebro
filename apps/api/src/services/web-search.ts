import { getDefaultLLMProvider } from './llm-adapter.js';

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    source: string;
}

export class WebSearchService {
    /**
     * Search the web for technical documentation and known issues
     */
    async search(query: string): Promise<SearchResult[]> {
        console.log(`[WebSearch] Searching for: ${query}`);

        const tavilyKey = process.env.TAVILY_API_KEY;
        if (tavilyKey) {
            return this.searchTavily(query, tavilyKey);
        }

        // Fallback: Using Gemini Grounding if available via LLM Adapter
        // Or a simplified mock if no external API is configured
        return this.mockSearch(query);
    }

    private async searchTavily(query: string, apiKey: string): Promise<SearchResult[]> {
        try {
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: apiKey,
                    query,
                    search_depth: 'smart',
                    include_answer: true,
                    max_results: 5,
                }),
            });

            if (!response.ok) throw new Error(`Tavily error: ${response.status}`);
            const data = await response.json() as any;

            return (data.results || []).map((r: any) => ({
                title: r.title,
                url: r.url,
                snippet: r.content,
                source: 'tavily',
            }));
        } catch (error) {
            console.error('[WebSearch] Tavily failed:', error);
            return this.mockSearch(query);
        }
    }

    private async mockSearch(query: string): Promise<SearchResult[]> {
        // Basic heuristics for "Self-Search" or localized KB if needed
        // In a real scenario, this would call Gemini with tools enabled
        return [
            {
                title: `Search result for: ${query}`,
                url: 'https://docs.microsoft.com/en-us/search/?terms=' + encodeURIComponent(query),
                snippet: 'External documentation lookup for technical evidence gathering.',
                source: 'external_documentation'
            }
        ];
    }
}

export async function webSearch(query: string): Promise<SearchResult[]> {
    const service = new WebSearchService();
    return service.search(query);
}
