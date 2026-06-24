import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyMessageRealtimeEvent,
  createAttachmentDownloadUrl,
  createMessage,
  createRoom,
  deleteMessage,
  listMessages,
  subscribeToRoomMessages,
} from './supabaseRelay';

const roomKey = 'abc';
const roomId = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '7e34c8d2-d926-4473-8975-28cad36785b2',
    room_id: roomId,
    kind: 'bundle',
    markdown_text: '# Hello',
    text_size: 7,
    sender_device_name: 'MacBook',
    created_at: '2099-06-24T12:00:00.000Z',
    expires_at: '2099-06-24T13:00:00.000Z',
    deleted_at: null,
    attachments: [],
    ...overrides,
  };
}

function makeRpcClient(dataByName: Record<string, unknown> = {}) {
  const rpc = vi.fn(async (name: string) => ({
    data: dataByName[name] ?? null,
    error: null,
  }));

  return { rpc };
}

function attachmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '32adbc27-3d7b-42da-92ea-e08bc24ef3de',
    message_id: '7e34c8d2-d926-4473-8975-28cad36785b2',
    room_id: roomId,
    file_name: 'screen.png',
    file_type: 'PNG',
    mime_type: 'image/png',
    file_size: 128,
    preview_kind: 'image',
    created_at: '2099-06-24T12:00:02.000Z',
    expires_at: '2099-06-24T13:00:00.000Z',
    deleted_at: null,
    storage_path:
      'rooms/ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad/messages/7e34c8d2-d926-4473-8975-28cad36785b2/32adbc27-3d7b-42da-92ea-e08bc24ef3de-screen.png',
    upload_status: 'uploaded',
    ...overrides,
  };
}

function makeStorageClient(dataByName: Record<string, unknown> = {}) {
  const rpc = vi.fn(async (name: string) => ({
    data: dataByName[name] ?? null,
    error: null,
  }));
  const createSignedUploadUrl = vi.fn(async (path: string) => ({
    data: { path, signedUrl: `https://storage.example/upload/${encodeURIComponent(path)}`, token: `token-${path}` },
    error: null,
  }));
  const uploadToSignedUrl = vi.fn(async (path: string) => ({
    data: { path, fullPath: `anytext-attachments/${path}` },
    error: null,
  }));
  const from = vi.fn(() => ({ createSignedUploadUrl, uploadToSignedUrl }));
  const invoke = vi.fn(<T = unknown>() => Promise.resolve({
    data: { signedUrl: 'https://storage.example/signed/screen.png', expiresIn: 60 } as T,
    error: null,
  }));

  return {
    rpc,
    storage: { from },
    functions: { invoke },
    createSignedUploadUrl,
    uploadToSignedUrl,
    invoke,
  };
}

describe('Supabase RPC relay boundary', () => {
  it('creates rooms through a restricted RPC using only sha256(roomKey)', async () => {
    const client = makeRpcClient({
      anytext_create_room: { id: roomId, expires_policy_minutes: 60 },
    });

    await expect(createRoom(client, roomKey, 'MacBook')).resolves.toEqual({
      roomId,
      expiresPolicyMinutes: 60,
    });

    expect(client.rpc).toHaveBeenCalledWith('anytext_create_room', {
      p_device_name: 'MacBook',
      p_room_id: roomId,
    });
    expect(JSON.stringify(client.rpc.mock.calls)).not.toContain(roomKey);
  });

  it('lists active messages through RPC and maps database rows with attachments to queue items', async () => {
    const client = makeRpcClient({
      anytext_list_messages: [messageRow({ attachments: [attachmentRow()] })],
    });

    await expect(listMessages(client, roomKey)).resolves.toEqual([
      {
        id: '7e34c8d2-d926-4473-8975-28cad36785b2',
        markdown: '# Hello',
        attachments: [
          {
            id: '32adbc27-3d7b-42da-92ea-e08bc24ef3de',
            fileName: 'screen.png',
            fileSize: 128,
            fileType: 'PNG',
            messageId: '7e34c8d2-d926-4473-8975-28cad36785b2',
            mimeType: 'image/png',
            previewKind: 'image',
          },
        ],
        senderDeviceName: 'MacBook',
        createdAt: '2099-06-24T12:00:00.000Z',
        expiresAt: '2099-06-24T13:00:00.000Z',
      },
    ]);

    expect(client.rpc).toHaveBeenCalledWith('anytext_list_messages', { p_room_id: roomId });
  });

  it('creates text-only messages through RPC', async () => {
    const client = makeRpcClient({
      anytext_create_message: messageRow({ markdown_text: '```bash\nnpm test\n```', text_size: 19 }),
    });

    await expect(createMessage(client, roomKey, '```bash\nnpm test\n```', 'iPad')).resolves.toMatchObject({
      markdown: '```bash\nnpm test\n```',
      senderDeviceName: 'MacBook',
    });

    expect(client.rpc).toHaveBeenCalledWith('anytext_create_message', {
      p_attachments: [],
      p_markdown_text: '```bash\nnpm test\n```',
      p_room_id: roomId,
      p_sender_device_name: 'iPad',
    });
  });

  it('creates one message with attachment metadata, signed upload URLs, upload completion, and finalize', async () => {
    const storagePath =
      'rooms/ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad/messages/7e34c8d2-d926-4473-8975-28cad36785b2/32adbc27-3d7b-42da-92ea-e08bc24ef3de-screen.png';
    const file = new File([new Uint8Array([1, 2, 3])], 'screen.png', { type: 'image/png' });
    const client = makeStorageClient({
      anytext_create_message: messageRow({
        attachments: [
          attachmentRow({
            client_id: 'client-1',
            storage_path: storagePath,
            upload_status: 'pending',
          }),
        ],
      }),
      anytext_mark_attachment_uploaded: attachmentRow({ storage_path: storagePath }),
      anytext_finalize_message_uploads: messageRow({
        markdown_text: '# With image',
        attachments: [attachmentRow({ storage_path: storagePath })],
      }),
    });

    await expect(
      createMessage(client, roomKey, '# With image', 'iPad', {
        attachments: [{ clientId: 'client-1', file }],
        onAttachmentProgress: vi.fn(),
      }),
    ).resolves.toMatchObject({
      attachments: [
        {
          fileName: 'screen.png',
          messageId: '7e34c8d2-d926-4473-8975-28cad36785b2',
          previewKind: 'image',
        },
      ],
      markdown: '# With image',
    });

    expect(client.rpc).toHaveBeenCalledWith('anytext_create_message', {
      p_attachments: [
        {
          client_id: 'client-1',
          file_name: 'screen.png',
          file_size: 3,
          file_type: 'PNG',
          mime_type: 'image/png',
          preview_kind: 'image',
        },
      ],
      p_markdown_text: '# With image',
      p_room_id: roomId,
      p_sender_device_name: 'iPad',
    });
    expect(client.storage.from).toHaveBeenCalledWith('anytext-attachments');
    expect(client.createSignedUploadUrl).toHaveBeenCalledWith(storagePath, { upsert: false });
    expect(client.uploadToSignedUrl).toHaveBeenCalledWith(storagePath, `token-${storagePath}`, file, {
      cacheControl: '3600',
      contentType: 'image/png',
      upsert: false,
    });
    expect(client.rpc).toHaveBeenCalledWith('anytext_mark_attachment_uploaded', {
      p_attachment_id: '32adbc27-3d7b-42da-92ea-e08bc24ef3de',
      p_message_id: '7e34c8d2-d926-4473-8975-28cad36785b2',
      p_room_id: roomId,
    });
    expect(client.rpc).toHaveBeenCalledWith('anytext_finalize_message_uploads', {
      p_message_id: '7e34c8d2-d926-4473-8975-28cad36785b2',
      p_room_id: roomId,
    });
  });

  it('creates short-lived download URLs through the restricted Edge Function', async () => {
    const client = makeStorageClient();

    await expect(
      createAttachmentDownloadUrl(client as unknown as Parameters<typeof createAttachmentDownloadUrl>[0], roomKey, {
        attachmentId: '32adbc27-3d7b-42da-92ea-e08bc24ef3de',
        messageId: '7e34c8d2-d926-4473-8975-28cad36785b2',
        download: true,
      }),
    ).resolves.toEqual({
      expiresIn: 60,
      signedUrl: 'https://storage.example/signed/screen.png',
    });

    expect(client.invoke).toHaveBeenCalledWith('anytext-create-download-url', {
      body: {
        attachmentId: '32adbc27-3d7b-42da-92ea-e08bc24ef3de',
        download: true,
        messageId: '7e34c8d2-d926-4473-8975-28cad36785b2',
        roomId,
      },
    });
  });

  it('soft deletes messages through RPC scoped to the room hash', async () => {
    const client = makeRpcClient({
      anytext_delete_message: messageRow({ deleted_at: '2026-06-24T12:10:00.000Z' }),
    });

    await deleteMessage(client, roomKey, '7e34c8d2-d926-4473-8975-28cad36785b2');

    expect(client.rpc).toHaveBeenCalledWith('anytext_delete_message', {
      p_message_id: '7e34c8d2-d926-4473-8975-28cad36785b2',
      p_room_id: roomId,
    });
  });

  it('applies insert and soft-delete realtime events to the active queue', () => {
    const inserted = applyMessageRealtimeEvent([], {
      event: 'INSERT',
      payload: { new: messageRow() },
    });

    expect(inserted).toHaveLength(1);

    const deleted = applyMessageRealtimeEvent(inserted, {
      event: 'UPDATE',
      payload: {
        new: messageRow({ deleted_at: '2026-06-24T12:10:00.000Z' }),
        old: messageRow(),
      },
    });

    expect(deleted).toEqual([]);
  });

  it('understands Supabase broadcast_changes record payloads', () => {
    const inserted = applyMessageRealtimeEvent([], {
      event: 'INSERT',
      payload: {
        type: 'broadcast',
        payload: {
          operation: 'INSERT',
          record: messageRow({ markdown_text: '# From broadcast_changes' }),
          old_record: null,
        },
      },
    });

    expect(inserted[0]?.markdown).toBe('# From broadcast_changes');

    const deleted = applyMessageRealtimeEvent(inserted, {
      event: 'UPDATE',
      payload: {
        type: 'broadcast',
        payload: {
          operation: 'UPDATE',
          record: messageRow({ deleted_at: '2099-06-24T12:10:00.000Z' }),
          old_record: messageRow(),
        },
      },
    });

    expect(deleted).toEqual([]);
  });
});

describe('Supabase realtime subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to private room broadcasts and reports disconnect states', async () => {
    const onEvent = vi.fn();
    const onStatusChange = vi.fn();
    const subscribe = vi.fn((callback: (status: string) => void) => {
      callback('SUBSCRIBED');
      callback('CHANNEL_ERROR');
      return { unsubscribe: vi.fn() };
    });
    const on = vi.fn(() => ({ on, subscribe }));
    const channel = vi.fn(() => ({ on, subscribe }));
    const setAuth = vi.fn();
    const removeChannel = vi.fn();
    const client = { channel, realtime: { setAuth }, removeChannel };

    const subscription = await subscribeToRoomMessages(client, roomKey, { onEvent, onStatusChange });

    expect(setAuth).toHaveBeenCalled();
    expect(channel).toHaveBeenCalledWith(`anytext:room:${roomId}`, { config: { private: true } });
    expect(on).toHaveBeenCalledWith('broadcast', { event: 'INSERT' }, expect.any(Function));
    expect(on).toHaveBeenCalledWith('broadcast', { event: 'UPDATE' }, expect.any(Function));
    expect(on).toHaveBeenCalledWith('broadcast', { event: 'DELETE' }, expect.any(Function));
    expect(onStatusChange).toHaveBeenNthCalledWith(1, 'connected');
    expect(onStatusChange).toHaveBeenNthCalledWith(2, 'disconnected');

    subscription.unsubscribe();

    expect(removeChannel).toHaveBeenCalled();
  });
});
