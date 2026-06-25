import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEVICE_NAME_STORAGE,
  ROOM_KEY_STORAGE,
  buildJoinLink,
  formatManualPairingCode,
  getInitialRoomKey,
  normalizeRoomKeyInput,
  saveDeviceName,
  saveRoomKey,
} from './pairing';

describe('pairing helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/AnyText/');
  });

  it('prefers a persisted room key over URL pairing params', () => {
    localStorage.setItem(ROOM_KEY_STORAGE, 'persisted-key');
    history.replaceState(null, '', '/AnyText/?room=url-key');

    expect(getInitialRoomKey()).toBe('persisted-key');
  });

  it('stores a room key from the join URL when no browser pairing exists', () => {
    history.replaceState(null, '', '/AnyText/?room=123%20456%20%26');

    expect(getInitialRoomKey()).toBe('123456&');
    expect(localStorage.getItem(ROOM_KEY_STORAGE)).toBe('123456&');
  });

  it('formats manual pairing codes while preserving the raw stored value', () => {
    expect(normalizeRoomKeyInput('126 393 $')).toBe('126393$');
    expect(formatManualPairingCode('126393$')).toBe('126 393 $');
    expect(formatManualPairingCode('legacy-key')).toBe('legacy-key');
  });

  it('builds encoded shareable join links without storing the raw room key outside local storage', () => {
    expect(buildJoinLink('123456#', new URL('https://example.com/AnyText/'))).toBe(
      'https://example.com/AnyText/?room=123456%23',
    );

    saveRoomKey('123456#');
    saveDeviceName('iPhone');

    expect(localStorage.getItem(ROOM_KEY_STORAGE)).toBe('123456#');
    expect(localStorage.getItem(DEVICE_NAME_STORAGE)).toBe('iPhone');
  });
});
