import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconClipboard,
  IconCloudOff,
  IconCopy,
  IconDeviceLaptop,
  IconDownload,
  IconEdit,
  IconFile,
  IconImageInPicture,
  IconLink,
  IconLoader2,
  IconPaperclip,
  IconPhoto,
  IconQrcode,
  IconRefresh,
  IconSend,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MarkdownPreview } from './components/MarkdownPreview';
import {
  MARKDOWN_LIMIT_BYTES,
  type AttachmentPreviewKind,
  type QueueAttachment,
  type QueueItem,
  classifyAttachment,
  formatBytes,
  formatTimeRemaining,
  generateRoomKey,
  getActiveQueueItems,
  getItemTimeState,
  validateAttachments,
  validateMarkdown,
} from './lib/anytext';
import { copyText } from './lib/clipboard';
import { cx } from './lib/cx';
import {
  clearRoomKey,
  getInitialDeviceName,
  getInitialRoomKey,
  saveDeviceName,
  saveRoomKey,
  buildJoinLink,
} from './lib/pairing';
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabaseClient';
import {
  applyMessageRealtimeEvent,
  createAttachmentDownloadUrl,
  createMessage as createSupabaseMessage,
  createRoom,
  deleteMessage as deleteSupabaseMessage,
  listMessages,
  subscribeToRoomMessages,
  type AttachmentUploadProgress,
  type AnyTextFunctionsClient,
  type AnyTextRpcClient,
  type RealtimeStatus,
} from './lib/supabaseRelay';

type QueueLoadClient = AnyTextRpcClient & AnyTextFunctionsClient;

interface SelectedAttachment {
  id: string;
  file: File;
  previewKind: AttachmentPreviewKind;
  objectUrl?: string;
  progress: number;
  status: 'ready' | AttachmentUploadProgress['status'];
  error?: string;
}

type SendState = 'idle' | 'sending' | 'sent' | 'failed';
type QueueStatus = 'idle' | 'loading' | 'error';
type MobileTab = 'send' | 'queue';
type SyncStatus = 'connecting' | RealtimeStatus;

function App() {
  const [roomKey, setRoomKey] = useState(getInitialRoomKey);
  const [roomId, setRoomId] = useState('');
  const [deviceName, setDeviceName] = useState(getInitialDeviceName);
  const [showPairing, setShowPairing] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [attachments, setAttachments] = useState<SelectedAttachment[]>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [activeTab, setActiveTab] = useState<MobileTab>('send');
  const [imagePreview, setImagePreview] = useState<QueueAttachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [backendError, setBackendError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomKey) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function connectRoom() {
      if (!isSupabaseConfigured()) {
        setQueueStatus('error');
        setSyncStatus('disconnected');
        setBackendError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        return;
      }

      setQueueStatus('loading');
      setSyncStatus('connecting');
      setBackendError('');

      try {
        const client = getSupabaseClient();
        const room = await createRoom(client, roomKey, deviceName);
        const items = await loadQueueWithAttachmentUrls(client, roomKey);

        if (cancelled) {
          return;
        }

        setRoomId(room.roomId);
        setQueueItems(items);
        setSelectedId((current) => current ?? items[0]?.id ?? null);
        setQueueStatus('idle');

        const subscription = await subscribeToRoomMessages(client, roomKey, {
          onEvent: (event) => {
            if (!cancelled) {
              setQueueItems((currentItems) => applyMessageRealtimeEvent(currentItems, event));
              void loadQueueWithAttachmentUrls(client, roomKey)
                .then((freshItems) => {
                  if (!cancelled) {
                    setQueueItems(freshItems);
                    setSelectedId((current) =>
                      current && freshItems.some((item) => item.id === current) ? current : freshItems[0]?.id ?? null,
                    );
                  }
                })
                .catch((error) => {
                  if (!cancelled) {
                    setBackendError(getErrorMessage(error));
                  }
                });
            }
          },
          onStatusChange: (status) => {
            if (!cancelled) {
              setSyncStatus(status);
            }
          },
        });

        unsubscribe = subscription.unsubscribe;
      } catch (error) {
        if (!cancelled) {
          setQueueStatus('error');
          setSyncStatus('disconnected');
          setBackendError(getErrorMessage(error));
        }
      }
    }

    void connectRoom();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [deviceName, roomKey]);

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setImagePreview(null);
      }
    }

    window.addEventListener('keydown', closeOnEscape);

    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const markdownValidation = useMemo(() => validateMarkdown(markdown), [markdown]);
  const activeItems = useMemo(() => getActiveQueueItems(queueItems, now), [queueItems, now]);
  const selectedStoredItem = useMemo(
    () => (selectedId ? queueItems.find((item) => item.id === selectedId && !item.deletedAt) ?? null : null),
    [queueItems, selectedId],
  );
  const selectedItem = selectedStoredItem ?? activeItems[0] ?? null;
  const selectedItemExpired = selectedStoredItem ? getItemTimeState(selectedStoredItem.expiresAt, now).expired : false;
  const hasDraftContent = markdown.trim().length > 0 || attachments.length > 0;
  const sendDisabled =
    sendState === 'sending' ||
    !isSupabaseConfigured() ||
    !markdownValidation.valid ||
    attachmentErrors.length > 0 ||
    !hasDraftContent;
  const joinLink = roomKey ? buildJoinLink(roomKey) : '';

  if (!roomKey) {
    return (
      <FirstRunScreen
        onCreate={() => {
          const key = generateRoomKey();
          saveRoomKey(key);
          setRoomKey(key);
          setShowPairing(true);
        }}
        onJoin={(key) => {
          const trimmedKey = key.trim();

          if (!trimmedKey) {
            return;
          }

          saveRoomKey(trimmedKey);
          setRoomKey(trimmedKey);
          setShowPairing(false);
        }}
      />
    );
  }

  function addFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const nextAttachments = [
      ...attachments,
      ...files.map((file) => ({
        id: createLocalId(),
        file,
        previewKind: classifyAttachment(file),
        objectUrl: classifyAttachment(file) === 'image' ? URL.createObjectURL(file) : undefined,
        progress: 0,
        status: 'ready' as const,
      })),
    ];

    setAttachments(nextAttachments);
    setAttachmentErrors(validateAttachments(nextAttachments.map((attachment) => attachment.file)));
  }

  function removeAttachment(id: string) {
    const removed = attachments.find((attachment) => attachment.id === id);
    const nextAttachments = attachments.filter((attachment) => attachment.id !== id);
    if (removed?.objectUrl) {
      URL.revokeObjectURL(removed.objectUrl);
    }
    setAttachments(nextAttachments);
    setAttachmentErrors(validateAttachments(nextAttachments.map((attachment) => attachment.file)));
  }

  async function sendMessage() {
    if (sendDisabled) {
      return;
    }

    setSendState('sending');

    try {
      const client = getSupabaseClient();
      const item = await createSupabaseMessage(
        client,
        roomKey,
        markdown,
        deviceName,
        attachments.length > 0
          ? {
              attachments: attachments.map((attachment) => ({ clientId: attachment.id, file: attachment.file })),
              onAttachmentProgress: updateAttachmentProgress,
            }
          : { attachments: [] },
      );
      const itemWithUrls = await hydrateQueueItemAttachmentUrls(client, roomKey, item);

      setQueueItems((items) =>
        getActiveQueueItems([itemWithUrls, ...items.filter((existingItem) => existingItem.id !== itemWithUrls.id)]),
      );
      setSelectedId(itemWithUrls.id);
      setMarkdown('');
      attachments.forEach((attachment) => {
        if (attachment.objectUrl) {
          URL.revokeObjectURL(attachment.objectUrl);
        }
      });
      setAttachments([]);
      setAttachmentErrors([]);
      setSendState('sent');
      setActiveTab('queue');
      window.setTimeout(() => setSendState('idle'), 1200);
    } catch (error) {
      setBackendError(getErrorMessage(error));
      setSendState('failed');
    }
  }

  async function deleteMessage(id: string) {
    try {
      await deleteSupabaseMessage(getSupabaseClient(), roomKey, id);
      setQueueItems((items) => items.filter((item) => item.id !== id));
      setSelectedId(null);
    } catch (error) {
      setQueueStatus('error');
      setBackendError(getErrorMessage(error));
    }
  }

  async function copyMarkdown(value: string) {
    await copyText(value);
  }

  async function refreshQueue() {
    if (!isSupabaseConfigured()) {
      setQueueStatus('error');
      setSyncStatus('disconnected');
      setBackendError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setQueueStatus('loading');

    try {
      const items = await loadQueueWithAttachmentUrls(getSupabaseClient(), roomKey);
      setQueueItems(items);
      setSelectedId((current) => (current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null));
      setQueueStatus('idle');
      setBackendError('');
    } catch (error) {
      setQueueStatus('error');
      setBackendError(getErrorMessage(error));
    }
  }

  function updateAttachmentProgress(progress: AttachmentUploadProgress) {
    setAttachments((current) =>
      current.map((attachment) =>
        attachment.id === progress.clientId
          ? {
              ...attachment,
              error: progress.message,
              progress: progress.progress,
              status: progress.status,
            }
          : attachment,
      ),
    );
  }

  function resetBrowser() {
    clearRoomKey();
    setRoomKey('');
    setRoomId('');
    setQueueItems([]);
    setSelectedId(null);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-[100dvh] bg-[#070a0c] text-slate-100">
      <TopBar
        deviceName={deviceName}
        joinLink={joinLink}
        menuOpen={menuOpen}
        onCopyJoinLink={() => copyMarkdown(joinLink)}
        onMenuOpenChange={setMenuOpen}
        onRenameDevice={(name) => {
          saveDeviceName(name);
          setDeviceName(name);
        }}
        onResetBrowser={resetBrowser}
        onShowPairing={() => setShowPairing(true)}
        roomId={roomId}
        syncStatus={syncStatus}
      />

      <main className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-3 px-3 pb-3 md:px-4 md:pb-4">
        <div className="mobile-tabs md:hidden" role="tablist" aria-label="Command Deck sections">
          <button
            aria-label="Open Send tab"
            aria-selected={activeTab === 'send'}
            className={cx('mobile-tab', activeTab === 'send' && 'mobile-tab-active')}
            onClick={() => setActiveTab('send')}
            role="tab"
            type="button"
          >
            Send
          </button>
          <button
            aria-label="Open Queue tab"
            aria-selected={activeTab === 'queue'}
            className={cx('mobile-tab', activeTab === 'queue' && 'mobile-tab-active')}
            onClick={() => setActiveTab('queue')}
            role="tab"
            type="button"
          >
            Queue
          </button>
        </div>

        <div className="grid min-h-[calc(100dvh-116px)] grid-cols-1 gap-3 md:grid-cols-[minmax(360px,0.42fr)_minmax(0,0.58fr)] md:gap-4">
          <section className={cx('space-y-3 md:block', activeTab === 'send' ? 'block' : 'hidden md:block')}>
            {showPairing ? (
              <PairingCard
                joinLink={joinLink}
                manualCode={roomKey}
                onClose={() => setShowPairing(false)}
                onCopyJoinLink={() => copyMarkdown(joinLink)}
              />
            ) : null}
            <Composer
              attachmentErrors={attachmentErrors}
              attachments={attachments}
              backendError={backendError}
              fileInputRef={fileInputRef}
              markdown={markdown}
              markdownValidation={markdownValidation}
              onAddFiles={addFiles}
              onMarkdownChange={setMarkdown}
              onRemoveAttachment={removeAttachment}
              onSend={sendMessage}
              sendDisabled={sendDisabled}
              sendState={sendState}
            />
          </section>

          <section className={cx('min-h-0 md:block', activeTab === 'queue' ? 'block' : 'hidden md:block')}>
            <QueuePanel
              activeItems={activeItems}
              backendError={backendError}
              now={now}
              onCopyMarkdown={copyMarkdown}
              onClearSelection={() => setSelectedId(null)}
              onDeleteMessage={deleteMessage}
              onImagePreview={setImagePreview}
              onRefresh={refreshQueue}
              onSelect={setSelectedId}
              queueStatus={queueStatus}
              selectedItem={selectedItem}
              selectedItemExpired={selectedItemExpired}
              syncStatus={syncStatus}
            />
          </section>
        </div>
      </main>

      {imagePreview ? <ImagePreviewModal attachment={imagePreview} onClose={() => setImagePreview(null)} /> : null}
    </div>
  );
}

interface FirstRunScreenProps {
  onCreate: () => void;
  onJoin: (key: string) => void;
}

function FirstRunScreen({ onCreate, onJoin }: FirstRunScreenProps) {
  const [joinKey, setJoinKey] = useState('');

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#070a0c] p-4 text-slate-100">
      <section className="w-full max-w-xl rounded-lg border border-white/10 bg-[#101518] p-5 shadow-2xl shadow-black/30">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lime-300">AnyText</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pair this browser</h1>
          </div>
          <div className="rounded-md border border-lime-300/30 bg-lime-300/10 p-2 text-lime-200">
            <IconQrcode aria-hidden size={24} stroke={1.7} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button className="setup-action" onClick={onCreate} type="button">
            <IconDeviceLaptop aria-hidden size={20} />
            <span>Create Device Circle</span>
          </button>
          <form
            className="rounded-md border border-white/10 bg-black/15 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              onJoin(joinKey);
            }}
          >
            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="join-key">
              Join Existing Circle
            </label>
            <div className="flex gap-2">
              <input
                className="input"
                id="join-key"
                onChange={(event) => setJoinKey(event.target.value)}
                placeholder="Paste room key"
                value={joinKey}
              />
              <button className="icon-button px-3" type="submit">
                Join
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

interface TopBarProps {
  deviceName: string;
  joinLink: string;
  menuOpen: boolean;
  onCopyJoinLink: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onRenameDevice: (name: string) => void;
  onResetBrowser: () => void;
  onShowPairing: () => void;
  roomId: string;
  syncStatus: SyncStatus;
}

function TopBar({
  deviceName,
  joinLink,
  menuOpen,
  onCopyJoinLink,
  onMenuOpenChange,
  onRenameDevice,
  onResetBrowser,
  onShowPairing,
  roomId,
  syncStatus,
}: TopBarProps) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(deviceName);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(
    (restoreFocus = true) => {
      onMenuOpenChange(false);

      if (restoreFocus) {
        window.setTimeout(() => triggerRef.current?.focus(), 0);
      }
    },
    [onMenuOpenChange],
  );

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"], input')?.focus();
    }, 0);

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [closeMenu, menuOpen]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const focusable = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"], input') ?? []);
    const currentIndex = focusable.findIndex((element) => element === document.activeElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + focusable.length) % focusable.length;
      focusable[nextIndex]?.focus();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusable[0]?.focus();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusable.at(-1)?.focus();
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070a0c]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center justify-between gap-3 px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-lime-300/30 bg-lime-300/10 font-mono text-sm font-bold text-lime-200">
            AT
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">AnyText</div>
            <div className="truncate font-mono text-[11px] text-slate-500">
              room {roomId ? roomId.slice(0, 10) : 'syncing'} · {syncStatusLabel(syncStatus)}
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Open room menu"
            aria-controls="room-menu"
            className="room-trigger"
            onClick={() => onMenuOpenChange(!menuOpen)}
            ref={triggerRef}
            title="Room menu"
            type="button"
          >
            <span className="hidden max-w-[160px] truncate sm:inline">{deviceName}</span>
            <span className="font-mono text-[11px] text-lime-200">paired</span>
            <IconChevronDown aria-hidden size={16} />
          </button>

          {menuOpen ? (
            <div
              aria-label="Room menu"
              className="room-menu"
              id="room-menu"
              onKeyDown={handleMenuKeyDown}
              ref={menuRef}
              role="menu"
            >
              <button
                className="menu-item"
                onClick={() => {
                  onCopyJoinLink();
                  closeMenu();
                }}
                role="menuitem"
                type="button"
              >
                <IconLink aria-hidden size={16} />
                <span>Copy join link</span>
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  onShowPairing();
                  closeMenu();
                }}
                role="menuitem"
                type="button"
              >
                <IconQrcode aria-hidden size={16} />
                <span>Show QR</span>
              </button>
              {renaming ? (
                <form
                  className="border-t border-white/10 p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const nextName = draftName.trim();

                    if (nextName) {
                      onRenameDevice(nextName);
                      setRenaming(false);
                      closeMenu();
                    }
                  }}
                >
                  <label className="sr-only" htmlFor="device-name">
                    Device name
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="input h-9"
                      id="device-name"
                      onChange={(event) => setDraftName(event.target.value)}
                      value={draftName}
                    />
                    <button className="icon-button px-3" type="submit">
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <button className="menu-item" onClick={() => setRenaming(true)} role="menuitem" type="button">
                  <IconEdit aria-hidden size={16} />
                  <span>Rename device</span>
                </button>
              )}
              <div className="my-1 border-t border-white/10" />
              <button className="menu-item menu-item-danger" onClick={onResetBrowser} role="menuitem" type="button">
                <IconTrash aria-hidden size={16} />
                <span>Reset this browser</span>
              </button>
              <p className="px-3 pb-2 font-mono text-[10px] leading-4 text-slate-500">{joinLink}</p>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

interface PairingCardProps {
  joinLink: string;
  manualCode: string;
  onClose: () => void;
  onCopyJoinLink: () => void;
}

function PairingCard({ joinLink, manualCode, onClose, onCopyJoinLink }: PairingCardProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Pairing QR visible</h2>
          <p className="mt-1 text-sm text-slate-400">Scan this code or use the manual pairing key on another browser.</p>
        </div>
        <button aria-label="Close pairing panel" className="icon-button" onClick={onClose} type="button">
          <IconX aria-hidden size={16} />
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[112px_1fr]">
        <div className="qr-placeholder" aria-label="Pairing QR code">
          <QRCodeSVG
            bgColor="transparent"
            fgColor="#befc3c"
            level="M"
            marginSize={1}
            size={96}
            value={joinLink}
          />
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="label">Manual pairing code</p>
            <code className="mt-1 block truncate rounded border border-white/10 bg-black/25 px-3 py-2 font-mono text-xs text-lime-100">
              {manualCode}
            </code>
          </div>
          <button className="secondary-button w-full justify-center" onClick={onCopyJoinLink} type="button">
            <IconCopy aria-hidden size={16} />
            Copy join link
          </button>
          <p className="truncate font-mono text-[10px] text-slate-500">{joinLink}</p>
        </div>
      </div>
    </section>
  );
}

interface ComposerProps {
  attachmentErrors: string[];
  attachments: SelectedAttachment[];
  backendError: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  markdown: string;
  markdownValidation: { valid: boolean; bytes: number; message?: string };
  onAddFiles: (files: File[]) => void;
  onMarkdownChange: (value: string) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  sendDisabled: boolean;
  sendState: SendState;
}

function Composer({
  attachmentErrors,
  attachments,
  backendError,
  fileInputRef,
  markdown,
  markdownValidation,
  onAddFiles,
  onMarkdownChange,
  onRemoveAttachment,
  onSend,
  sendDisabled,
  sendState,
}: ComposerProps) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    onAddFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <section className="panel flex min-h-[calc(100dvh-160px)] flex-col overflow-hidden">
      <div className="panel-header">
        <div>
          <p className="label">Compose</p>
          <h2 className="text-lg font-semibold tracking-tight">Send Markdown</h2>
        </div>
        <div className="status-pill">
          <IconClipboard aria-hidden size={14} />
          text relay
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <label className="sr-only" htmlFor="markdown-input">
          Markdown input
        </label>
        <textarea
          aria-label="Markdown input"
          className="editor"
          id="markdown-input"
          onChange={(event) => onMarkdownChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Paste Markdown, code, commands..."
          value={markdown}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className={cx(!markdownValidation.valid && 'text-amber-300')}>
            {formatBytes(markdownValidation.bytes)} / {formatBytes(MARKDOWN_LIMIT_BYTES)}
          </span>
          <span>Cmd/Ctrl + Enter to send</span>
        </div>

        {markdownValidation.message ? <InlineAlert message={markdownValidation.message} /> : null}

        <div
          className={cx('dropzone', dragging && 'dropzone-active')}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDrop={handleDrop}
        >
          <input
            aria-label="Select attachments"
            className="sr-only"
            multiple
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onAddFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
            ref={fileInputRef}
            type="file"
          />
          <IconUpload aria-hidden className="text-lime-200" size={18} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-100">
              {dragging ? 'Drop attachments to add' : 'Attach images or files'}
            </p>
            <p className="text-xs text-slate-500">Up to 10 files, 25MB each. Images preview; documents download.</p>
          </div>
          <button className="secondary-button shrink-0" onClick={() => fileInputRef.current?.click()} type="button">
            Select
          </button>
        </div>

        {attachmentErrors.map((error) => (
          <InlineAlert key={error} message={error} />
        ))}

        <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />

        <div className="mt-auto border-t border-white/10 pt-3">
          {sendState === 'sending' ? (
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>Writing to Supabase relay</span>
                <span>80%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-4/5 rounded-full bg-lime-300 motion-safe:animate-pulse" />
              </div>
            </div>
          ) : null}
          {sendState === 'failed' ? <InlineAlert message={backendError || 'Send failed. Retry after refreshing sync.'} /> : null}
          <button className="send-button" disabled={sendDisabled} onClick={onSend} type="button">
            {sendState === 'sending' ? (
              <IconLoader2 aria-hidden className="motion-safe:animate-spin" size={18} />
            ) : sendState === 'sent' ? (
              <IconCheck aria-hidden size={18} />
            ) : (
              <IconSend aria-hidden size={18} />
            )}
            {sendState === 'sending' ? 'Sending' : sendState === 'sent' ? 'Sent' : 'Send'}
          </button>
          {sendDisabled && sendState !== 'sending' && !markdownValidation.message && attachmentErrors.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Add Markdown or attachments to send.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

interface AttachmentListProps {
  attachments: SelectedAttachment[];
  onRemove: (id: string) => void;
}

function AttachmentList({ attachments, onRemove }: AttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div className="attachment-row" key={attachment.id}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-white/10 bg-black/20 text-slate-300">
            {attachment.previewKind === 'image' ? <IconPhoto aria-hidden size={18} /> : <IconFile aria-hidden size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{attachment.file.name}</p>
            <p className="font-mono text-[11px] text-slate-500">
              {formatBytes(attachment.file.size)} · {attachment.file.type || 'file'} · {attachmentStatusLabel(attachment)}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cx(
                  'h-full rounded-full transition-[width] duration-150',
                  attachment.status === 'failed' ? 'bg-red-300' : 'bg-lime-300',
                )}
                style={{ width: `${attachmentProgressValue(attachment)}%` }}
              />
            </div>
            {attachment.error ? <p className="mt-1 text-xs text-red-200">{attachment.error}</p> : null}
          </div>
          <button
            aria-label={`Remove ${attachment.file.name}`}
            className="icon-button"
            onClick={() => onRemove(attachment.id)}
            type="button"
          >
            <IconX aria-hidden size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

interface QueuePanelProps {
  activeItems: QueueItem[];
  backendError: string;
  now: Date;
  onCopyMarkdown: (markdown: string) => Promise<void>;
  onClearSelection: () => void;
  onDeleteMessage: (id: string) => void;
  onImagePreview: (attachment: QueueAttachment) => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  queueStatus: QueueStatus;
  selectedItem: QueueItem | null;
  selectedItemExpired: boolean;
  syncStatus: SyncStatus;
}

function QueuePanel({
  activeItems,
  backendError,
  now,
  onCopyMarkdown,
  onClearSelection,
  onDeleteMessage,
  onImagePreview,
  onRefresh,
  onSelect,
  queueStatus,
  selectedItem,
  selectedItemExpired,
  syncStatus,
}: QueuePanelProps) {
  const [mobileDetailItemId, setMobileDetailItemId] = useState<string | null>(null);
  const mobileDetailItem = selectedItem?.id === mobileDetailItemId ? selectedItem : null;

  function selectItem(id: string) {
    onSelect(id);
    setMobileDetailItemId(id);
  }

  function closeMobileDetail() {
    setMobileDetailItemId(null);
    onClearSelection();
  }

  function deleteMessage(id: string) {
    setMobileDetailItemId(null);
    onDeleteMessage(id);
  }

  return (
    <section className="panel flex min-h-[calc(100dvh-160px)] flex-col overflow-hidden">
      <div className="panel-header">
        <div>
          <p className="label">Queue</p>
          <h2 className="text-lg font-semibold tracking-tight">Temporary relay items</h2>
        </div>
        <button className="secondary-button" onClick={onRefresh} type="button">
          <IconRefresh aria-hidden size={15} />
          Refresh
        </button>
      </div>

      {syncStatus !== 'connected' || backendError ? (
        <div className="border-b border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs text-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <IconCloudOff aria-hidden size={15} />
              <span className="truncate">
                {backendError || (syncStatus === 'connecting' ? 'Connecting realtime relay.' : 'Realtime disconnected.')}
              </span>
            </div>
            <button className="secondary-button min-h-7 px-2 py-1 text-xs" onClick={onRefresh} type="button">
              Refresh
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[260px_1fr]">
        <div className="min-h-0 border-b border-white/10 md:border-b-0 md:border-r">
          {queueStatus === 'loading' ? <QueueSkeleton /> : null}
          {queueStatus === 'error' ? <QueueError onRefresh={onRefresh} /> : null}
          {queueStatus === 'idle' && activeItems.length === 0 ? <EmptyQueue /> : null}
          {queueStatus === 'idle' && activeItems.length > 0 ? (
            <div className="max-h-[34dvh] overflow-y-auto p-2 md:max-h-none">
              {activeItems.map((item) => (
                <QueueRow
                  item={item}
                  key={item.id}
                  now={now}
                  onDelete={deleteMessage}
                  onSelect={selectItem}
                  selected={selectedItem?.id === item.id}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="hidden min-h-0 overflow-y-auto md:block">
          {selectedItem ? (
            <MessageDetail
              expired={selectedItemExpired}
              item={selectedItem}
              now={now}
              onCopyMarkdown={onCopyMarkdown}
              onDeleteMessage={deleteMessage}
              onImagePreview={onImagePreview}
            />
          ) : (
            <div className="flex min-h-full items-center justify-center p-8 text-center text-sm text-slate-500">
              Select a queue item to inspect Markdown, copy commands, or download files.
            </div>
          )}
        </div>
      </div>

      {mobileDetailItem ? (
        <div className="mobile-detail-backdrop md:hidden" onClick={closeMobileDetail} role="presentation">
          <div className="mobile-detail-sheet" onClick={(event) => event.stopPropagation()}>
            <MessageDetail
              expired={selectedItemExpired}
              item={mobileDetailItem}
              now={now}
              onClose={closeMobileDetail}
              onCopyMarkdown={onCopyMarkdown}
              onDeleteMessage={deleteMessage}
              onImagePreview={onImagePreview}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-2 p-2" aria-label="Loading queue">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3" key={index}>
          <div className="mb-3 h-3 w-2/3 rounded bg-white/10" />
          <div className="h-3 w-full rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function QueueError({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="p-3">
      <div className="rounded-md border border-red-300/25 bg-red-300/[0.08] p-3 text-sm text-red-100">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <IconAlertTriangle aria-hidden size={16} />
          Queue failed to refresh.
        </div>
        <button className="secondary-button" onClick={onRefresh} type="button">
          Retry
        </button>
      </div>
    </div>
  );
}

function EmptyQueue() {
  return (
    <div className="p-3">
      <div className="rounded-md border border-dashed border-white/10 bg-black/10 p-5 text-sm text-slate-500">
        No items in the last hour.
      </div>
    </div>
  );
}

interface QueueRowProps {
  item: QueueItem;
  now: Date;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  selected: boolean;
}

function QueueRow({ item, now, onDelete, onSelect, selected }: QueueRowProps) {
  const excerpt = getMarkdownExcerpt(item);
  const imageCount = item.attachments.filter((attachment) => attachment.previewKind === 'image').length;
  const fileCount = item.attachments.length - imageCount;

  return (
    <div className={cx('queue-row-group', selected && 'queue-row-selected')}>
      <button className="queue-row" onClick={() => onSelect(item.id)} title="Open queue item" type="button">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-100">{excerpt}</p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              {item.senderDeviceName} · {formatTimeRemaining(item.expiresAt, now)}
            </p>
          </div>
          <div className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {item.attachments.length}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          {imageCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <IconImageInPicture aria-hidden size={13} />
              {imageCount}
            </span>
          ) : null}
          {fileCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <IconPaperclip aria-hidden size={13} />
              {fileCount}
            </span>
          ) : null}
          <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </button>
      <button
        aria-label="Delete queue item"
        className="queue-delete"
        onClick={() => onDelete(item.id)}
        title="Delete queue item"
        type="button"
      >
        <IconTrash aria-hidden size={15} />
      </button>
    </div>
  );
}

interface MessageDetailProps {
  expired?: boolean;
  item: QueueItem;
  now: Date;
  onClose?: () => void;
  onCopyMarkdown: (markdown: string) => Promise<void>;
  onDeleteMessage: (id: string) => void;
  onImagePreview: (attachment: QueueAttachment) => void;
}

function MessageDetail({ expired = false, item, now, onClose, onCopyMarkdown, onDeleteMessage, onImagePreview }: MessageDetailProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timeState = getItemTimeState(item.expiresAt, now);
  const isExpired = expired || timeState.expired;

  async function copyMarkdown() {
    try {
      await onCopyMarkdown(item.markdown);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    } finally {
      window.setTimeout(() => setCopyState('idle'), 1200);
    }
  }

  return (
    <article className="p-3 md:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label">Detail</p>
          <h3 className="text-base font-semibold text-slate-100">{getMarkdownExcerpt(item)}</h3>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            {item.senderDeviceName} · {formatTimeRemaining(item.expiresAt, now)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" onClick={copyMarkdown} type="button">
            {copyState === 'copied' ? <IconCheck aria-hidden size={15} /> : <IconCopy aria-hidden size={15} />}
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy Markdown'}
          </button>
          <button className="danger-button" onClick={() => onDeleteMessage(item.id)} type="button">
            <IconTrash aria-hidden size={15} />
            Delete message
          </button>
          {onClose ? (
            <button aria-label="Close message detail" className="icon-button" onClick={onClose} title="Close detail" type="button">
              <IconX aria-hidden size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {isExpired ? <InlineAlert message="Message expired. It is hidden from the queue and downloads are disabled." /> : null}

      {item.markdown ? <MarkdownPreview markdown={item.markdown} /> : null}

      {item.attachments.length > 0 ? (
        <div className="mt-5 space-y-3">
          <h4 className="text-sm font-semibold">Attachments</h4>
          <div className="grid gap-3 2xl:grid-cols-2">
            {item.attachments.map((attachment) =>
              attachment.previewKind === 'image' ? (
                <ImageAttachment disabled={isExpired} key={attachment.id} attachment={attachment} onPreview={onImagePreview} />
              ) : (
                <FileDownloadRow attachment={attachment} disabled={isExpired} key={attachment.id} />
              ),
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ImageAttachment({
  attachment,
  disabled,
  onPreview,
}: {
  attachment: QueueAttachment;
  disabled: boolean;
  onPreview: (attachment: QueueAttachment) => void;
}) {
  return (
    <button
      className="image-attachment"
      disabled={disabled}
      onClick={() => onPreview(attachment)}
      title={disabled ? 'Preview expired' : 'Open image preview'}
      type="button"
    >
      <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 bg-black/25">
        {attachment.objectUrl ? (
          <img alt="" className="h-full w-full object-cover" src={attachment.objectUrl} />
        ) : (
          <IconPhoto aria-hidden size={22} />
        )}
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
        <p className="font-mono text-[11px] text-slate-500">
          {formatBytes(attachment.fileSize)} · image preview
        </p>
      </div>
    </button>
  );
}

function FileDownloadRow({ attachment, disabled }: { attachment: QueueAttachment; disabled: boolean }) {
  return (
    <div className="file-row">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-white/10 bg-black/25">
        <IconFile aria-hidden size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
        <p className="font-mono text-[11px] text-slate-500">
          {formatBytes(attachment.fileSize)} · {attachment.mimeType || attachment.fileType}
        </p>
      </div>
      {attachment.objectUrl && !disabled ? (
        <a className="secondary-button" download={attachment.fileName} href={attachment.objectUrl}>
          <IconDownload aria-hidden size={15} />
          Download
        </a>
      ) : (
        <button className="secondary-button" disabled type="button">
          <IconDownload aria-hidden size={15} />
          {disabled ? 'Expired' : 'Download'}
        </button>
      )}
    </div>
  );
}

function ImagePreviewModal({ attachment, onClose }: { attachment: QueueAttachment; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div aria-label="Image preview" aria-modal="true" className="modal-panel" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{attachment.fileName}</p>
            <p className="font-mono text-[11px] text-slate-500">{formatBytes(attachment.fileSize)}</p>
          </div>
          <button aria-label="Close image preview" className="icon-button" onClick={onClose} title="Close image preview" type="button">
            <IconX aria-hidden size={16} />
          </button>
        </div>
        <div className="flex max-h-[72dvh] items-center justify-center rounded border border-white/10 bg-black/30">
          {attachment.objectUrl ? (
            <img alt={attachment.fileName} className="max-h-[72dvh] max-w-full object-contain" src={attachment.objectUrl} />
          ) : (
            <div className="p-10 text-sm text-slate-500">Preview URL is not available in this test environment.</div>
          )}
        </div>
        {attachment.objectUrl ? (
          <a className="secondary-button mt-3 w-full justify-center" download={attachment.fileName} href={attachment.objectUrl}>
            <IconDownload aria-hidden size={15} />
            Download
          </a>
        ) : null}
      </div>
    </div>
  );
}

function InlineAlert({ message }: { message: string }) {
  return (
    <div className="inline-alert">
      <IconAlertTriangle aria-hidden size={15} />
      <span>{message}</span>
    </div>
  );
}

async function loadQueueWithAttachmentUrls(client: QueueLoadClient, roomKey: string): Promise<QueueItem[]> {
  const items = await listMessages(client, roomKey);

  return Promise.all(items.map((item) => hydrateQueueItemAttachmentUrls(client, roomKey, item)));
}

async function hydrateQueueItemAttachmentUrls(
  client: AnyTextFunctionsClient,
  roomKey: string,
  item: QueueItem,
): Promise<QueueItem> {
  if (item.attachments.length === 0) {
    return item;
  }

  const attachments = await Promise.all(
    item.attachments.map(async (attachment) => {
      if (attachment.objectUrl) {
        return attachment;
      }

      try {
        const { signedUrl } = await createAttachmentDownloadUrl(client, roomKey, {
          attachmentId: attachment.id,
          download: attachment.previewKind === 'download',
          messageId: attachment.messageId,
        });

        return { ...attachment, objectUrl: signedUrl };
      } catch {
        return attachment;
      }
    }),
  );

  return { ...item, attachments };
}

function attachmentStatusLabel(attachment: SelectedAttachment): string {
  if (attachment.status === 'ready') {
    return 'ready';
  }

  if (attachment.status === 'signing') {
    return 'preparing upload';
  }

  if (attachment.status === 'uploading') {
    return 'uploading';
  }

  if (attachment.status === 'uploaded') {
    return 'uploaded';
  }

  if (attachment.status === 'failed') {
    return 'failed';
  }

  return 'queued';
}

function attachmentProgressValue(attachment: SelectedAttachment): number {
  if (attachment.status === 'ready') {
    return 6;
  }

  return attachment.progress;
}

function getMarkdownExcerpt(item: QueueItem): string {
  const text = item.markdown
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/[#>*_`|[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text) {
    return text.length > 92 ? `${text.slice(0, 92)}...` : text;
  }

  return item.attachments.length === 1 ? '1 attachment' : `${item.attachments.length} attachments`;
}

function syncStatusLabel(status: SyncStatus): string {
  if (status === 'connected') {
    return 'realtime';
  }

  if (status === 'connecting') {
    return 'connecting';
  }

  return 'manual refresh';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Supabase relay request failed.';
}

function createLocalId(): string {
  return globalThis.crypto.randomUUID?.() ?? `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default App;
