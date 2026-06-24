import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyMessageRealtimeEvent,
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

  it('lists active messages through RPC and maps database rows to queue items', async () => {
    const client = makeRpcClient({
      anytext_list_messages: [messageRow()],
    });

    await expect(listMessages(client, roomKey)).resolves.toEqual([
      {
        id: '7e34c8d2-d926-4473-8975-28cad36785b2',
        markdown: '# Hello',
        attachments: [],
        senderDeviceName: 'MacBook',
        createdAt: '2099-06-24T12:00:00.000Z',
        expiresAt: '2099-06-24T13:00:00.000Z',
      },
    ]);

    expect(client.rpc).toHaveBeenCalledWith('anytext_list_messages', { p_room_id: roomId });
  });

  it('creates text-only messages through RPC and rejects attachment attempts in this phase', async () => {
    const client = makeRpcClient({
      anytext_create_message: messageRow({ markdown_text: '```bash\nnpm test\n```', text_size: 19 }),
    });

    await expect(createMessage(client, roomKey, '```bash\nnpm test\n```', 'iPad')).resolves.toMatchObject({
      markdown: '```bash\nnpm test\n```',
      senderDeviceName: 'MacBook',
    });

    expect(client.rpc).toHaveBeenCalledWith('anytext_create_message', {
      p_markdown_text: '```bash\nnpm test\n```',
      p_room_id: roomId,
      p_sender_device_name: 'iPad',
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
