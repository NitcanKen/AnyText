import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { MARKDOWN_LIMIT_BYTES } from './lib/anytext';

const copyTextMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const supabaseClientMock = vi.hoisted(() => ({}));
const relayMocks = vi.hoisted(() => ({
  applyMessageRealtimeEvent: vi.fn((items) => items),
  createAttachmentDownloadUrl: vi.fn(),
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
  relayMocks.createAttachmentDownloadUrl.mockResolvedValue({
    expiresIn: 60,
    signedUrl: 'https://storage.example/signed/file',
  });
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

  it('selects multiple attachments, sends them with Markdown, previews images, and downloads files', async () => {
    const user = userEvent.setup();
    localStorage.setItem('anytext.roomKey', 'test-room-key');
    relayMocks.createMessage.mockResolvedValueOnce({
      id: 'message-with-files',
      markdown: '# Attachments',
      attachments: [
        {
          id: 'image-1',
          messageId: 'message-with-files',
          fileName: 'screen.png',
          fileType: 'PNG',
          mimeType: 'image/png',
          fileSize: 3,
          previewKind: 'image',
          objectUrl: 'https://storage.example/signed/screen.png',
        },
        {
          id: 'file-1',
          messageId: 'message-with-files',
          fileName: 'brief.pdf',
          fileType: 'PDF',
          mimeType: 'application/pdf',
          fileSize: 4,
          previewKind: 'download',
          objectUrl: 'https://storage.example/signed/brief.pdf',
        },
      ],
      senderDeviceName: 'MacBook',
      createdAt: '2099-06-24T12:00:00.000Z',
      expiresAt: '2099-06-24T13:00:00.000Z',
    });

    render(<App />);

    const image = new File([new Uint8Array([1, 2, 3])], 'screen.png', { type: 'image/png' });
    const pdf = new File([new Uint8Array([1, 2, 3, 4])], 'brief.pdf', { type: 'application/pdf' });

    await user.type(screen.getByRole('textbox', { name: /markdown input/i }), '# Attachments');
    await user.upload(screen.getByLabelText(/select attachments/i), [image, pdf]);

    expect(screen.getByText('screen.png')).toBeInTheDocument();
    expect(screen.getByText('brief.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await screen.findByRole('button', { name: /attachments/i });
    expect(relayMocks.createMessage).toHaveBeenCalledWith(
      supabaseClientMock,
      'test-room-key',
      '# Attachments',
      'MacBook',
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ clientId: expect.any(String), file: image }),
          expect.objectContaining({ clientId: expect.any(String), file: pdf }),
        ],
      }),
    );
    expect(screen.getByRole('button', { name: /screen\.png/i })).toBeInTheDocument();
    expect(screen.getByText('brief.pdf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute(
      'href',
      'https://storage.example/signed/brief.pdf',
    );

    await user.click(screen.getByRole('button', { name: /screen\.png/i }));

    expect(await screen.findByRole('img', { name: 'screen.png' })).toHaveAttribute(
      'src',
      'https://storage.example/signed/screen.png',
    );
  });

  it('shows inline attachment validation errors for count and size limits', async () => {
    const user = userEvent.setup();
    localStorage.setItem('anytext.roomKey', 'test-room-key');

    render(<App />);

    const tooMany = Array.from(
      { length: 11 },
      (_, index) => new File([new Uint8Array([1])], `file-${index}.txt`, { type: 'text/plain' }),
    );

    await user.upload(screen.getByLabelText(/select attachments/i), tooMany);

    expect(screen.getByText('Maximum 10 attachments.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled();

    await user.click(screen.getByLabelText('Remove file-0.txt'));

    const large = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'large.zip', { type: 'application/zip' });

    await user.upload(screen.getByLabelText(/select attachments/i), [large]);

    expect(screen.getByText('large.zip is over 25MB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled();
  });
});
