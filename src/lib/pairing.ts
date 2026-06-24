export const ROOM_KEY_STORAGE = 'anytext.roomKey';
export const DEVICE_NAME_STORAGE = 'anytext.deviceName';

export function getInitialRoomKey(): string {
  const persisted = localStorage.getItem(ROOM_KEY_STORAGE);

  if (persisted) {
    return persisted;
  }

  const roomKey = getRoomKeyFromCurrentUrl();

  if (roomKey) {
    saveRoomKey(roomKey);
    return roomKey;
  }

  return '';
}

export function saveRoomKey(roomKey: string): void {
  localStorage.setItem(ROOM_KEY_STORAGE, roomKey);
}

export function clearRoomKey(): void {
  localStorage.removeItem(ROOM_KEY_STORAGE);
}

export function saveDeviceName(deviceName: string): void {
  localStorage.setItem(DEVICE_NAME_STORAGE, deviceName);
}

export function getInitialDeviceName(): string {
  return localStorage.getItem(DEVICE_NAME_STORAGE) ?? 'MacBook';
}

export function buildJoinLink(roomKey: string, baseUrl?: URL): string {
  const url = baseUrl ?? getCurrentBaseUrl();
  url.searchParams.set('room', roomKey);

  return url.toString();
}

function getRoomKeyFromCurrentUrl(): string {
  const url = new URL(window.location.href);
  const roomKey = url.searchParams.get('room') ?? url.searchParams.get('roomKey') ?? '';

  return roomKey.trim();
}

function getCurrentBaseUrl(): URL {
  if (typeof window === 'undefined') {
    return new URL('https://example.invalid/');
  }

  return new URL(import.meta.env.BASE_URL, window.location.origin);
}
