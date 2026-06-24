import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownPreview } from './MarkdownPreview';

const copyTextMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('../lib/clipboard', () => ({
  copyText: copyTextMock,
}));

beforeEach(() => {
  copyTextMock.mockClear();
});

describe('MarkdownPreview', () => {
  it('renders GFM safely and copies individual shell blocks exactly', async () => {
    const user = userEvent.setup();

    render(
      <MarkdownPreview
        markdown={[
          '## Preview',
          '',
          '| Command | Purpose |',
          '| --- | --- |',
          '| `npm test` | verify |',
          '',
          '> Do not execute automatically.',
          '',
          '```sh',
          'npm test',
          'npm run build',
          '```',
          '',
          '<img src=x onerror=alert(1)>',
        ].join('\n')}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Do not execute automatically.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    const codeBlock = screen.getByTestId('code-block-sh');
    expect(codeBlock).toHaveClass('shell-block');

    await user.click(within(codeBlock).getByRole('button', { name: /copy code block/i }));
    await waitFor(() => expect(copyTextMock).toHaveBeenCalledWith('npm test\nnpm run build'));
  });
});
