import type { AttachmentPreviewKind, QueueAttachment, QueueItem } from './anytext';
import { createAttachmentInput, getActiveQueueItems, hashRoomKey, validateAttachments, validateMarkdown } from './anytext';

const ATTACHMENT_BUCKET = 'anytext-attachments';

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

type StorageError = {
  message?: string;
};

type SignedUploadResult = {
  data: { path: string; signedUrl: string; token: string } | null;
  error: StorageError | null;
};

type UploadResult = {
  data: { path: string; fullPath: string } | null;
  error: StorageError | null;
};

export type AnyTextStorageClient = AnyTextRpcClient & {
  storage: {
    from: (bucket: string) => {
      createSignedUploadUrl: (path: string, options: { upsert: false }) => PromiseLike<SignedUploadResult>;
      uploadToSignedUrl: (
        path: string,
        token: string,
        file: File,
        options: { cacheControl: string; contentType: string; upsert: false },
      ) => PromiseLike<UploadResult>;
    };
  };
};

type FunctionError = {
  message?: string;
};

export type AnyTextFunctionsClient = {
  functions: {
    invoke: <T = unknown>(
      name: string,
      options: { body: Record<string, unknown> },
    ) => PromiseLike<{ data: T | null; error: FunctionError | null }>;
  };
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
  attachments?: AttachmentRow[];
};

type AttachmentRow = {
  id: string;
  client_id?: string | null;
  message_id: string;
  room_id: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  storage_path?: string;
  preview_kind: AttachmentPreviewKind;
  created_at: string;
  expires_at: string;
  deleted_at: string | null;
  upload_status?: string;
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
  client: AnyTextRpcClient | (AnyTextStorageClient & AnyTextFunctionsClient),
  roomKey: string,
  markdown: string,
  senderDeviceName: string,
  options: {
    attachments?: Array<{ clientId: string; file: File }>;
    onAttachmentProgress?: (progress: AttachmentUploadProgress) => void;
  } = {},
): Promise<QueueItem> {
  const attachments = options.attachments ?? [];
  const validation = validateMarkdown(markdown);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const attachmentErrors = validateAttachments(attachments.map((attachment) => attachment.file));

  if (attachmentErrors.length > 0) {
    throw new Error(attachmentErrors[0]);
  }

  if (!markdown.trim() && attachments.length === 0) {
    throw new Error('Markdown or attachment is required.');
  }

  const roomId = await hashRoomKey(roomKey);
  let row = await callRpc<MessageRow>(client, 'anytext_create_message', {
    p_room_id: roomId,
    p_markdown_text: markdown,
    p_sender_device_name: senderDeviceName,
    p_attachments: attachments.map((attachment) => createAttachmentInput(attachment.file, attachment.clientId)),
  });

  if (attachments.length > 0) {
    if (!hasStorageClient(client)) {
      throw new Error('Supabase Storage client is required for attachments.');
    }

    try {
      await uploadAttachments(client, roomId, row, attachments, options.onAttachmentProgress);
      row = await callRpc<MessageRow>(client, 'anytext_finalize_message_uploads', {
        p_room_id: roomId,
        p_message_id: row.id,
      });
    } catch (error) {
      await callRpc<MessageRow>(client, 'anytext_delete_message', {
        p_room_id: roomId,
        p_message_id: row.id,
      }).catch(() => undefined);
      throw error;
    }
  }

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

export type AttachmentUploadProgress = {
  clientId: string;
  fileName: string;
  status: 'queued' | 'signing' | 'uploading' | 'uploaded' | 'failed';
  progress: number;
  message?: string;
};

export async function createAttachmentDownloadUrl(
  client: AnyTextFunctionsClient,
  roomKey: string,
  input: { messageId: string; attachmentId: string; download?: boolean },
): Promise<{ signedUrl: string; expiresIn: number }> {
  const roomId = await hashRoomKey(roomKey);
  const { data, error } = await client.functions.invoke<{ signedUrl: string; expiresIn: number }>(
    'anytext-create-download-url',
    {
      body: {
        roomId,
        messageId: input.messageId,
        attachmentId: input.attachmentId,
        download: input.download ?? false,
      },
    },
  );

  if (error) {
    throw new Error(error.message ?? 'Failed to create download URL.');
  }

  if (!data?.signedUrl) {
    throw new Error('Download URL function returned no URL.');
  }

  return data;
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
    attachments: Array.isArray(row.attachments) ? row.attachments.map(mapAttachmentRow) : [],
    senderDeviceName: row.sender_device_name ?? 'Unknown device',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

function mapAttachmentRow(row: AttachmentRow): QueueAttachment {
  return {
    id: row.id,
    messageId: row.message_id,
    fileName: row.file_name,
    fileType: row.file_type,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    previewKind: row.preview_kind,
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

async function uploadAttachments(
  client: AnyTextStorageClient,
  roomId: string,
  row: MessageRow,
  attachments: Array<{ clientId: string; file: File }>,
  onAttachmentProgress: ((progress: AttachmentUploadProgress) => void) | undefined,
) {
  const targets = Array.isArray(row.attachments) ? row.attachments : [];
  const storage = client.storage.from(ATTACHMENT_BUCKET);

  for (const attachment of attachments) {
    const target = targets.find((candidate) => candidate.client_id === attachment.clientId);

    if (!target?.storage_path) {
      throw new Error(`${attachment.file.name} did not receive an upload target.`);
    }

    try {
      onAttachmentProgress?.({
        clientId: attachment.clientId,
        fileName: attachment.file.name,
        progress: 8,
        status: 'signing',
      });

      const signed = await storage.createSignedUploadUrl(target.storage_path, { upsert: false });

      if (signed.error || !signed.data?.token) {
        throw new Error(signed.error?.message ?? `${attachment.file.name} upload URL failed.`);
      }

      onAttachmentProgress?.({
        clientId: attachment.clientId,
        fileName: attachment.file.name,
        progress: 45,
        status: 'uploading',
      });

      const uploaded = await storage.uploadToSignedUrl(target.storage_path, signed.data.token, attachment.file, {
        cacheControl: '3600',
        contentType: attachment.file.type || 'application/octet-stream',
        upsert: false,
      });

      if (uploaded.error) {
        throw new Error(uploaded.error.message ?? `${attachment.file.name} upload failed.`);
      }

      await callRpc<AttachmentRow>(client, 'anytext_mark_attachment_uploaded', {
        p_room_id: roomId,
        p_message_id: row.id,
        p_attachment_id: target.id,
      });

      onAttachmentProgress?.({
        clientId: attachment.clientId,
        fileName: attachment.file.name,
        progress: 100,
        status: 'uploaded',
      });
    } catch (error) {
      onAttachmentProgress?.({
        clientId: attachment.clientId,
        fileName: attachment.file.name,
        message: error instanceof Error ? error.message : `${attachment.file.name} upload failed.`,
        progress: 100,
        status: 'failed',
      });
      throw error;
    }
  }
}

function hasStorageClient(client: AnyTextRpcClient | AnyTextStorageClient): client is AnyTextStorageClient {
  return 'storage' in client;
}
