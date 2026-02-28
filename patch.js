const fs = require('fs');
let file = fs.readFileSync('apps/web/src/components/ChatInput.tsx', 'utf8');

// Change inputRef type
file = file.replace(/const inputRef = useRef<HTMLTextAreaElement>\(null\);/g, 'const inputRef = useRef<HTMLDivElement>(null);');

// Change line effect logic: remove useLayoutEffect completely to use CSS styling instead
file = file.replace(/  useLayoutEffect\(\(\) => {[\s\S]*?}, \[input, INPUT_LINE_HEIGHT_PX, INPUT_MAX_LINES\]\);/g, '');

// Change handleKeyDown to look at the div
file = file.replace(/KeyboardEvent<HTMLTextAreaElement>/g, 'KeyboardEvent<HTMLDivElement>');

// Replace formatting methods
const formattingMethods = `  const applyInlineFormat = (prefix: string, suffix: string = prefix) => {
    const field = inputRef.current;
    if (!field || disabled || isLoading) return;

    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? 0;
    const selected = input.slice(start, end);
    const replacement = \`\${prefix}\${selected}\${suffix}\`;
    const next = \`\${input.slice(0, start)}\${replacement}\${input.slice(end)}\`;

    setInput(next);
    requestAnimationFrame(() => {
      field.focus();
      const cursor = start + replacement.length;
      field.setSelectionRange(cursor, cursor);
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const field = inputRef.current;
    if (!field || disabled || isLoading) return;

    const start = field.selectionStart ?? 0;
    const next = \`\${input.slice(0, start)}\${prefix}\${input.slice(start)}\`;
    setInput(next);
    requestAnimationFrame(() => {
      field.focus();
      const cursor = start + prefix.length;
      field.setSelectionRange(cursor, cursor);
    });
  };`;

const newFormattingMethods = `  const executeCommand = (command: string, arg?: string) => {
    if (disabled || isLoading) return;
    document.execCommand(command, false, arg);
    if (inputRef.current) {
      setInput(inputRef.current.innerHTML);
    }
    inputRef.current?.focus();
  };

  const applyInlineFormat = (command: string, arg?: string) => {
    executeCommand(command, arg);
  };

  const applyLinePrefix = (command: string, arg?: string) => {
    executeCommand(command, arg);
  };`;
  
file = file.replace(formattingMethods, newFormattingMethods);

// Replace the textarea with a contentEditable div
const textareaTag = `          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={disabled ? t('processing') : channelPlaceholder}
            disabled={disabled || isLoading}
            rows={1}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-dm-sans, sans-serif)', fontSize: '12.5px', color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: \`\${INPUT_LINE_HEIGHT_PX}px\`, resize: 'none' }}
          />`;

const divTag = `          <div style={{ flex: 1, position: 'relative' }}>
            {!input && !focused && (
              <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans, sans-serif)', fontSize: '12.5px', letterSpacing: '-0.01em', lineHeight: \`\${INPUT_LINE_HEIGHT_PX}px\` }}>
                {disabled ? t('processing') : channelPlaceholder}
              </div>
            )}
            <div
              ref={inputRef}
              contentEditable={!disabled && !isLoading}
              onInput={(e) => setInput(e.currentTarget.innerHTML)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                width: '100%',
                minHeight: \`\${INPUT_LINE_HEIGHT_PX}px\`,
                maxHeight: \`\${INPUT_LINE_HEIGHT_PX * INPUT_MAX_LINES}px\`,
                overflowY: 'auto',
                background: 'none',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-dm-sans, sans-serif)',
                fontSize: '12.5px',
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: \`\${INPUT_LINE_HEIGHT_PX}px\`,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              suppressContentEditableWarning={true}
            />
          </div>`;

file = file.replace(textareaTag, divTag);

// Emoji
file = file.replace(/onClick=\{\(\) => applyInlineFormat\('🙂', ''\)\}/g, "onMouseDown={(e) => e.preventDefault()} onClick={() => executeCommand('insertText', '🙂')}");

// Bold
file = file.replace(/onClick=\{\(\) => applyInlineFormat\('\\*\\*'\)\}/g, "onMouseDown={(e) => e.preventDefault()} onClick={() => executeCommand('bold')}");

// Italic
file = file.replace(/onClick=\{\(\) => applyInlineFormat\('\\*'\)\}/g, "onMouseDown={(e) => e.preventDefault()} onClick={() => executeCommand('italic')}");

// Underline
file = file.replace(/onClick=\{\(\) => applyInlineFormat\('<u>', '<\\/u>'\)\}/g, "onMouseDown={(e) => e.preventDefault()} onClick={() => executeCommand('underline')}");

// Bulleted
file = file.replace(/onClick=\{\(\) => applyLinePrefix\('- '\)\}/g, "onMouseDown={(e) => e.preventDefault()} onClick={() => executeCommand('insertUnorderedList')}");

// Numbered
file = file.replace(/onClick=\{\(\) => applyLinePrefix\('1\\. '\)\}/g, "onMouseDown={(e) => e.preventDefault()} onClick={() => executeCommand('insertOrderedList')}");

// Handle setInput('') clearing
file = file.replace(/setInput\(''\);/, 'setInput(""); if (inputRef.current) inputRef.current.innerHTML = "";');

fs.writeFileSync('apps/web/src/components/ChatInput.tsx', file);
