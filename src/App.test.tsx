import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { MARKDOWN_LIMIT_BYTES } from './lib/anytext';

const copyTextMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('./lib/clipboard', () => ({
  copyText: copyTextMock,
}));

beforeEach(() => {
  localStorage.clear();
  copyTextMock.mockClear();
});

describe('AnyText Command Deck app', () => {
  it('starts with first-run pairing and can create a local device circle', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByRole('heading', { name: /pair this browser/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create device circle/i }));

    expect(await screen.findByText(/manual pairing code/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /markdown input/i })).toBeInTheDocument();
    expect(localStorage.getItem('anytext.roomKey')).toBeTruthy();
  });

  it('validates Markdown size before sending', async () => {
    localStorage.setItem('anytext.roomKey', 'test-room-key');

    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: /markdown input/i }), {
      target: { value: 'a'.repeat(MARKDOWN_LIMIT_BYTES + 1) },
    });

    expect(screen.getByText('Markdown is over 500KB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled();
  });

  it('adds a local queue item, expands it, copies markdown/code, and deletes it', async () => {
    const user = userEvent.setup();
    localStorage.setItem('anytext.roomKey', 'test-room-key');

    render(<App />);

    const markdown = [
      '# Ship this',
      '',
      '| Item | State |',
      '| --- | --- |',
      '| AnyText | Ready |',
      '',
      '> Copy the command on the phone.',
      '',
      'Run `npm test` first.',
      '',
      '```bash',
      'npm run build',
      '```',
      '',
      '<script>alert("xss")</script>',
    ].join('\n');

    await user.type(screen.getByRole('textbox', { name: /markdown input/i }), markdown);
    await user.upload(screen.getByLabelText(/select attachments/i), [
      new File([new Uint8Array(12)], 'screen.png', { type: 'image/png' }),
      new File([new Uint8Array(12)], 'brief.pdf', { type: 'application/pdf' }),
    ]);
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    const item = await screen.findByRole('button', { name: /ship this/i });
    expect(item).toBeInTheDocument();
    expect(screen.getByText('screen.png')).toBeInTheDocument();
    expect(screen.getByText('brief.pdf')).toBeInTheDocument();
    expect(screen.queryByText(/alert/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /copy markdown/i }));
    await waitFor(() => expect(copyTextMock).toHaveBeenLastCalledWith(markdown));

    const codeBlock = screen.getByTestId('code-block-bash');
    await user.click(within(codeBlock).getByRole('button', { name: /copy code block/i }));
    await waitFor(() => expect(copyTextMock).toHaveBeenLastCalledWith('npm run build'));

    await user.click(screen.getByRole('button', { name: /delete message/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /ship this/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText('No items in the last hour.')).toBeInTheDocument();
  });
});
