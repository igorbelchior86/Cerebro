'use client';

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const html = md.render(content);

  return (
    <>
      <style>{`
        .md-body { font-size: 12.5px; line-height: 1.65; color: var(--text-secondary); word-break: break-word; }
        .md-body p { margin: 0 0 8px; }
        .md-body p:last-child { margin-bottom: 0; }
        .md-body ul, .md-body ol { margin: 4px 0 8px 16px; padding: 0; }
        .md-body li { margin-bottom: 3px; }
        .md-body li::marker { color: var(--text-muted); }
        .md-body strong { color: var(--text-primary); font-weight: 600; }
        .md-body em { color: var(--text-secondary); font-style: italic; }
        .md-body code { font-family: var(--font-jetbrains-mono, monospace); font-size: 11px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; color: var(--accent); }
        .md-body pre { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; overflow-x: auto; margin: 8px 0; }
        .md-body pre code { background: none; border: none; padding: 0; color: var(--text-primary); font-size: 11.5px; }
        .md-body h1,.md-body h2,.md-body h3 { color: var(--text-primary); font-weight: 600; margin: 10px 0 5px; }
        .md-body h1 { font-size: 14px; }
        .md-body h2 { font-size: 13px; }
        .md-body h3 { font-size: 12.5px; }
        .md-body a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
        .md-body hr { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
        .md-body blockquote { border-left: 2px solid var(--border-accent); margin: 0 0 8px; padding: 4px 10px; color: var(--text-muted); }
        .md-body table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; font-size: 12px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; display: table; }
        .md-body thead th { text-align: left; font-weight: 600; color: var(--text-primary); background: rgba(255,255,255,0.03); }
        .md-body th, .md-body td { border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); padding: 6px 8px; vertical-align: top; }
        .md-body th:last-child, .md-body td:last-child { border-right: none; }
        .md-body tbody tr:last-child td { border-bottom: none; }
        .md-body tbody tr:nth-child(even) td { background: rgba(255,255,255,0.015); }
      `}</style>
      <div
        className="md-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
