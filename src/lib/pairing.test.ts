import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEVICE_NAME_STORAGE,
  ROOM_KEY_STORAGE,
  buildJoinLink,
  getInitialRoomKey,
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
    history.replaceState(null, '', '/AnyText/?room=url-room-key');

    expect(getInitialRoomKey()).toBe('url-room-key');
    expect(localStorage.getItem(ROOM_KEY_STORAGE)).toBe('url-room-key');
  });

  it('builds shareable join links without storing the raw room key outside local storage', () => {
    expect(buildJoinLink('secret-room-key', new URL('https://example.com/AnyText/'))).toBe(
      'https://example.com/AnyText/?room=secret-room-key',
    );

    saveRoomKey('secret-room-key');
    saveDeviceName('iPhone');

    expect(localStorage.getItem(ROOM_KEY_STORAGE)).toBe('secret-room-key');
    expect(localStorage.getItem(DEVICE_NAME_STORAGE)).toBe('iPhone');
  });
});
