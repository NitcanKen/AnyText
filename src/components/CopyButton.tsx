import { IconCheck, IconCopy } from '@tabler/icons-react';
import type { CSSProperties } from 'react';
import { cx } from '../lib/cx';
import { useCopyImprint } from '../lib/motion';

interface CopyButtonProps {
  /** Copy action — may be sync or async; a throw flips the button to the failed state. */
  onCopy: () => void | Promise<void>;
  idleLabel: string;
  copiedLabel: string;
  failedLabel?: string;
  /** Accessible names, when they should differ from the visible labels. */
  idleAriaLabel?: string;
  copiedAriaLabel?: string;
  failedAriaLabel?: string;
  /** Visual chrome — the caller owns the button's look (e.g. `secondary-button`). */
  className?: string;
  iconSize?: number;
  resetMs?: number;
}

/**
 * The COPY `imprint` primitive made concrete (§3.5): clipboard→check icon morph,
 * a lime ripple, a brief label tint, and an optional haptic — with the idle /
 * copied / failed labels stacked in one grid cell so the width never changes
 * (zero layout shift). Shared by every copy surface so the hand-feel is
 * identical and lives in one place, not re-implemented per button.
 */
export function CopyButton({
  onCopy,
  idleLabel,
  copiedLabel,
  failedLabel = 'Copy failed',
  idleAriaLabel,
  copiedAriaLabel,
  failedAriaLabel,
  className,
  iconSize = 15,
  resetMs = 1200,
}: CopyButtonProps) {
  const { status, rippleKey, run } = useCopyImprint(resetMs);

  const ariaLabel =
    status === 'copied'
      ? copiedAriaLabel ?? copiedLabel
      : status === 'failed'
        ? failedAriaLabel ?? failedLabel
        : idleAriaLabel ?? idleLabel;

  return (
    <button
      aria-label={ariaLabel}
      className={cx('fx-imprint', className)}
      data-copy-state={status}
      onClick={() => void run(onCopy)}
      type="button"
    >
      {status === 'copied' ? <span key={rippleKey} aria-hidden="true" className="fx-imprint-ripple" /> : null}
      <span aria-hidden="true" className="fx-imprint-icon" style={{ width: iconSize, height: iconSize } as CSSProperties}>
        <IconCopy className="fx-imprint-copy" size={iconSize} />
        <IconCheck className="fx-imprint-check" size={iconSize} />
      </span>
      <span aria-hidden="true" className="fx-imprint-label">
        <span className="fx-imprint-text" data-imprint="idle">
          {idleLabel}
        </span>
        <span className="fx-imprint-text" data-imprint="copied">
          {copiedLabel}
        </span>
        <span className="fx-imprint-text" data-imprint="failed">
          {failedLabel}
        </span>
      </span>
    </button>
  );
}
