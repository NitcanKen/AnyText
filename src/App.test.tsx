import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { MARKDOWN_LIMIT_BYTES } from './lib/anytext';

const copyTextMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const supabaseClientMock = vi.hoisted(() => ({}));
const relayMocks = vi.hoisted(() => ({
  applyMessageRealtimeEvent: vi.fn((items) => items),
  createMessage: vi.fn(),
  createRoom: vi.fn(),
  deleteMessage: vi.fn(),
  listMessages: vi.fn(),
  subscribeToRoomMessages: vi.fn(),
}));

vi.mock('./lib/clipboard', () => ({
  copyText: copyTextMock,
}));

vi.mock('./lib/supabaseClient', () => ({
  getSupabaseClient: () => supabaseClientMock,
  isSupabaseConfigured: () => true,
}));

vi.mock('./lib/supabaseRelay', () => relayMocks);

beforeEach(() => {
  localStorage.clear();
  copyTextMock.mockClear();
  vi.clearAllMocks();
  relayMocks.createRoom.mockResolvedValue({
    roomId: 'test-room-hash',
    expiresPolicyMinutes: 60,
  });
  relayMocks.listMessages.mockResolvedValue([]);
  relayMocks.createMessage.mockImplementation(async (_client, _roomKey, markdown: string, deviceName: string) => ({
    id: 'message-1',
    markdown,
    attachments: [],
    senderDeviceName: deviceName,
    createdAt: '2099-06-24T12:00:00.000Z',
    expiresAt: '2099-06-24T13:00:00.000Z',
  }));
  relayMocks.deleteMessage.mockResolvedValue(undefined);
  relayMocks.subscribeToRoomMessages.mockImplementation(async (_client, _roomKey, { onStatusChange }) => {
    onStatusChange('connected');
    return { unsubscribe: vi.fn() };
  });
});

describe('AnyText Command Deck app', () => {
  it('starts with first-run pairing and creates a Supabase-backed device circle', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByRole('heading', { name: /pair this browser/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create device circle/i }));

    expect(await screen.findByText(/manual pairing code/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /markdown input/i })).toBeInTheDocument();
    expect(localStorage.getItem('anytext.roomKey')).toBeTruthy();
    await waitFor(() => expect(relayMocks.createRoom).toHaveBeenCalled());
    expect(relayMocks.listMessages).toHaveBeenCalled();
    expect(relayMocks.subscribeToRoomMessages).toHaveBeenCalled();
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

  it('sends a text message through Supabase, copies markdown/code, and deletes through Supabase', async () => {
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
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    const item = await screen.findByRole('button', { name: /ship this/i });
    expect(item).toBeInTheDocument();
    expect(screen.queryByText(/alert/)).not.toBeInTheDocument();
    expect(relayMocks.createMessage).toHaveBeenCalledWith(
      supabaseClientMock,
      'test-room-key',
      markdown,
      'MacBook',
      { attachments: [] },
    );

    await user.click(screen.getByRole('button', { name: /copy markdown/i }));
    await waitFor(() => expect(copyTextMock).toHaveBeenLastCalledWith(markdown));

    const codeBlock = screen.getByTestId('code-block-bash');
    await user.click(within(codeBlock).getByRole('button', { name: /copy code block/i }));
    await waitFor(() => expect(copyTextMock).toHaveBeenLastCalledWith('npm run build'));

    await user.click(screen.getByRole('button', { name: /delete message/i }));

    expect(relayMocks.deleteMessage).toHaveBeenCalledWith(supabaseClientMock, 'test-room-key', 'message-1');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /ship this/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText('No items in the last hour.')).toBeInTheDocument();
  });
});
