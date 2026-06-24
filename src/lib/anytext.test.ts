import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_LIMITS,
  MARKDOWN_LIMIT_BYTES,
  classifyAttachment,
  createMockQueueItem,
  formatBytes,
  formatTimeRemaining,
  generateRoomKey,
  getActiveQueueItems,
  getItemTimeState,
  hashRoomKey,
  validateAttachments,
  validateMarkdown,
} from './anytext';

const makeFile = (name: string, size: number, type: string) => new File([new Uint8Array(size)], name, { type });

describe('AnyText room helpers', () => {
  it('generates a high-entropy url-safe room key', () => {
    const key = generateRoomKey();

    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(key.length).toBeGreaterThanOrEqual(22);
  });

  it('hashes the raw room key with sha256 hex', async () => {
    await expect(hashRoomKey('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('AnyText validation helpers', () => {
  it('allows Markdown up to 500KB and rejects anything larger', () => {
    expect(MARKDOWN_LIMIT_BYTES).toBe(500 * 1024);
    expect(validateMarkdown('a'.repeat(MARKDOWN_LIMIT_BYTES)).valid).toBe(true);

    const result = validateMarkdown('a'.repeat(MARKDOWN_LIMIT_BYTES + 1));

    expect(result).toEqual({
      valid: false,
      bytes: MARKDOWN_LIMIT_BYTES + 1,
      message: 'Markdown is over 500KB.',
    });
  });

  it('limits attachments to 10 files and 25MB per file', () => {
    expect(ATTACHMENT_LIMITS.maxCount).toBe(10);
    expect(ATTACHMENT_LIMITS.maxFileBytes).toBe(25 * 1024 * 1024);

    expect(validateAttachments(Array.from({ length: 11 }, (_, i) => makeFile(`f-${i}.txt`, 4, 'text/plain')))).toEqual([
      'Maximum 10 attachments.',
    ]);

    expect(
      validateAttachments([makeFile('large.zip', ATTACHMENT_LIMITS.maxFileBytes + 1, 'application/zip')]),
    ).toEqual(['large.zip is over 25MB.']);
  });

  it('classifies common images as previews and other files as downloads', () => {
    expect(classifyAttachment(makeFile('screen.png', 24, 'image/png'))).toBe('image');
    expect(classifyAttachment(makeFile('notes.pdf', 24, 'application/pdf'))).toBe('download');
    expect(classifyAttachment(makeFile('vector.svg', 24, 'image/svg+xml'))).toBe('download');
  });

  it('formats file sizes for attachment rows', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });
});

describe('AnyText expiry and queue helpers', () => {
  it('creates mock queue items with one-hour expiry and sorted active queue', () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    const old = createMockQueueItem({
      markdown: 'older',
      now,
      senderDeviceName: 'MacBook',
      id: 'old',
    });
    const newer = createMockQueueItem({
      markdown: 'newer',
      now: new Date(now.getTime() + 1000),
      senderDeviceName: 'iPhone',
      id: 'new',
    });

    expect(old.expiresAt).toBe('2026-06-24T13:00:00.000Z');
    expect(getActiveQueueItems([old, newer], now).map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('hides expired or deleted queue items', () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    const active = createMockQueueItem({ markdown: 'active', now, id: 'active' });
    const expired = { ...active, id: 'expired', expiresAt: '2026-06-24T11:59:59.000Z' };
    const deleted = { ...active, id: 'deleted', deletedAt: '2026-06-24T12:00:00.000Z' };

    expect(getActiveQueueItems([active, expired, deleted], now).map((item) => item.id)).toEqual(['active']);
  });

  it('formats time remaining and expired state', () => {
    const now = new Date('2026-06-24T12:00:00.000Z');

    expect(formatTimeRemaining('2026-06-24T13:00:00.000Z', now)).toBe('1h left');
    expect(formatTimeRemaining('2026-06-24T12:42:00.000Z', now)).toBe('42m left');
    expect(formatTimeRemaining('2026-06-24T12:00:30.000Z', now)).toBe('<1m left');
    expect(getItemTimeState('2026-06-24T11:59:59.000Z', now)).toEqual({
      expired: true,
      remainingMs: 0,
    });
  });
});
