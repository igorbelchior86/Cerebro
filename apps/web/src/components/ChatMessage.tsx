import { useState, type CSSProperties, type ReactNode } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  channel?: 'internal_ai' | 'external_psa_user';
  timestamp?: Date;
  type?: 'text' | 'status' | 'autotask' | 'evidence' | 'diagnosis' | 'validation' | 'note';
  delivery?: {
    status: 'sending' | 'sent' | 'failed' | 'retrying';
    error?: string;
  };
  steps?: { label: string; status: 'done' | 'running' | 'idle' }[];
  ticketTextVariant?: {
    primary: 'clean' | 'original';
    clean?: string;
    cleanFormat?: 'plain' | 'markdown_llm';
    original: string;
  };
  attachments?: Array<{
    id: string;
    name: string;
    mimeType: string;
    extension: string;
    kind: 'image' | 'document';
    previewUrl?: string;
  }>;
}

interface ChatMessageProps {
  message: Message;
  children?: ReactNode;
  onRetryExternalMessage?: (message: Message) => void;
}

const SOURCE_CONFIG: Record<string, { icon: string; label: string }> = {
  autotask: { icon: '🎟', label: 'Autotask' },
  note: { icon: '📝', label: 'TicketNote' },
  evidence: { icon: '⚡', label: 'PrepareContext' },
  diagnosis: { icon: '🧠', label: 'LLM Diagnose' },
  validation: { icon: '🛡', label: 'ValidateAndPolicy' },
  text: { icon: '📋', label: 'PlaybookWriter' },
};

function MsgTag({ children, color, bg }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', fontWeight: 500, background: bg ?? 'rgba(255,255,255,0.05)', color: color ?? 'var(--accent)', border: '1px solid var(--border)', margin: '0 2px', verticalAlign: 'middle' }}>
      {children}
    </span>
  );
}

type CleanSegment =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list_item'; text: string; index?: number }
  | { kind: 'callout'; label: string; text: string }
  | { kind: 'signature'; text: string };

type CleanDisplayModel = {
  markdownFallback: string;
  segments: CleanSegment[];
  rosterItems: Array<{ index?: number; title: string; detail?: string }>;
  formatted: boolean;
};

function normalizeCleanTicketTextForDisplay(input: string): CleanDisplayModel {
  const raw = String(input || '').trim();
  if (!raw) {
    return { markdownFallback: '', segments: [], rosterItems: [], formatted: false };
  }

  // Keep explicit line breaks if already present, otherwise create some deterministic structure.
  const base = raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Promote common inline list patterns ("1. ... 2. ...") to actual line-separated items.
  const withListBreaks = base
    .replace(/\s+([1-9][0-9]?\.)\s+(?=[A-Z#])/g, '\n$1 ')
    .replace(/\s+(NOTE\s*[-:])\s+/gi, '\n$1 ')
    .replace(/\s+(GOAL\s*[-:])\s+/gi, '\n$1 ');

  const lines = withListBreaks
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const out: string[] = [];
  const segments: CleanSegment[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const paragraph = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
    if (paragraph) out.push(paragraph);
    if (paragraph) segments.push({ kind: 'paragraph', text: paragraph });
    paragraphBuffer = [];
  };

  const isListItem = (line: string) => /^([1-9][0-9]?\.)\s+/.test(line);
  const isCallout = (line: string) => /^(NOTE|GOAL|PRIORITY|ACTION|IMPACT)\s*[-:]/i.test(line);
  const isSignatureLike = (line: string) =>
    /^(thanks[,!]?|regards[,!]?|best[,!]?|sincerely[,!]?)/i.test(line) ||
    /^(direct|phone|email)\s*:/i.test(line);

  for (const line of lines) {
    if (isListItem(line)) {
      flushParagraph();
      out.push(line);
      const m = line.match(/^([1-9][0-9]?)\.\s+([\s\S]+)$/);
      const itemText = m?.[2] || line.replace(/^([1-9][0-9]?)\.\s+/, '');
      if (m) {
        segments.push({ kind: 'list_item', index: Number(m[1]), text: itemText });
      } else {
        segments.push({ kind: 'list_item', text: itemText });
      }
      continue;
    }

    if (isCallout(line)) {
      flushParagraph();
      out.push(`**${line.replace(/^([A-Z ]+)\s*([-:])\s*/i, (_, label, sep) => `${String(label).trim()}${sep} `)}**`);
      const cm = line.match(/^([A-Z ]+)\s*[-:]\s*(.*)$/i);
      segments.push({
        kind: 'callout',
        label: String(cm?.[1] || 'Note').trim(),
        text: String(cm?.[2] || '').trim(),
      });
      continue;
    }

    if (isSignatureLike(line)) {
      flushParagraph();
      out.push(line);
      segments.push({ kind: 'signature', text: line });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  const markdownFallback = out.join('\n\n');

  // Heuristic roster detection: numbered onboarding/person rows with a likely person name + role/device/location.
  const rosterItems = segments
    .filter((s): s is Extract<CleanSegment, { kind: 'list_item' }> => s.kind === 'list_item')
    .map((item) => {
      const text = item.text.trim();
      const splitByDevice = text.match(/^(.*?)(\b(?:microsoft\s+surface|laptop|desktop|macbook|pc|workstation|personal\s+laptop)\b.*)$/i);
      const title = (splitByDevice?.[1] || text).trim();
      const detail = splitByDevice?.[2]?.trim();
      return {
        ...(typeof item.index === 'number' ? { index: item.index } : {}),
        title,
        ...(detail ? { detail } : {}),
      };
    })
    .filter((item) => /[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}/.test(item.title));

  const formatted = markdownFallback !== raw || rosterItems.length > 0;
  return { markdownFallback, segments, rosterItems, formatted };
}

function renderHighlightedInline(text: string): ReactNode {
  // Keep highlights restrained: deadlines/dates/action cues only.
  const tokens = String(text || '').split(
    /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\bmarch\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:today|tomorrow|asap|urgent|deadline)\b|\b(?:goal(?:\s+completion)?|please prioritize|due by)\b)/gi
  );

  return tokens.map((part, idx) => {
    if (!part) return null;
    const lower = part.toLowerCase();
    const isDateOrDeadline =
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/i.test(part) ||
      /\bmarch\s+\d{1,2}(?:st|nd|rd|th)?\b/i.test(part) ||
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(part) ||
      ['today', 'tomorrow', 'asap', 'urgent', 'deadline', 'goal', 'goal completion', 'please prioritize', 'due by'].includes(lower);

    if (!isDateOrDeadline) return <span key={idx}>{part}</span>;

    return (
      <span
        key={idx}
        style={{
          display: 'inline',
          padding: '0 3px',
          borderRadius: '4px',
          background: 'rgba(234,179,8,0.10)',
          border: '1px solid rgba(234,179,8,0.18)',
          color: '#B78109',
          fontWeight: 600,
        }}
      >
        {part}
      </span>
    );
  });
}

function formatSimpleEmailBodyMarkdown(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return raw;

  const withoutVerbosePrefix = raw.replace(
    /^cleaned ticket text \(noise removed,\s*meaning preserved\):\s*/i,
    ''
  ).trim();

  const text = withoutVerbosePrefix
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // break common inline numbered sequences into separate lines
    .replace(/\s+([1-9][0-9]?\.)\s+(?=[A-Z#])/g, '\n$1 ')
    // break common email sections/callouts
    .replace(/\s+(NOTE\s*[-:])\s+/gi, '\n\n$1 ')
    .replace(/\s+(GOAL\s*[-:])\s+/gi, '\n\n$1 ')
    .replace(/\s+(Thanks[,!]?|Regards[,!]?|Best[,!]?|Sincerely[,!]?)\s+/gi, '\n\n$1 ')
    .replace(/\s+(Direct\s*:)\s+/gi, '\n$1 ')
    .replace(/\s+(Phone\s*:)\s+/gi, '\n$1 ')
    .replace(/\s+(Email\s*:)\s+/gi, '\n$1 ')
    .trim();
  const rosterEmploymentRe = /\b(1099|W2(?:\s+Employee)?|Corp-to-Corp|corp-to-corp)\b/i;
  const roleishNameStopwords = new Set([
    'Business', 'Development', 'Marketing', 'Engagement', 'Project', 'Account', 'Accounts',
    'Acct', 'Lead', 'Manager', 'Mgmt', 'Support', 'Operations', 'Operation',
  ]);
  const splitEmbeddedRosterRows = (line: string) => {
    const matches = [...line.matchAll(/([A-Z][A-Za-z'-]+)\s+([A-Z][A-Za-z'-]+)\s+(1099|W2(?:\s+Employee)?|Corp-to-Corp|corp-to-corp)\b/g)];
    if (matches.length <= 1) return [line];
    const splitPoints = new Set<number>();
    for (const match of matches) {
      const start = match.index ?? 0;
      if (start <= 0) continue;
      const first = match[1];
      const second = match[2];
      if (!first || !second) continue;
      if (roleishNameStopwords.has(first) || roleishNameStopwords.has(second)) continue;
      const prefix = line.slice(0, start);
      const prefixHasRosterRow =
        rosterEmploymentRe.test(prefix) &&
        (
          /\b(Laptop|laptops|Desktop|MacBook|Surface(?:\s+Laptop)?|Workstation|PC)\b/i.test(prefix) ||
          /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(prefix) ||
          /[)|]/.test(prefix)
        );
      if (prefixHasRosterRow) splitPoints.add(start);
    }
    if (!splitPoints.size) return [line];
    const ordered = [...splitPoints].sort((a, b) => a - b);
    const parts: string[] = [];
    let cursor = 0;
    for (const point of ordered) {
      const part = line.slice(cursor, point).trim();
      if (part) parts.push(part);
      cursor = point;
    }
    const tail = line.slice(cursor).trim();
    if (tail) parts.push(tail);
    return parts.length ? parts : [line];
  };

  // Secondary segmentation pass: split embedded roster rows conservatively.
  const segmentedText = text
    .split('\n')
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [''];
      if (/^(NOTE|GOAL)\s*[-:]/i.test(trimmed)) return [trimmed];
      const parts = splitEmbeddedRosterRows(trimmed);
      if (parts.length <= 1) return [trimmed];
      return parts;
    })
    .join('\n');

  const rawLines = segmentedText.split('\n').map((l) => l.trim());
  const lines: string[] = [];
  const isNameFragment = (line: string) =>
    /^[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2}$/.test(line) &&
    !/\b(Thanks|Regards|Best|Sincerely|NOTE|GOAL)\b/i.test(line);
  const hasRosterDetailSignals = (line: string) =>
    /\b(1099|W2(?:\s+Employee)?|Corp-to-Corp|corp-to-corp)\b/i.test(line) ||
    /\b(Laptop|Desktop|MacBook|Surface|PC|Workstation)\b/i.test(line) ||
    /\b[A-Z][A-Za-z'-]+,\s*[A-Z]{2}\b/.test(line);

  for (let i = 0; i < rawLines.length; i += 1) {
    const current = rawLines[i] ?? '';
    const next = rawLines[i + 1] ?? '';
    if (current && next && isNameFragment(current) && hasRosterDetailSignals(next)) {
      lines.push(`${current} ${next}`.replace(/\s+/g, ' ').trim());
      i += 1;
      continue;
    }
    lines.push(current);
  }
  const blocks: string[] = [];
  let buf: string[] = [];
  let rosterRun: string[] = [];

  const flush = () => {
    if (!buf.length) return;
    blocks.push(buf.join(' ').replace(/\s+/g, ' ').trim());
    buf = [];
  };

  const classifyLine = (line: string) => {
    if (!line) return 'blank' as const;
    if (/^([1-9][0-9]?\.)\s+/.test(line)) return 'numbered' as const;
    if (/^(NOTE|GOAL)\s*[-:]/i.test(line)) return 'callout' as const;
    if (/^(Thanks|Regards|Best|Sincerely)[,!]?/i.test(line) || /^(Direct|Phone|Email)\s*:/i.test(line)) return 'signature' as const;
    return 'text' as const;
  };

  const isLikelyRosterLine = (line: string) =>
    classifyLine(line) === 'text' &&
    !/^([1-9][0-9]?\.)\s+/.test(line) &&
    /^[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3}\s+.+$/.test(line) &&
    (
      /\b(1099|W2(?:\s+Employee)?|Corp-to-Corp|corp-to-corp)\b/i.test(line) ||
      /\b(Laptop|Desktop|MacBook|Surface|PC|Workstation)\b/i.test(line) ||
      /\b[A-Z][A-Za-z'-]+,\s*[A-Z]{2}\b/.test(line)
    );

  const splitRosterLine = (line: string) => {
    const employmentMarker = line.match(/\b(1099|W2(?:\s+Employee)?|Corp-to-Corp|corp-to-corp)\b/i);
    if (employmentMarker && employmentMarker.index != null) {
      const beforeEmployment = line.slice(0, employmentMarker.index).trim();
      const beforeTokens = beforeEmployment.split(/\s+/).filter(Boolean);
      if (beforeTokens.length >= 2) {
        const roleish = new Set([
          'CEO', 'COO', 'CSO', 'CTO', 'CFO', 'HR', 'Acct', 'Mgmt.', 'Mgmt', 'Marketing',
          'Business', 'Development', 'Engagement', 'Lead/HR', 'Lead', 'Project',
        ]);
        let nameTokenCount = 2;
        if (
          beforeTokens.length >= 3 &&
          /^[A-Z][A-Za-z'-]+$/.test(beforeTokens[2] ?? '') &&
          !roleish.has(beforeTokens[2] ?? '')
        ) {
          nameTokenCount = 3;
        }
        const name = beforeTokens.slice(0, nameTokenCount).join(' ');
        const details = line.slice(name.length).trim();
        if (name) return { name, details };
      }
    }

    const m = line.match(/^([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,2})(?:\s+(.*))?$/);
    const name = (m?.[1] ?? '').trim();
    const details = (m?.[2] ?? '').trim();
    if (!name) return { name: line, details: '' };
    return { name, details: details || '' };
  };

  const rosterRunScore = (run: string[]) => {
    if (!run.length) return 0;
    let score = 0;
    for (const line of run) {
      if (/^[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3}\b/.test(line)) score += 2;
      if (/\b(1099|W2(?:\s+Employee)?|Corp-to-Corp|corp-to-corp)\b/i.test(line)) score += 1;
      if (/\b(Laptop|Desktop|MacBook|Surface|PC|Workstation)\b/i.test(line)) score += 1;
      if (/\b[A-Z][A-Za-z'-]+,\s*[A-Z]{2}\b/.test(line)) score += 1;
      if (/[.!?]$/.test(line)) score -= 0.5; // roster rows are often fragments, not sentences
    }
    return score / run.length;
  };

  const flushRosterRun = () => {
    const score = rosterRunScore(rosterRun);
    if (rosterRun.length < 3 || score < 2.2) {
      for (const line of rosterRun) blocks.push(`- ${line}`);
      rosterRun = [];
      return;
    }
    const tableLines = ['| Name | Details |', '| --- | --- |'];
    for (const line of rosterRun) {
      const row = splitRosterLine(line);
      const name = row.name.replace(/\|/g, '\\|');
      const details = row.details.replace(/\|/g, '\\|');
      tableLines.push(`| ${name} | ${details || '—'} |`);
    }
    blocks.push(tableLines.join('\n'));
    rosterRun = [];
  };

  for (const line of lines) {
    const kind = classifyLine(line);
    if (kind === 'blank') {
      if (rosterRun.length) flushRosterRun();
      flush();
      continue;
    }
    if (isLikelyRosterLine(line)) {
      flush();
      rosterRun.push(line);
      continue;
    }
    if (rosterRun.length) flushRosterRun();
    if (kind === 'numbered') {
      flush();
      blocks.push(line);
      continue;
    }
    if (kind === 'callout') {
      flush();
      blocks.push(`**${line}**`);
      continue;
    }
    if (kind === 'signature') {
      flush();
      blocks.push(line);
      continue;
    }
    buf.push(line);
  }
  if (rosterRun.length) flushRosterRun();
  flush();
  return blocks.filter(Boolean).join('\n\n');
}

function parseRosterRow(input: { index?: number; title: string; detail?: string }) {
  const source = `${input.title}${input.detail ? ` ${input.detail}` : ''}`.replace(/\s+/g, ' ').trim();
  const nameMatch = source.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b(.*)$/);
  const name = (nameMatch?.[1] || input.title).trim();
  const rest = (nameMatch?.[2] || source.replace(name, '')).trim();

  const employmentMatch = rest.match(/\b(1099|W2 Employee|Corp-to-Corp|corp-to-Corp|corp-to-corp)\b/i);
  const employment = employmentMatch?.[1]
    ? employmentMatch[1].replace(/corp-to-corp/i, 'Corp-to-Corp')
    : '';
  const deviceMatch = source.match(/\b(Microsoft Surface(?: Laptop)?|Personal Laptop|Laptop|Desktop|MacBook|PC|Workstation)\b/i);
  const device = deviceMatch?.[1] || '';
  const locationMatch = source.match(/\b([A-Z][a-z]+,\s*[A-Z]{2})\b/);
  const location = locationMatch?.[1] || '';
  const notes = [rest]
    .join(' ')
    .replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
    .replace(/\b(1099|W2 Employee|Corp-to-Corp|corp-to-corp)\b/gi, '')
    .replace(/\b(Microsoft Surface(?: Laptop)?|Personal Laptop|Laptop|Desktop|MacBook|PC|Workstation)\b/gi, '')
    .replace(/\b([A-Z][a-z]+,\s*[A-Z]{2})\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,.;:\- ]+|[,.;:\- ]+$/g, '');

  return {
    index: input.index,
    name,
    employment: employment || '—',
    device: device || '—',
    location: location || '—',
    notes: notes || '—',
  };
}

function RichCleanTicketText({
  text,
  format = 'plain',
}: {
  text: string;
  format?: 'plain' | 'markdown_llm';
}) {
  if (format === 'markdown_llm') {
    return <MarkdownRenderer content={text} />;
  }
  return <MarkdownRenderer content={formatSimpleEmailBodyMarkdown(text)} />;
}

const assistantBubbleStyle: CSSProperties = {
  width: '100%',
  borderRadius: '12px 12px 12px 3px',
  border: '1px solid var(--bento-outline)',
  background: 'var(--bg-card)',
  boxShadow: 'var(--shadow-card)',
  padding: '10px 12px 24px 12px',
  position: 'relative',
};

const userBubbleStyle: CSSProperties = {
  width: '100%',
  margin: 0,
  borderRadius: '12px 12px 3px 12px',
  border: '1px solid rgba(91,127,255,0.15)',
  background: 'rgba(91,127,255,0.10)',
  boxShadow: 'var(--shadow-card)',
  padding: '10px 12px',
  fontSize: '12.5px',
  color: 'var(--text-primary)',
  lineHeight: 1.55,
};

type BubbleCategory =
  | 'system_status'
  | 'ai'
  | 'note'
  | 'tech_to_ai'
  | 'tech_to_user'
  | 'ai_exchange'
  | 'ai_validation';

type BubbleTone = {
  bubbleBg: string;
  bubbleBorder: string;
  bubbleAccent: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
};

const BUBBLE_TONES: Record<BubbleCategory, BubbleTone> = {
  system_status: {
    bubbleBg: 'var(--bg-card)',
    bubbleBorder: 'var(--border)',
    bubbleAccent: 'rgba(148,163,184,0.22)',
    badgeBg: 'rgba(148,163,184,0.12)',
    badgeBorder: 'rgba(148,163,184,0.30)',
    badgeText: 'var(--text-muted)',
  },
  ai: {
    bubbleBg: 'rgba(110,134,201,0.08)',
    bubbleBorder: 'rgba(110,134,201,0.22)',
    bubbleAccent: 'rgba(110,134,201,0.24)',
    badgeBg: 'rgba(110,134,201,0.12)',
    badgeBorder: 'rgba(110,134,201,0.28)',
    badgeText: 'var(--accent)',
  },
  note: {
    bubbleBg: 'rgba(211,166,61,0.10)',
    bubbleBorder: 'rgba(211,166,61,0.24)',
    bubbleAccent: 'rgba(211,166,61,0.26)',
    badgeBg: 'rgba(211,166,61,0.14)',
    badgeBorder: 'rgba(211,166,61,0.30)',
    badgeText: '#9A6700',
  },
  tech_to_ai: {
    bubbleBg: 'rgba(56,165,140,0.11)',
    bubbleBorder: 'rgba(56,165,140,0.26)',
    bubbleAccent: 'rgba(56,165,140,0.28)',
    badgeBg: 'rgba(56,165,140,0.14)',
    badgeBorder: 'rgba(56,165,140,0.30)',
    badgeText: '#0f766e',
  },
  tech_to_user: {
    bubbleBg: 'rgba(214,124,124,0.11)',
    bubbleBorder: 'rgba(214,124,124,0.28)',
    bubbleAccent: 'rgba(214,124,124,0.30)',
    badgeBg: 'rgba(214,124,124,0.14)',
    badgeBorder: 'rgba(214,124,124,0.32)',
    badgeText: '#b45353',
  },
  ai_exchange: {
    bubbleBg: 'rgba(110,134,201,0.07)',
    bubbleBorder: 'rgba(110,134,201,0.20)',
    bubbleAccent: 'rgba(56,165,140,0.24)',
    badgeBg: 'rgba(56,165,140,0.12)',
    badgeBorder: 'rgba(56,165,140,0.30)',
    badgeText: '#0f766e',
  },
  ai_validation: {
    bubbleBg: 'rgba(56,165,140,0.09)',
    bubbleBorder: 'rgba(56,165,140,0.24)',
    bubbleAccent: 'rgba(211,166,61,0.24)',
    badgeBg: 'rgba(56,165,140,0.14)',
    badgeBorder: 'rgba(56,165,140,0.30)',
    badgeText: '#0f766e',
  },
};

function resolveBubbleCategory(message: Message): BubbleCategory {
  if (message.role === 'system' || message.type === 'status') return 'system_status';
  if (message.role === 'user') {
    return message.channel === 'external_psa_user' ? 'tech_to_user' : 'tech_to_ai';
  }
  if (message.type === 'autotask' || message.type === 'note') return 'note';
  if (message.type === 'validation') return 'ai_validation';
  if (message.type === 'text' && message.channel === 'internal_ai') return 'ai_exchange';
  return 'ai';
}

export default function ChatMessage({ message, children, onRetryExternalMessage }: ChatMessageProps) {
  const [ticketTextMode, setTicketTextMode] = useState<'clean' | 'original'>(
    message.ticketTextVariant?.clean?.trim()
      ? 'clean'
      : 'original'
  );
  const isSystem = message.role === 'system' || message.type === 'status';
  const channel = message.channel ?? 'internal_ai';
  const category = resolveBubbleCategory(message);
  const tone = BUBBLE_TONES[category];
  const channelBadge = channel === 'external_psa_user' ? 'PSA/User' : 'AI';
  const channelBadgeStyle: CSSProperties = {
    fontSize: '9px',
    fontWeight: 700,
    borderRadius: '999px',
    padding: '1px 7px',
    letterSpacing: '0.03em',
    border: `1px solid ${tone.badgeBorder}`,
    background: tone.badgeBg,
    color: tone.badgeText,
  };
  const deliveryStatusLabelMap: Record<NonNullable<Message['delivery']>['status'], string> = {
    sending: 'Sending',
    sent: 'Sent',
    failed: 'Failed',
    retrying: 'Retrying',
  };
  const deliveryStatusToneMap: Record<NonNullable<Message['delivery']>['status'], { color: string; border: string; background: string }> = {
    sending: { color: '#9A6700', border: '1px solid rgba(234,179,8,0.28)', background: 'rgba(234,179,8,0.10)' },
    sent: { color: '#0f766e', border: '1px solid rgba(16,185,129,0.28)', background: 'rgba(16,185,129,0.10)' },
    failed: { color: '#b91c1c', border: '1px solid rgba(239,68,68,0.28)', background: 'rgba(239,68,68,0.10)' },
    retrying: { color: '#9A6700', border: '1px solid rgba(234,179,8,0.28)', background: 'rgba(234,179,8,0.10)' },
  };
  const assistantBubbleByChannel: CSSProperties = {
    ...assistantBubbleStyle,
    border: `1px solid ${tone.bubbleBorder}`,
    background: tone.bubbleBg,
    boxShadow: `inset 3px 0 0 ${tone.bubbleAccent}, var(--shadow-card)`,
  };
  const userBubbleByChannel: CSSProperties = {
    ...userBubbleStyle,
    border: `1px solid ${tone.bubbleBorder}`,
    background: tone.bubbleBg,
    boxShadow: `inset -3px 0 0 ${tone.bubbleAccent}, var(--shadow-card)`,
  };

  if (isSystem) {
    return (
      <div className="animate-msgIn" style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} className="animate-throbber" />
          {message.content}
        </span>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="animate-msgIn" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: 'row-reverse', marginBottom: '20px' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', border: '1px solid rgba(91,127,255,0.2)', background: 'rgba(91,127,255,0.10)' }}>👤</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px', flexDirection: 'row-reverse' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>You</span>
            <span style={channelBadgeStyle}>{channelBadge}</span>
            {message.timestamp && <span suppressHydrationWarning style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)' }}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          <p style={userBubbleByChannel}>
            {message.content}
          </p>
          {message.delivery ? (
            <div style={{ marginTop: '5px', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ ...deliveryStatusToneMap[message.delivery.status], borderRadius: '999px', padding: '1px 7px', fontSize: '9px', fontWeight: 700 }}>
                  {deliveryStatusLabelMap[message.delivery.status]}
                </span>
                <span>PSA delivery</span>
              </div>
              {message.delivery.error ? (
                <span style={{ color: '#b91c1c', maxWidth: '360px', textAlign: 'right' }}>{message.delivery.error}</span>
              ) : null}
              {message.delivery.status === 'failed' && onRetryExternalMessage ? (
                <button
                  type="button"
                  onClick={() => onRetryExternalMessage(message)}
                  style={{
                    borderRadius: '999px',
                    border: '1px solid rgba(185,28,28,0.25)',
                    background: 'rgba(185,28,28,0.08)',
                    color: '#b91c1c',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
          {message.attachments && message.attachments.length > 0 ? (
            <div style={{ marginTop: '6px', width: '100%', display: 'grid', gap: '6px' }}>
              {message.attachments.map((attachment) => (
                attachment.kind === 'image' && attachment.previewUrl ? (
                  <img
                    key={attachment.id}
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    style={{
                      width: '100%',
                      maxWidth: '320px',
                      borderRadius: '10px',
                      border: '1px solid rgba(91,127,255,0.18)',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    key={attachment.id}
                    style={{
                      width: '100%',
                      maxWidth: '320px',
                      borderRadius: '10px',
                      border: '1px solid rgba(91,127,255,0.18)',
                      background: 'rgba(91,127,255,0.06)',
                      padding: '8px 9px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '7px',
                        border: '1px solid rgba(91,127,255,0.25)',
                        background: 'rgba(255,255,255,0.55)',
                        color: 'var(--text-muted)',
                        fontSize: '10px',
                        fontFamily: 'var(--font-jetbrains-mono, monospace)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {attachment.extension}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {attachment.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{attachment.extension}</div>
                    </div>
                  </div>
                )
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const src = SOURCE_CONFIG[message.type ?? 'text'] ?? { icon: '📋', label: 'PlaybookWriter' };
  const sourceLabel =
    message.type === 'note'
      ? (channel === 'external_psa_user' ? 'PSA/User Note' : 'Internal Note')
      : src.label;
  const canToggleTicketText =
    message.type === 'autotask' &&
    Boolean(message.ticketTextVariant?.original?.trim());
  const hasCleanTicketText = Boolean(message.ticketTextVariant?.clean?.trim());
  const ticketTextModes: Array<'clean' | 'original'> = hasCleanTicketText
    ? ['clean', 'original']
    : ['original'];
  const renderedContent = canToggleTicketText
    ? ticketTextMode === 'original'
      ? message.ticketTextVariant!.original
      : hasCleanTicketText
        ? normalizeCleanTicketTextForDisplay(message.ticketTextVariant!.clean!)
        : normalizeCleanTicketTextForDisplay(message.ticketTextVariant!.original)
    : message.content;
  const cleanDisplayModel = canToggleTicketText && hasCleanTicketText
    ? normalizeCleanTicketTextForDisplay(message.ticketTextVariant!.clean!)
    : null;
  const stepsList = message.steps && message.steps.length > 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
      {message.steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', flexShrink: 0, background: step.status === 'done' ? 'var(--green-muted)' : step.status === 'running' ? 'var(--accent-muted)' : 'var(--bg-badge)', border: `1px solid ${step.status === 'done' ? 'var(--green-border)' : step.status === 'running' ? 'rgba(91,127,255,0.25)' : 'var(--border)'}`, color: step.status === 'done' ? 'var(--green)' : 'transparent' }} className={step.status === 'running' ? 'animate-throbber' : undefined}>
            {step.status === 'done' ? '✓' : ''}
          </span>
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  ) : null;
  const isPrepareContextMessage = message.type === 'evidence';
  return (
    <div className="animate-msgIn" style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          {src.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={assistantBubbleByChannel}>
            {canToggleTicketText && ticketTextMode === 'clean' && hasCleanTicketText ? (
              <RichCleanTicketText
                text={message.ticketTextVariant!.clean!}
                format={message.ticketTextVariant!.cleanFormat ?? 'plain'}
              />
            ) : (
              <MarkdownRenderer content={String(renderedContent) + (message.type === 'validation' ? ' **Status:** `approved`' : '')} />
            )}
            {stepsList && (isPrepareContextMessage ? (
              <details style={{ marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, listStylePosition: 'inside' }}>
                  PrepareContext items ({message.steps?.length ?? 0})
                </summary>
                {stepsList}
              </details>
            ) : (
              stepsList
            ))}
            {children && <div style={{ marginTop: '8px' }}>{children}</div>}
            {message.delivery ? (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', fontSize: '10px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ ...deliveryStatusToneMap[message.delivery.status], borderRadius: '999px', padding: '1px 7px', fontSize: '9px', fontWeight: 700 }}>
                    {deliveryStatusLabelMap[message.delivery.status]}
                  </span>
                  <span>PSA delivery</span>
                </div>
                {message.delivery.error ? (
                  <span style={{ color: '#b91c1c' }}>{message.delivery.error}</span>
                ) : null}
                {message.delivery.status === 'failed' && onRetryExternalMessage ? (
                  <button
                    type="button"
                    onClick={() => onRetryExternalMessage(message)}
                    style={{
                      borderRadius: '999px',
                      border: '1px solid rgba(185,28,28,0.25)',
                      background: 'rgba(185,28,28,0.08)',
                      color: '#b91c1c',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}

            {canToggleTicketText && (
              <div style={{
                position: 'absolute',
                bottom: '6px',
                right: '6px',
                display: 'flex',
                gap: '4px',
                zIndex: 10
              }}>
                {ticketTextModes.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTicketTextMode(mode)}
                    title={mode === 'clean' ? 'Clean View' : 'Original View'}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid',
                      borderColor: ticketTextMode === mode ? 'rgba(91,127,255,0.3)' : 'var(--bento-outline)',
                      background: ticketTextMode === mode ? 'rgba(91,127,255,0.12)' : 'var(--bg-card)',
                      color: ticketTextMode === mode ? 'var(--accent)' : 'var(--text-faint)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: ticketTextMode === mode ? '0 1px 4px rgba(91,127,255,0.1)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (ticketTextMode !== mode) {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.color = 'var(--accent)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (ticketTextMode !== mode) {
                        e.currentTarget.style.borderColor = 'var(--bento-outline)';
                        e.currentTarget.style.color = 'var(--text-faint)';
                      }
                    }}
                  >
                    {mode === 'clean' ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2L9.5 5.5L13 7L9.5 8.5L8 12L6.5 8.5L3 7L6.5 5.5L8 2Z" fill="currentColor" />
                        <path d="M12 10L12.5 11.5L14 12L12.5 12.5L12 14L11.5 12.5L10 12L11.5 11.5L12 10Z" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4H12V5.5H4V4ZM4 7H12V8.5H4V7ZM4 10H9V11.5H4V10Z" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '10px', marginLeft: '36px', paddingRight: '2px' }}>
        <span style={channelBadgeStyle}>{channelBadge}</span>
        {message.timestamp && (
          <span
            suppressHydrationWarning
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)', letterSpacing: '0.04em' }}
          >
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>{sourceLabel}</span>
      </div>
    </div>
  );
}
