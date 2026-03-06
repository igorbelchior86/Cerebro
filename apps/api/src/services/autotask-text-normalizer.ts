export interface AutotaskTextNormalization {
  rich_input: string;
  plain_text: string;
  had_markup: boolean;
}

const HTML_TAG_RE = /<\/?[a-z][^>]*>/gi;
const MARKUP_HINT_RE = /<\/?[a-z][^>]*>|[*_~`#>|[\]]|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)/i;

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToText(input: string): string {
  let text = input;
  text = text.replace(/<\s*br\s*\/?>/gi, '\n');
  text = text.replace(/<\s*\/\s*p\s*>/gi, '\n\n');
  text = text.replace(/<\s*p\b[^>]*>/gi, '');
  text = text.replace(/<\s*\/\s*div\s*>/gi, '\n');
  text = text.replace(/<\s*div\b[^>]*>/gi, '');
  text = text.replace(/<\s*li\b[^>]*>/gi, '\n- ');
  text = text.replace(/<\s*\/\s*li\s*>/gi, '');
  text = text.replace(/<\s*\/\s*(ul|ol)\s*>/gi, '\n');
  text = text.replace(/<\s*(ul|ol)\b[^>]*>/gi, '');
  text = text.replace(/<\s*\/\s*h[1-6]\s*>/gi, '\n');
  text = text.replace(/<\s*h[1-6]\b[^>]*>/gi, '');
  text = text.replace(HTML_TAG_RE, '');
  return decodeHtmlEntities(text);
}

function markdownToText(input: string): string {
  let text = input;
  text = text.replace(/```([\s\S]*?)```/g, (_, code: string) =>
    code
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .map((line) => `    ${line}`)
      .join('\n')
  );
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) => {
    const label = alt?.trim() ? `Image: ${alt.trim()}` : 'Image';
    return `${label} (${String(url || '').trim()})`;
  });
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  text = text.replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, (_m, heading: string) => heading.trim().toUpperCase());
  text = text.replace(/^\s{0,3}>\s?/gm, 'NOTE: ');
  text = text.replace(/^(\s*)[-*+]\s+/gm, '$1- ');
  text = text.replace(/^(\s*)(\d+)[.)]\s+/gm, '$1$2. ');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2');
  text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1$2');
  text = text.replace(/~~([^~]+)~~/g, '$1');
  return text;
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ \f\v]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeTextForAutotask(input: unknown): AutotaskTextNormalization {
  const richInput = String(input ?? '').trim();
  if (!richInput) {
    return {
      rich_input: '',
      plain_text: '',
      had_markup: false,
    };
  }

  const hadMarkup = MARKUP_HINT_RE.test(richInput);
  const plain = normalizeWhitespace(markdownToText(htmlToText(richInput)));
  return {
    rich_input: richInput,
    plain_text: plain,
    had_markup: hadMarkup,
  };
}
