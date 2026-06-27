import { IconTerminal2 } from '@tabler/icons-react';
import { Highlight, themes } from 'prism-react-renderer';
import { copyText } from '../lib/clipboard';
import { cx } from '../lib/cx';
import { CopyButton } from './CopyButton';

const SHELL_LANGUAGES = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'terminal']);

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const normalizedLanguage = language.toLowerCase();
  const isShell = SHELL_LANGUAGES.has(normalizedLanguage);
  const copyLabel = isShell ? 'Copy command' : 'Copy';
  const copiedLabel = isShell ? 'Command copied' : 'Code copied';

  return (
    <div
      className={cx(
        'code-shell group my-4 overflow-hidden rounded-md border bg-[#080c0f]',
        isShell ? 'shell-block border-lime-300/50 shadow-[0_0_0_1px_rgba(190,255,60,0.08)]' : 'border-white/10',
      )}
      data-testid={`code-block-${normalizedLanguage}`}
    >
      <div
        className={cx(
          'flex min-h-10 items-center justify-between gap-3 border-b px-3 py-2',
          isShell ? 'border-lime-300/30 bg-lime-300/[0.08]' : 'border-white/10 bg-white/[0.03]',
        )}
      >
        <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-300">
          {isShell ? <IconTerminal2 aria-hidden size={15} stroke={1.8} /> : null}
          <span className="truncate">{normalizedLanguage}</span>
        </div>
        <CopyButton
          className="fx-magnet inline-flex h-7 items-center gap-1.5 rounded border border-white/10 px-2 text-[11px] font-medium text-slate-100 transition hover:border-lime-300/40 hover:bg-lime-300/10"
          copiedLabel={copiedLabel}
          idleAriaLabel={isShell ? 'Copy command' : 'Copy code block'}
          idleLabel={copyLabel}
          iconSize={14}
          onCopy={() => copyText(code)}
        />
      </div>
      <Highlight code={code} language={normalizedLanguage} theme={themes.vsDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cx(className, 'overflow-x-auto p-4 text-[13px] leading-6')}
            style={{ ...style, background: 'transparent' }}
          >
            {tokens.map((line, lineIndex) => (
              <div key={lineIndex} {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
