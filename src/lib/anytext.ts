export const MARKDOWN_LIMIT_BYTES = 500 * 1024;

export const ATTACHMENT_LIMITS = {
  maxCount: 10,
  maxFileBytes: 25 * 1024 * 1024,
} as const;

export const ROOM_KEY_SYMBOLS = '!@#$%^&*';
export const ROOM_KEY_PATTERN = /^\d{6}[!@#$%^&*]$/;

export type AttachmentPreviewKind = 'image' | 'download';

export interface QueueAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  previewKind: AttachmentPreviewKind;
  objectUrl?: string;
}

export interface AttachmentInput {
  client_id: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  preview_kind: AttachmentPreviewKind;
}

export interface QueueItem {
  id: string;
  markdown: string;
  attachments: QueueAttachment[];
  senderDeviceName: string;
  createdAt: string;
  expiresAt: string;
  deletedAt?: string;
}

export function generateRoomKey(): string {
  const digits = Array.from({ length: 6 }, () => randomInt(10)).join('');
  const symbol = ROOM_KEY_SYMBOLS[randomInt(ROOM_KEY_SYMBOLS.length)];

  return `${digits}${symbol}`;
}

export async function hashRoomKey(roomKey: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(roomKey));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validateMarkdown(markdown: string): { valid: boolean; bytes: number; message?: string } {
  const bytes = new TextEncoder().encode(markdown).byteLength;

  if (bytes > MARKDOWN_LIMIT_BYTES) {
    return {
      valid: false,
      bytes,
      message: 'Markdown is over 500KB.',
    };
  }

  return { valid: true, bytes };
}

export function validateAttachments(files: File[]): string[] {
  const errors: string[] = [];

  if (files.length > ATTACHMENT_LIMITS.maxCount) {
    errors.push('Maximum 10 attachments.');
  }

  for (const file of files) {
    if (file.size > ATTACHMENT_LIMITS.maxFileBytes) {
      errors.push(`${file.name} is over 25MB.`);
    }
  }

  return errors;
}

export function classifyAttachment(file: File): AttachmentPreviewKind {
  const previewableImageTypes = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);

  return previewableImageTypes.has(file.type) ? 'image' : 'download';
}

export function createAttachmentInput(file: File, clientId: string): AttachmentInput {
  return {
    client_id: clientId,
    file_name: file.name,
    file_type: getFileTypeLabel(file),
    mime_type: file.type || 'application/octet-stream',
    file_size: file.size,
    preview_kind: classifyAttachment(file),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${trimTrailingZero(value)} ${units[unitIndex]}`;
}

export function createMockQueueItem(input: {
  markdown: string;
  files?: File[];
  now?: Date;
  senderDeviceName?: string;
  id?: string;
}): QueueItem {
  const createdAt = input.now ?? new Date();
  const expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
  const id = input.id ?? createId();

  return {
    id,
    markdown: input.markdown,
    attachments: (input.files ?? []).map((file) => ({
      id: createId(),
      messageId: id,
      fileName: file.name,
      fileType: getFileTypeLabel(file),
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      previewKind: classifyAttachment(file),
    })),
    senderDeviceName: input.senderDeviceName ?? 'This device',
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function getActiveQueueItems(items: QueueItem[], now = new Date()): QueueItem[] {
  return items
    .filter((item) => !item.deletedAt && !getItemTimeState(item.expiresAt, now).expired)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getItemTimeState(expiresAt: string, now = new Date()): { expired: boolean; remainingMs: number } {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now.getTime());

  return {
    expired: remainingMs === 0,
    remainingMs,
  };
}

export function formatTimeRemaining(expiresAt: string, now = new Date()): string {
  const state = getItemTimeState(expiresAt, now);

  if (state.expired) {
    return 'Expired';
  }

  if (state.remainingMs < 60_000) {
    return '<1m left';
  }

  const minutes = Math.ceil(state.remainingMs / 60_000);

  if (minutes < 60) {
    return `${minutes}m left`;
  }

  const hours = Math.max(1, Math.floor(minutes / 60));

  return `${hours}h left`;
}

function randomInt(maxExclusive: number): number {
  const limit = Math.floor(256 / maxExclusive) * maxExclusive;
  const byte = new Uint8Array(1);

  do {
    globalThis.crypto.getRandomValues(byte);
  } while (byte[0] >= limit);

  return byte[0] % maxExclusive;
}

function createId(): string {
  return globalThis.crypto.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFileTypeLabel(file: File): string {
  const extension = file.name.split('.').pop();

  if (extension && extension !== file.name) {
    return extension.toUpperCase();
  }

  return file.type || 'file';
}

function trimTrailingZero(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, '');
}
