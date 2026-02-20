## Lesson: 2026-02-19
**Mistake**: Hand-rolling generic SVG paths for semantic icons (like the Moon in the theme toggle).
**Root cause**: Tried to construct an SVG from memory/scratch instead of pulling from a premium, battle-tested icon set like Heroicons, Radix, or Lucide.
**Rule**: Always use premium icon sets (e.g., Heroicons) for core UI elements to ensure a polished look. 
**Pattern**: When building custom UI components requiring icons, copy the exact SVG paths from established libraries rather than improvising.
## Lesson: 2026-02-20
**Mistake**: Não destacar explicitamente, no resumo inicial, que o fluxo ativo atual de entrada é o fallback por e-mail via Microsoft Graph quando não há acesso admin ao Autotask.
**Root cause**: Priorização excessiva do caminho nominal do MVP (Autotask listener) sem enfatizar o caminho operacional em uso no ambiente atual.
**Rule**: Sempre explicitar o caminho operacional ativo (feature flags/credenciais/disponibilidade) além do caminho arquitetural ideal.
**Pattern**: Quando houver múltiplos ingressos de dados, reportar: "fluxo ideal" vs "fluxo em produção agora" com referência de arquivo.
## Lesson: 2026-02-20
**Mistake**: Assumi Groq como provider ativo ao investigar a falha de geração.
**Root cause**: Não alinhei imediatamente o provider real do ambiente (Gemini) antes do teste funcional.
**Rule**: Antes de validar pipeline LLM, confirmar provider ativo e variáveis de ambiente obrigatórias.
**Pattern**: Em falhas de diagnose/playbook, sempre checar `LLM_PROVIDER` e chaves do provider em uso antes de concluir causa.
