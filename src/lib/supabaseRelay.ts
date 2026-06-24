import type { QueueItem } from './anytext';
import { getActiveQueueItems, hashRoomKey, validateMarkdown } from './anytext';

type RpcError = {
  message?: string;
};

type RpcResult = {
  data: unknown;
  error: RpcError | null;
};

export type AnyTextRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
};

type AnyTextRealtimeChannel = {
  on: (
    type: string,
    filter: { event: 'INSERT' | 'UPDATE' | 'DELETE' },
    callback: (payload: unknown) => void,
  ) => AnyTextRealtimeChannel;
  subscribe: (callback: (status: string) => void) => { unsubscribe?: () => void } | AnyTextRealtimeChannel;
  unsubscribe?: () => void;
};

export type AnyTextRealtimeClient = {
  channel: (name: string, options: { config: { private: true } }) => AnyTextRealtimeChannel;
  realtime?: {
    setAuth?: () => void | Promise<void>;
  };
  removeChannel?: (channel: AnyTextRealtimeChannel) => void | Promise<unknown>;
};

export type RealtimeStatus = 'connected' | 'disconnected';

export type MessageRealtimeEvent = {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: unknown;
};

type MessageRow = {
  id: string;
  room_id: string;
  markdown_text: string | null;
  sender_device_name: string | null;
  created_at: string;
  expires_at: string;
  deleted_at: string | null;
};

type RoomRow = {
  id: string;
  expires_policy_minutes: number;
};

export async function createRoom(
  client: AnyTextRpcClient,
  roomKey: string,
  deviceName: string,
): Promise<{ roomId: string; expiresPolicyMinutes: number }> {
  const roomId = await hashRoomKey(roomKey);
  const row = await callRpc<RoomRow>(client, 'anytext_create_room', {
    p_room_id: roomId,
    p_device_name: deviceName,
  });

  return {
    roomId: row.id,
    expiresPolicyMinutes: row.expires_policy_minutes,
  };
}

export async function listMessages(client: AnyTextRpcClient, roomKey: string): Promise<QueueItem[]> {
  const roomId = await hashRoomKey(roomKey);
  const rows = await callRpc<MessageRow[]>(client, 'anytext_list_messages', { p_room_id: roomId });

  return getActiveQueueItems(rows.map(mapMessageRow));
}

export async function createMessage(
  client: AnyTextRpcClient,
  roomKey: string,
  markdown: string,
  senderDeviceName: string,
  options: { attachments?: unknown[] } = {},
): Promise<QueueItem> {
  if (options.attachments?.length) {
    throw new Error('Attachments are not enabled for the text-only Supabase relay.');
  }

  const validation = validateMarkdown(markdown);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  if (!markdown.trim()) {
    throw new Error('Markdown is required for the text-only relay.');
  }

  const roomId = await hashRoomKey(roomKey);
  const row = await callRpc<MessageRow>(client, 'anytext_create_message', {
    p_room_id: roomId,
    p_markdown_text: markdown,
    p_sender_device_name: senderDeviceName,
  });

  return mapMessageRow(row);
}

export async function deleteMessage(client: AnyTextRpcClient, roomKey: string, messageId: string): Promise<void> {
  const roomId = await hashRoomKey(roomKey);

  await callRpc<MessageRow>(client, 'anytext_delete_message', {
    p_room_id: roomId,
    p_message_id: messageId,
  });
}

export function applyMessageRealtimeEvent(items: QueueItem[], event: MessageRealtimeEvent, now = new Date()): QueueItem[] {
  const row = extractMessageRow(event.payload);

  if (event.event === 'DELETE') {
    const deletedId = row?.id ?? extractOldMessageRow(event.payload)?.id;
    return deletedId ? items.filter((item) => item.id !== deletedId) : items;
  }

  if (!row) {
    return items;
  }

  const withoutCurrent = items.filter((item) => item.id !== row.id);

  if (row.deleted_at || new Date(row.expires_at).getTime() <= now.getTime()) {
    return getActiveQueueItems(withoutCurrent, now);
  }

  return getActiveQueueItems([mapMessageRow(row), ...withoutCurrent], now);
}

export async function subscribeToRoomMessages(
  client: AnyTextRealtimeClient,
  roomKey: string,
  handlers: {
    onEvent: (event: MessageRealtimeEvent) => void;
    onStatusChange: (status: RealtimeStatus) => void;
  },
): Promise<{ unsubscribe: () => void }> {
  const roomId = await hashRoomKey(roomKey);

  await client.realtime?.setAuth?.();

  let channel = client.channel(`anytext:room:${roomId}`, { config: { private: true } });
  channel = channel.on('broadcast', { event: 'INSERT' }, (payload) => handlers.onEvent({ event: 'INSERT', payload }));
  channel = channel.on('broadcast', { event: 'UPDATE' }, (payload) => handlers.onEvent({ event: 'UPDATE', payload }));
  channel = channel.on('broadcast', { event: 'DELETE' }, (payload) => handlers.onEvent({ event: 'DELETE', payload }));

  const subscription = channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      handlers.onStatusChange('connected');
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      handlers.onStatusChange('disconnected');
    }
  });

  return {
    unsubscribe: () => {
      subscription.unsubscribe?.();
      client.removeChannel?.(channel);
    },
  };
}

function mapMessageRow(row: MessageRow): QueueItem {
  return {
    id: row.id,
    markdown: row.markdown_text ?? '',
    attachments: [],
    senderDeviceName: row.sender_device_name ?? 'Unknown device',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

async function callRpc<T>(client: AnyTextRpcClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);

  if (error) {
    throw new Error(error.message ?? `${name} failed`);
  }

  if (!data) {
    throw new Error(`${name} returned no data`);
  }

  return data as T;
}

function extractMessageRow(payload: unknown): MessageRow | null {
  if (!isRecord(payload)) {
    return null;
  }

  const nestedPayload = payload.payload;

  if (isMessageRow(nestedPayload)) {
    return nestedPayload;
  }

  if (isRecord(nestedPayload) && isMessageRow(nestedPayload.new)) {
    return nestedPayload.new;
  }

  if (isRecord(nestedPayload) && isMessageRow(nestedPayload.record)) {
    return nestedPayload.record;
  }

  if (isMessageRow(payload.new)) {
    return payload.new;
  }

  return null;
}

function extractOldMessageRow(payload: unknown): MessageRow | null {
  if (!isRecord(payload)) {
    return null;
  }

  const nestedPayload = payload.payload;

  if (isRecord(nestedPayload) && isMessageRow(nestedPayload.old)) {
    return nestedPayload.old;
  }

  if (isRecord(nestedPayload) && isMessageRow(nestedPayload.old_record)) {
    return nestedPayload.old_record;
  }

  if (isMessageRow(payload.old)) {
    return payload.old;
  }

  return null;
}

function isMessageRow(value: unknown): value is MessageRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.room_id === 'string' &&
    typeof value.created_at === 'string' &&
    typeof value.expires_at === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
