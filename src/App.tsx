import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconClipboard,
  IconCloudOff,
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
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CopyButton } from './components/CopyButton';
import { MarkdownPreview } from './components/MarkdownPreview';
import { ParticleBurst } from './components/ParticleBurst';
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
import { attachMagnet, attachSpotlight, prefersReducedMotion, staggerStyle } from './lib/motion';
import {
  buildJoinLink,
  clearRoomKey,
  formatManualPairingCode,
  getInitialDeviceName,
  getInitialRoomKey,
  normalizeRoomKeyInput,
  saveDeviceName,
  saveRoomKey,
} from './lib/pairing';
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabaseClient';
import {
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
import { ExperienceMount } from './experience/ExperienceMount';
import { useExperienceController } from './experience/quality';
import { SceneToggle } from './experience/SceneToggle';
import { emitSend } from './experience/store';

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

type SendState = 'draft_empty' | 'draft_ready' | 'validating' | 'uploading' | 'publishing' | 'sent' | 'failed';
const BUSY_SEND_STATES = new Set<SendState>(['validating', 'uploading', 'publishing']);
type QueueStatus = 'idle' | 'loading' | 'error';
type MobileTab = 'send' | 'queue';
type SyncStatus = 'connecting' | RealtimeStatus;
type ArrivalOrigin = 'local' | 'remote';
type SendFx = { id: number; phase: 'fire' | 'recoil' };
const DELETE_CONFIRMATION_STORAGE_KEY = 'anytext.confirmDeleteMessage';

function App() {
  const experience = useExperienceController();
  const [roomKey, setRoomKey] = useState(getInitialRoomKey);
  const [roomId, setRoomId] = useState('');
  const [deviceName, setDeviceName] = useState(getInitialDeviceName);
  const [showPairing, setShowPairing] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [attachments, setAttachments] = useState<SelectedAttachment[]>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendState, setSendState] = useState<SendState>('draft_empty');
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [activeTab, setActiveTab] = useState<MobileTab>('send');
  const [imagePreview, setImagePreview] = useState<QueueAttachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmationEnabled, setDeleteConfirmationEnabled] = useState(getInitialDeleteConfirmationEnabled);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [backendError, setBackendError] = useState('');
  const [sendFx, setSendFx] = useState<SendFx | null>(null);
  const [charging, setCharging] = useState(false);
  const [arrivals, setArrivals] = useState<Record<string, ArrivalOrigin>>({});
  // Presentation-only signal for the PAIRING auto-trigger (§3.3): bumped whenever
  // an arrival from another device is detected. Does not change any queue data.
  const [remoteArrivalSignal, setRemoteArrivalSignal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sendFxIdRef = useRef(0);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);

    return () => window.clearInterval(timer);
  }, []);

  function markSeen(items: QueueItem[]) {
    for (const item of items) {
      seenIdsRef.current.add(item.id);
    }
  }

  function triggerSendFx(phase: SendFx['phase']) {
    sendFxIdRef.current += 1;
    setSendFx({ id: sendFxIdRef.current, phase });
  }

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

        // Items present at connect are historical, not arrivals — mark them seen.
        markSeen(items);
        setRoomId(room.roomId);
        setQueueItems(items);
        setSelectedId((current) => current ?? items[0]?.id ?? null);
        setQueueStatus('idle');

        const subscription = await subscribeToRoomMessages(client, roomKey, {
          onEvent: () => {
            if (!cancelled) {
              void loadQueueWithAttachmentUrls(client, roomKey)
                .then((freshItems) => {
                  if (!cancelled) {
                    // Any id we have not seen before arrived from another device.
                    const remoteIds = freshItems.filter((item) => !seenIdsRef.current.has(item.id)).map((item) => item.id);
                    const freshIds = new Set(freshItems.map((item) => item.id));
                    markSeen(freshItems);

                    setArrivals((prev) => {
                      const next = pruneArrivals(prev, freshIds);
                      for (const id of remoteIds) {
                        next[id] = 'remote';
                      }
                      return next;
                    });

                    // A genuine handshake: another device is live in the room.
                    // Feeds the PairingCard's auto "Linked" celebration (§3.3).
                    if (remoteIds.length > 0) {
                      setRemoteArrivalSignal((signal) => signal + 1);
                    }

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
  const pendingDeleteItem = useMemo(
    () => (pendingDeleteId ? queueItems.find((item) => item.id === pendingDeleteId && !item.deletedAt) ?? null : null),
    [pendingDeleteId, queueItems],
  );
  const selectedItem = selectedStoredItem ?? activeItems[0] ?? null;
  const selectedItemExpired = selectedStoredItem ? getItemTimeState(selectedStoredItem.expiresAt, now).expired : false;
  const hasDraftContent = markdown.trim().length > 0 || attachments.length > 0;
  const sendBusy = BUSY_SEND_STATES.has(sendState);
  const visibleSendState =
    sendBusy || sendState === 'sent' || sendState === 'failed'
      ? sendState
      : hasDraftContent
        ? 'draft_ready'
        : 'draft_empty';
  const sendDisabled =
    sendBusy ||
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
          const trimmedKey = normalizeRoomKeyInput(key);

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
    resetSendStateForDraft(markdown, nextAttachments);
  }

  function removeAttachment(id: string) {
    const removed = attachments.find((attachment) => attachment.id === id);
    const nextAttachments = attachments.filter((attachment) => attachment.id !== id);
    if (removed?.objectUrl) {
      URL.revokeObjectURL(removed.objectUrl);
    }
    setAttachments(nextAttachments);
    setAttachmentErrors(validateAttachments(nextAttachments.map((attachment) => attachment.file)));
    resetSendStateForDraft(markdown, nextAttachments);
  }

  async function sendMessage() {
    if (sendDisabled) {
      return;
    }

    // Fire THE SEND immediately on commit — celebratory, non-blocking; the ~1s
    // envelope never gates the actual relay (§2.5). `triggerSendFx` drives the DOM
    // fallback (Tier-D / reduced motion); `emitSend` drives the WebGL cinematic shot
    // (SoT §5) when the scene is mounted (A/B/C) — a no-op otherwise.
    triggerSendFx('fire');
    emitSend('fire');
    setCharging(true);
    setSendState('validating');

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
              onPublishStart: () => setSendState('publishing'),
            }
          : { attachments: [], onPublishStart: () => setSendState('publishing') },
      );
      const itemWithUrls = await hydrateQueueItemAttachmentUrls(client, roomKey, item);

      // Tag as a local arrival (lime) and mark seen so the realtime echo of our
      // own insert is not re-classified as remote.
      seenIdsRef.current.add(itemWithUrls.id);
      setArrivals((prev) => ({ ...prev, [itemWithUrls.id]: 'local' }));
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
      window.setTimeout(() => setSendState('draft_empty'), 1200);
    } catch (error) {
      // Fail-state: beam recoils + button danger pulse once. Content is never
      // cleared (the clear only runs in the success branch above).
      triggerSendFx('recoil');
      emitSend('recoil');
      setBackendError(getErrorMessage(error));
      setSendState('failed');
    }
  }

  function updateDeleteConfirmationPreference(enabled: boolean) {
    saveDeleteConfirmationEnabled(enabled);
    setDeleteConfirmationEnabled(enabled);
  }

  function requestDeleteMessage(id: string) {
    if (deleteConfirmationEnabled && queueItems.some((item) => item.id === id && !item.deletedAt)) {
      setPendingDeleteId(id);
      return;
    }

    void performDeleteMessage(id);
  }

  async function performDeleteMessage(id: string) {
    setDeletingId(id);

    try {
      await deleteSupabaseMessage(getSupabaseClient(), roomKey, id);
      setQueueItems((items) => items.filter((item) => item.id !== id));
      setArrivals((prev) => (id in prev ? pruneArrivals(prev, new Set(Object.keys(prev).filter((key) => key !== id))) : prev));
      setSelectedId(null);
      setPendingDeleteId(null);
    } catch (error) {
      setQueueStatus('error');
      setBackendError(getErrorMessage(error));
    } finally {
      setDeletingId((current) => (current === id ? null : current));
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
      const liveIds = new Set(items.map((item) => item.id));
      markSeen(items);
      setArrivals((prev) => pruneArrivals(prev, liveIds));
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
    if (progress.status === 'signing' || progress.status === 'uploading') {
      setSendState('uploading');
    }

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

  function resetSendStateForDraft(nextMarkdown: string, nextAttachments: SelectedAttachment[]) {
    if (sendState === 'failed' || sendState === 'sent' || sendState === 'draft_empty' || sendState === 'draft_ready') {
      setSendState(nextMarkdown.trim().length > 0 || nextAttachments.length > 0 ? 'draft_ready' : 'draft_empty');
    }
  }

  return (
    <div
      className={cx(
        'app-shell text-slate-100',
        experience.active ? 'experience-active' : 'bg-[#070a0c]',
      )}
    >
      {experience.active ? (
        <ExperienceMount syncStatus={syncStatus} tier={experience.tier} />
      ) : null}
      <SceneToggle controller={experience} />
      <AmbientField energizedSignal={sendFx?.phase === 'fire' ? sendFx.id : undefined} />
      <GrainField />
      <SendBeam fx={sendFx} />
      <TopBar
        deleteConfirmationEnabled={deleteConfirmationEnabled}
        deviceName={deviceName}
        joinLink={joinLink}
        menuOpen={menuOpen}
        onCopyJoinLink={() => copyMarkdown(joinLink)}
        onDeleteConfirmationChange={updateDeleteConfirmationPreference}
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

      <main className="workspace-shell">
        <div
          aria-label="Command Deck sections"
          className="mobile-tabs md:hidden"
          data-active={activeTab}
          role="tablist"
        >
          <span aria-hidden className="mobile-tab-glider" />
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

        {showPairing ? (
          <PairingCard
            joinLink={joinLink}
            manualCode={roomKey}
            onClose={() => setShowPairing(false)}
            onCopyJoinLink={() => copyMarkdown(joinLink)}
            onCopyPairingCode={() => copyMarkdown(roomKey)}
            remoteArrivalSignal={remoteArrivalSignal}
          />
        ) : null}

        <div className="workspace-grid">
          <section className={cx('workspace-pane md:block', activeTab === 'send' ? 'block' : 'hidden md:block')}>
            <Composer
              attachmentErrors={attachmentErrors}
              attachments={attachments}
              backendError={backendError}
              charging={charging}
              fileInputRef={fileInputRef}
              markdown={markdown}
              markdownValidation={markdownValidation}
              onAddFiles={addFiles}
              onChargeEnd={() => setCharging(false)}
              onMarkdownChange={(value) => {
                setMarkdown(value);
                resetSendStateForDraft(value, attachments);
              }}
              onRemoveAttachment={removeAttachment}
              onSend={sendMessage}
              sendDisabled={sendDisabled}
              sendFx={sendFx}
              sendState={visibleSendState}
            />
          </section>

          <section className={cx('workspace-pane md:block', activeTab === 'queue' ? 'block' : 'hidden md:block')}>
            <QueuePanel
              activeItems={activeItems}
              arrivals={arrivals}
              backendError={backendError}
              now={now}
              onCopyMarkdown={copyMarkdown}
              onClearSelection={() => setSelectedId(null)}
              onDeleteMessage={requestDeleteMessage}
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

      {pendingDeleteItem ? (
        <DeleteConfirmDialog
          confirming={deletingId === pendingDeleteItem.id}
          deleteConfirmationEnabled={deleteConfirmationEnabled}
          item={pendingDeleteItem}
          now={now}
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => void performDeleteMessage(pendingDeleteItem.id)}
          onPreferenceChange={updateDeleteConfirmationPreference}
        />
      ) : null}
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
      <AmbientField />
      <GrainField />
      <section className="first-run-card w-full max-w-xl rounded-lg border border-white/10 bg-[#101518] p-5 shadow-2xl shadow-black/30">
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
          <button className="setup-action fx-magnet" onClick={onCreate} type="button">
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
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="text"
                placeholder="126 393 $"
                spellCheck={false}
                value={joinKey}
              />
              <button className="icon-button fx-magnet px-3" type="submit">
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
  deleteConfirmationEnabled: boolean;
  deviceName: string;
  joinLink: string;
  menuOpen: boolean;
  onCopyJoinLink: () => void;
  onDeleteConfirmationChange: (enabled: boolean) => void;
  onMenuOpenChange: (open: boolean) => void;
  onRenameDevice: (name: string) => void;
  onResetBrowser: () => void;
  onShowPairing: () => void;
  roomId: string;
  syncStatus: SyncStatus;
}

function TopBar({
  deleteConfirmationEnabled,
  deviceName,
  joinLink,
  menuOpen,
  onCopyJoinLink,
  onDeleteConfirmationChange,
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
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"], input')?.focus();
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
    const focusable = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"], input') ?? [],
    );
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
    <header className="topbar sticky top-0 z-20 border-b border-white/10 bg-[#070a0c]/95 backdrop-blur">
      <div className="topbar-inner">
        <div className="flex min-w-0 items-center gap-3">
          <div className="brand-mark flex h-8 w-8 items-center justify-center rounded border border-lime-300/30 font-mono text-sm font-bold text-lime-200">
            AT
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">AnyText</div>
            <div className="flex items-center gap-1.5 truncate font-mono text-[11px] text-slate-400">
              <span aria-hidden className="sync-dot" data-status={syncStatus} />
              <span className="truncate">
                room {roomId ? roomId.slice(0, 10) : 'syncing'} · {syncStatusLabel(syncStatus)}
              </span>
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
              <button
                aria-checked={deleteConfirmationEnabled}
                className="menu-item menu-item-toggle"
                onClick={() => onDeleteConfirmationChange(!deleteConfirmationEnabled)}
                role="menuitemcheckbox"
                type="button"
              >
                <span className={cx('menu-toggle-box', deleteConfirmationEnabled && 'menu-toggle-box-active')} aria-hidden>
                  {deleteConfirmationEnabled ? <IconCheck size={13} stroke={2.4} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block">Confirm deletions</span>
                  <span className="menu-item-caption">Ask before removing queue messages</span>
                </span>
              </button>
              <div className="my-1 border-t border-white/10" />
              <button className="menu-item menu-item-danger" onClick={onResetBrowser} role="menuitem" type="button">
                <IconTrash aria-hidden size={16} />
                <span>Reset this browser</span>
              </button>
              <p className="px-3 pb-2 font-mono text-[10px] leading-4 text-slate-400">{joinLink}</p>
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
  onCopyPairingCode: () => void;
  /** Bumps when another device arrives (§3.3 auto-trigger). Presentation-only. */
  remoteArrivalSignal: number;
}

// PAIRING — "Establish Link" (§3.3). The emotional peak: the QR module dissolves
// into converging particles that re-form as the live sync indicator, a ring
// expands once, and the copy shifts "Pairing QR visible" → "Linked". Triggered
// either manually ("We're linked") or automatically when a remote arrival proves
// a second device is live while the card is open. No pairing data logic changes.
function PairingCard({
  joinLink,
  manualCode,
  onClose,
  onCopyJoinLink,
  onCopyPairingCode,
  remoteArrivalSignal,
}: PairingCardProps) {
  const formattedManualCode = formatManualPairingCode(manualCode);
  const [linked, setLinked] = useState(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const baseSignalRef = useRef(remoteArrivalSignal);

  const establishLink = useCallback(() => {
    setLinked((already) => {
      if (already) {
        return already;
      }
      // Celebrate, then retire the card once the signature envelope (~1s) plus a
      // short "Linked" dwell settle. Under reduced motion the envelope collapses
      // to an instant cross-fade; the timer just gives it a brief read.
      closeTimerRef.current = window.setTimeout(onClose, 1500);
      return true;
    });
  }, [onClose]);

  // Auto path: a fresh remote arrival while the card is open = a real handshake.
  useEffect(() => {
    if (remoteArrivalSignal > baseSignalRef.current) {
      establishLink();
    }
  }, [remoteArrivalSignal, establishLink]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  return (
    <section className="panel pairing-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">{linked ? 'Linked' : 'Pairing QR visible'}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {linked
              ? 'This device is now live in the circle.'
              : 'Scan this code or enter the 7-character pairing code.'}
          </p>
        </div>
        <button aria-label="Close pairing panel" className="icon-button" onClick={onClose} type="button">
          <IconX aria-hidden size={16} />
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[112px_1fr]">
        <div className="pairing-qr-slot" data-linked={linked ? 'true' : undefined}>
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
          {linked ? (
            <div className="pairing-linked">
              <ParticleBurst count={18} direction="converge" spread={56} />
              <span className="pairing-ring" aria-hidden="true" />
              <span aria-hidden="true" className="sync-dot" data-status="connected" />
              <span className="pairing-linked-label">Linked</span>
            </div>
          ) : null}
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="label">Pairing code</p>
            <code className="mt-1 block select-all rounded border border-lime-300/20 bg-lime-300/10 px-3 py-2 font-mono text-xl font-semibold text-lime-100">
              {formattedManualCode}
            </code>
          </div>
          <CopyButton
            className="secondary-button fx-magnet w-full justify-center"
            copiedLabel="Code copied"
            idleLabel="Copy code"
            iconSize={16}
            onCopy={onCopyPairingCode}
          />
          <CopyButton
            className="secondary-button fx-magnet w-full justify-center"
            copiedLabel="Link copied"
            idleLabel="Copy join link"
            iconSize={16}
            onCopy={onCopyJoinLink}
          />
          {linked ? null : (
            <button className="send-button fx-magnet" onClick={establishLink} type="button">
              <IconLink aria-hidden size={16} />
              We&rsquo;re linked
            </button>
          )}
          <p className="truncate font-mono text-[10px] text-slate-400">{joinLink}</p>
        </div>
      </div>
    </section>
  );
}

interface ComposerProps {
  attachmentErrors: string[];
  attachments: SelectedAttachment[];
  backendError: string;
  charging: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  markdown: string;
  markdownValidation: { valid: boolean; bytes: number; message?: string };
  onAddFiles: (files: File[]) => void;
  onChargeEnd: () => void;
  onMarkdownChange: (value: string) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  sendDisabled: boolean;
  sendFx: SendFx | null;
  sendState: SendState;
}

function Composer({
  attachmentErrors,
  attachments,
  backendError,
  charging,
  fileInputRef,
  markdown,
  markdownValidation,
  onAddFiles,
  onChargeEnd,
  onMarkdownChange,
  onRemoveAttachment,
  onSend,
  sendDisabled,
  sendFx,
  sendState,
}: ComposerProps) {
  const [dragging, setDragging] = useState(false);
  const sendButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  // `magnet` primitive (§5): the hero Send button leans toward the pointer.
  // CSS `.fx-magnet` already gives a flat 2px lift; this adds cursor-follow.
  useEffect(() => attachMagnet(sendButtonRef.current), []);

  // Cursor spotlight (§4.2): the active panel carries a faint lime pool that
  // follows the pointer (rAF-throttled, transform/opacity only, no React state).
  useEffect(() => attachSpotlight(panelRef.current), []);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    onAddFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <section className="panel workspace-panel composer-panel" ref={panelRef}>
      <span className="panel-spotlight" aria-hidden="true" />
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

      <div
        className={cx('composer-body', charging && 'fx-charge')}
        onAnimationEnd={(event) => {
          if (event.animationName === 'fx-charge') {
            onChargeEnd();
          }
        }}
      >
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
      </div>

      <div className="composer-command-bar" aria-label="Composer actions">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span className={cx('telemetry', !markdownValidation.valid && 'text-amber-300')}>
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
            <p className="text-xs text-slate-400">Up to 10 files, 25MB each. Images preview; documents download.</p>
          </div>
          <button className="secondary-button fx-magnet shrink-0" onClick={() => fileInputRef.current?.click()} type="button">
            Select
          </button>
        </div>

        {attachmentErrors.map((error) => (
          <InlineAlert key={error} message={error} />
        ))}

        <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />

        <div className="composer-send-area">
          {sendFx?.phase === 'fire' ? (
            <span key={sendFx.id} className="send-fire-fx" aria-hidden="true">
              <span className="send-core-flash" />
              <span className="send-shockwave" />
            </span>
          ) : null}
          {sendFx?.phase === 'recoil' ? (
            <span key={`fail-${sendFx.id}`} className="send-fail-flash" aria-hidden="true" />
          ) : null}
          <SendProgress sendState={sendState} attachmentCount={attachments.length} />
          {sendState === 'failed' ? <InlineAlert message={backendError || 'Send failed. Retry after refreshing sync.'} /> : null}
          <button
            className={cx(
              'send-button fx-magnet',
              !sendDisabled && sendState === 'draft_ready' && 'send-button-ready',
              sendState === 'sent' && 'send-button-sent',
            )}
            data-scene-anchor="send"
            disabled={sendDisabled}
            onClick={onSend}
            ref={sendButtonRef}
            type="button"
          >
            {BUSY_SEND_STATES.has(sendState) ? (
              <IconLoader2 aria-hidden className="motion-safe:animate-spin" size={18} />
            ) : sendState === 'sent' ? (
              <IconCheck aria-hidden size={18} />
            ) : (
              <IconSend aria-hidden size={18} />
            )}
            {sendButtonLabel(sendState, attachments.length)}
          </button>
          {sendDisabled && !BUSY_SEND_STATES.has(sendState) && !markdownValidation.message && attachmentErrors.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">
              Add Markdown or attachments to send.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SendProgress({ attachmentCount, sendState }: { attachmentCount: number; sendState: SendState }) {
  if (!BUSY_SEND_STATES.has(sendState)) {
    return null;
  }

  const label =
    sendState === 'validating'
      ? 'Checking limits'
      : sendState === 'uploading'
        ? attachmentCount === 1
          ? 'Uploading 1 file'
          : `Uploading ${attachmentCount} files`
        : 'Publishing relay item';

  return (
    <div className="mb-3" aria-busy="true">
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{label}</span>
      </div>
      <div aria-label={label} className="progress-track" role="progressbar">
        <div className="progress-fill-indeterminate" />
      </div>
    </div>
  );
}

function sendButtonLabel(sendState: SendState, attachmentCount: number): string {
  if (sendState === 'validating') {
    return 'Checking';
  }

  if (sendState === 'uploading') {
    return 'Sending';
  }

  if (sendState === 'publishing') {
    return 'Publishing';
  }

  if (sendState === 'sent') {
    return 'Sent';
  }

  if (sendState === 'failed') {
    return 'Retry send';
  }

  if (attachmentCount === 1) {
    return 'Send 1 file';
  }

  if (attachmentCount > 1) {
    return `Send ${attachmentCount} files`;
  }

  return 'Send';
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
            <p className="telemetry font-mono text-[11px] text-slate-400">
              {formatBytes(attachment.file.size)} · {attachment.file.type || 'file'} · {attachmentStatusLabel(attachment)}
            </p>
            <AttachmentProgress attachment={attachment} />
            {attachment.error ? <p className="mt-1 text-xs text-red-200">{attachment.error}</p> : null}
          </div>
          <button
            aria-label={`Remove ${attachment.file.name}`}
            className="icon-button"
            disabled={!canRemoveAttachment(attachment)}
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

function AttachmentProgress({ attachment }: { attachment: SelectedAttachment }) {
  if (attachment.status === 'ready') {
    return <div className="attachment-progress-slot" aria-hidden />;
  }

  const label = `${attachmentStatusLabel(attachment)} ${attachment.file.name}`;
  const isIndeterminate = attachment.status === 'signing' || attachment.status === 'uploading';

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={isIndeterminate ? undefined : attachment.progress}
      className="progress-track mt-2"
      role="progressbar"
    >
      <div
        className={cx(
          'progress-fill',
          isIndeterminate && 'progress-fill-indeterminate',
          attachment.status === 'failed' && 'progress-fill-error',
        )}
        style={isIndeterminate ? undefined : { transform: `scaleX(${attachment.progress / 100})` }}
      />
    </div>
  );
}

function canRemoveAttachment(attachment: SelectedAttachment): boolean {
  return attachment.status === 'ready' || attachment.status === 'failed';
}

interface QueuePanelProps {
  activeItems: QueueItem[];
  arrivals: Record<string, ArrivalOrigin>;
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
  arrivals,
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
  const panelRef = useRef<HTMLElement | null>(null);
  // EXPIRY decay (§3.4): decorative ghosts for rows that just expired.
  const { ghosts: decayGhosts, listRef } = useExpiryDecay(activeItems, now);

  // Cursor spotlight (§4.2): same active-panel glow as the composer.
  useEffect(() => attachSpotlight(panelRef.current), []);

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
    <section className="panel workspace-panel queue-panel" ref={panelRef} data-scene-anchor="queue">
      <span className="panel-spotlight" aria-hidden="true" />
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

      <div className="queue-layout">
        <div className="queue-list-pane">
          {queueStatus === 'loading' ? <QueueSkeleton /> : null}
          {queueStatus === 'error' ? <QueueError onRefresh={onRefresh} /> : null}
          {queueStatus === 'idle' && activeItems.length === 0 && decayGhosts.length === 0 ? <EmptyQueue /> : null}
          {queueStatus === 'idle' && (activeItems.length > 0 || decayGhosts.length > 0) ? (
            <div className="queue-list-scroll fx-stagger" ref={listRef}>
              {activeItems.map((item, index) => (
                <QueueRow
                  index={index}
                  item={item}
                  key={item.id}
                  now={now}
                  onDelete={deleteMessage}
                  onSelect={selectItem}
                  origin={arrivals[item.id]}
                  selected={selectedItem?.id === item.id}
                />
              ))}
              {decayGhosts.map((ghost) => (
                <ExpiryGhost height={ghost.height} key={ghost.key} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="detail-pane">
          {selectedItem ? (
            <MessageDetail
              key={selectedItem.id}
              expired={selectedItemExpired}
              item={selectedItem}
              now={now}
              onCopyMarkdown={onCopyMarkdown}
              onDeleteMessage={deleteMessage}
              onImagePreview={onImagePreview}
            />
          ) : (
            <div className="empty-detail-state">
              Select a queue item to inspect Markdown, copy commands, or download files.
            </div>
          )}
        </div>
      </div>

      {mobileDetailItem ? (
        <div className="mobile-detail-backdrop md:hidden" onClick={closeMobileDetail} role="presentation">
          <div className="mobile-detail-sheet" onClick={(event) => event.stopPropagation()}>
            <MessageDetail
              key={mobileDetailItem.id}
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
      <div className="rounded-md border border-dashed border-white/10 bg-black/10 p-5 text-sm text-slate-400">
        No items in the last hour.
      </div>
    </div>
  );
}

const DECAY_GHOST_MS = 1150;

interface DecayGhost {
  key: number;
  id: string;
  height: number;
}

// EXPIRY decay (§3.4) — detects rows that leave the active queue because they
// expired (not because they were deleted) and emits a short-lived decorative
// ghost in their place. Presentation-only: it observes activeItems, never the
// underlying queue/cleanup data. The ghost is aria-hidden and never interactive,
// so an expired item still disappears from the accessibility tree immediately.
function useExpiryDecay(activeItems: QueueItem[], now: Date) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const prevItemsRef = useRef<QueueItem[]>([]);
  const heightsRef = useRef<Map<string, number>>(new Map());
  const timersRef = useRef<Set<number>>(new Set());
  const keyRef = useRef(0);
  const [ghosts, setGhosts] = useState<DecayGhost[]>([]);

  // Measure live row heights before paint so a ghost can take the exact place of
  // the row about to unmount — no reflow jump (§3.4 "layout-safe").
  useLayoutEffect(() => {
    const container = listRef.current;
    if (!container) {
      return;
    }
    container.querySelectorAll<HTMLElement>('[data-row-id]').forEach((el) => {
      if (el.dataset.rowId) {
        heightsRef.current.set(el.dataset.rowId, el.offsetHeight);
      }
    });
  }, [activeItems]);

  useEffect(() => {
    const currentIds = new Set(activeItems.map((item) => item.id));
    const expired = prevItemsRef.current.filter(
      (item) => !currentIds.has(item.id) && getItemTimeState(item.expiresAt, now).expired,
    );
    prevItemsRef.current = activeItems;

    if (expired.length === 0) {
      return;
    }

    const fresh = expired.map((item) => {
      const height = heightsRef.current.get(item.id) ?? 56;
      heightsRef.current.delete(item.id);
      keyRef.current += 1;
      return { key: keyRef.current, id: item.id, height };
    });
    setGhosts((current) => [...current, ...fresh]);

    for (const ghost of fresh) {
      const timer = window.setTimeout(() => {
        setGhosts((current) => current.filter((candidate) => candidate.key !== ghost.key));
        timersRef.current.delete(timer);
      }, DECAY_GHOST_MS);
      timersRef.current.add(timer);
    }
  }, [activeItems, now]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    [],
  );

  return { ghosts, listRef };
}

// The decorative decay ghost itself (§3.4): a textless, aria-hidden stand-in that
// frays into rising particles + fades (transform/opacity), then performs the one
// layout-safe height collapse the scope sanctions. Reuses the shared ParticleBurst.
function ExpiryGhost({ height }: { height: number }) {
  return (
    <div aria-hidden="true" className="queue-decay-ghost" style={{ '--ghost-h': `${height}px` } as CSSProperties}>
      <div className="queue-decay-ghost-shape" />
      <ParticleBurst count={20} direction="scatter" rise={16} spread={72} />
    </div>
  );
}

interface QueueRowProps {
  index: number;
  item: QueueItem;
  now: Date;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  origin?: ArrivalOrigin;
  selected: boolean;
}

function QueueRow({ index, item, now, onDelete, onSelect, origin, selected }: QueueRowProps) {
  const title = getQueueItemTitle(item);
  const attachmentSummary = getAttachmentSummary(item.attachments);
  const imageCount = item.attachments.filter((attachment) => attachment.previewKind === 'image').length;
  const fileCount = item.attachments.length - imageCount;
  // Approaching expiry (§3.4): the last ~60s gets a calm amber edge + time badge.
  const timeState = getItemTimeState(item.expiresAt, now);
  const approaching = !timeState.expired && timeState.remainingMs <= 60_000;

  return (
    <div
      className={cx('queue-row-group', origin && 'fx-condense fx-sweep', selected && 'queue-row-selected')}
      data-approaching={approaching ? 'true' : undefined}
      data-origin={origin}
      data-row-id={item.id}
      style={staggerStyle(index)}
    >
      <span className="queue-edge" aria-hidden="true" />
      <button className="queue-row" onClick={() => onSelect(item.id)} title="Open queue item" type="button">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-100">{title}</p>
            <p className="mt-1 telemetry font-mono text-[11px] text-slate-400">
              {item.senderDeviceName} ·{' '}
              <span className="queue-time" data-approaching={approaching ? 'true' : undefined}>
                {formatTimeRemaining(item.expiresAt, now)}
              </span>
              {attachmentSummary ? ` · ${attachmentSummary}` : ''}
            </p>
            {origin === 'remote' ? (
              <span className="arrival-remote" aria-label="Arrived from another device">
                <span className="arrival-dot" aria-hidden="true" />
                from another device
              </span>
            ) : null}
          </div>
          {item.attachments.length > 0 ? (
            <div
              aria-label={attachmentSummary}
              className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
            >
              {item.attachments.length}
            </div>
          ) : null}
        </div>
        <div className="mt-3 telemetry flex items-center gap-2 text-[11px] text-slate-400">
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
  const attachmentDockRef = useRef<HTMLDivElement | null>(null);
  const attachmentDockId = `attachments-${item.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const timeState = getItemTimeState(item.expiresAt, now);
  const isExpired = expired || timeState.expired;

  function focusAttachmentDock() {
    attachmentDockRef.current?.scrollIntoView?.({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    });
    attachmentDockRef.current?.focus({ preventScroll: true });
  }

  return (
    <article className="message-detail">
      <div className="detail-toolbar">
        <div>
          <p className="label">Detail</p>
          <h3 className="text-base font-semibold text-slate-100">{getQueueItemTitle(item)}</h3>
          <p className="mt-1 telemetry font-mono text-[11px] text-slate-400">
            {item.senderDeviceName} · {formatTimeRemaining(item.expiresAt, now)}
          </p>
        </div>
        <div className="detail-actions">
          {item.attachments.length > 0 ? (
            <button
              aria-controls={attachmentDockId}
              className="secondary-button"
              onClick={focusAttachmentDock}
              type="button"
            >
              <IconPaperclip aria-hidden size={15} />
              {item.attachments.length === 1 ? '1 attachment' : `${item.attachments.length} attachments`}
            </button>
          ) : null}
          <CopyButton
            className="secondary-button fx-magnet"
            copiedLabel="Markdown copied"
            idleLabel="Copy Markdown"
            onCopy={() => onCopyMarkdown(item.markdown)}
          />
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

      <div className={cx('message-detail-body', item.attachments.length === 0 && 'message-detail-body-empty')}>
        {item.attachments.length > 0 ? (
          <AttachmentDock
            attachments={item.attachments}
            disabled={isExpired}
            dockId={attachmentDockId}
            dockRef={attachmentDockRef}
            onImagePreview={onImagePreview}
          />
        ) : null}

        <div className="detail-main-scroll">
          <div className="detail-main-inner">
            {isExpired ? <InlineAlert message="Message expired. It is hidden from the queue and downloads are disabled." /> : null}
            {item.markdown ? <MarkdownPreview markdown={item.markdown} /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

interface AttachmentDockProps {
  attachments: QueueAttachment[];
  disabled: boolean;
  dockId: string;
  dockRef: RefObject<HTMLDivElement | null>;
  onImagePreview: (attachment: QueueAttachment) => void;
}

function AttachmentDock({ attachments, disabled, dockId, dockRef, onImagePreview }: AttachmentDockProps) {
  return (
    <section
      aria-label="Message attachments"
      className="detail-attachment-dock"
      id={dockId}
      ref={dockRef}
      tabIndex={-1}
    >
      <div className="attachment-dock-header">
        <div>
          <p className="label">Attachments</p>
          <h4 className="text-sm font-semibold text-slate-100">
            {attachments.length === 1 ? '1 attachment' : `${attachments.length} attachments`}
          </h4>
        </div>
        <p className="telemetry font-mono text-[11px] text-slate-400">{getAttachmentSummary(attachments)}</p>
      </div>
      <div className="attachment-grid attachment-dock-grid">
        {attachments.map((attachment) =>
          attachment.previewKind === 'image' ? (
            <ImageAttachment disabled={disabled} key={attachment.id} attachment={attachment} onPreview={onImagePreview} />
          ) : (
            <FileDownloadRow attachment={attachment} disabled={disabled} key={attachment.id} />
          ),
        )}
      </div>
    </section>
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
  const [previewFailed, setPreviewFailed] = useState(false);
  const canShowPreview = Boolean(attachment.objectUrl) && !previewFailed;

  return (
    <button
      className="attachment-card image-attachment"
      disabled={disabled}
      onClick={() => onPreview(attachment)}
      title={disabled ? 'Preview expired' : 'Open image preview'}
      type="button"
    >
      <div className="attachment-preview">
        {canShowPreview ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            onError={() => setPreviewFailed(true)}
            src={attachment.objectUrl}
          />
        ) : (
          <IconPhoto aria-hidden size={22} />
        )}
      </div>
      <div className="attachment-copy">
        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
        <p className="telemetry font-mono text-[11px] text-slate-400">
          {formatBytes(attachment.fileSize)} · {previewFailed ? 'preview unavailable' : 'image preview'}
        </p>
      </div>
    </button>
  );
}

function FileDownloadRow({ attachment, disabled }: { attachment: QueueAttachment; disabled: boolean }) {
  return (
    <div className="attachment-card file-row">
      <div className="attachment-preview">
        <IconFile aria-hidden size={18} />
      </div>
      <div className="attachment-copy">
        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
        <p className="telemetry font-mono text-[11px] text-slate-400">
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

interface DeleteConfirmDialogProps {
  confirming: boolean;
  deleteConfirmationEnabled: boolean;
  item: QueueItem;
  now: Date;
  onCancel: () => void;
  onConfirm: () => void;
  onPreferenceChange: (enabled: boolean) => void;
}

function DeleteConfirmDialog({
  confirming,
  deleteConfirmationEnabled,
  item,
  now,
  onCancel,
  onConfirm,
  onPreferenceChange,
}: DeleteConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const latestDialogStateRef = useRef({ confirming, onCancel });
  const title = getQueueItemTitle(item);
  const attachmentSummary = getAttachmentSummary(item.attachments);

  useEffect(() => {
    latestDialogStateRef.current = { confirming, onCancel };
  }, [confirming, onCancel]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => cancelButtonRef.current?.focus(), 0);

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!latestDialogStateRef.current.confirming) {
          latestDialogStateRef.current.onCancel();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="confirm-backdrop" onClick={() => !confirming && onCancel()} role="presentation">
      <div
        aria-describedby="delete-confirm-description"
        aria-labelledby="delete-confirm-title"
        aria-modal="true"
        className="confirm-dialog"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <div className="confirm-header">
          <div className="confirm-icon">
            <IconTrash aria-hidden size={19} stroke={1.8} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight" id="delete-confirm-title">
              Delete this message?
            </h3>
            <p className="mt-1 text-sm text-slate-400" id="delete-confirm-description">
              This removes the relay item from every paired device. It cannot be restored.
            </p>
          </div>
        </div>

        <div className="confirm-summary">
          <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
          <p className="mt-1 telemetry font-mono text-[11px] text-slate-400">
            {item.senderDeviceName} · {formatTimeRemaining(item.expiresAt, now)}
            {attachmentSummary ? ` · ${attachmentSummary}` : ''}
          </p>
        </div>

        <label className="confirm-option">
          <input
            checked={deleteConfirmationEnabled}
            className="confirm-checkbox"
            onChange={(event) => onPreferenceChange(event.target.checked)}
            type="checkbox"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-100">Ask before deleting messages</span>
            <span className="block text-xs text-slate-400">Turn this off when you want queue deletes to run immediately.</span>
          </span>
        </label>

        <div className="confirm-actions">
          <button className="secondary-button" disabled={confirming} onClick={onCancel} ref={cancelButtonRef} type="button">
            Cancel
          </button>
          <button className="danger-button danger-button-strong" disabled={confirming} onClick={onConfirm} type="button">
            {confirming ? <IconLoader2 aria-hidden className="motion-safe:animate-spin" size={15} /> : <IconTrash aria-hidden size={15} />}
            {confirming ? 'Deleting' : 'Delete message'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImagePreviewModal({ attachment, onClose }: { attachment: QueueAttachment; onClose: () => void }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const canShowPreview = Boolean(attachment.objectUrl) && !previewFailed;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div aria-label="Image preview" aria-modal="true" className="modal-panel" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{attachment.fileName}</p>
            <p className="telemetry font-mono text-[11px] text-slate-400">{formatBytes(attachment.fileSize)}</p>
          </div>
          <button aria-label="Close image preview" className="icon-button" onClick={onClose} title="Close image preview" type="button">
            <IconX aria-hidden size={16} />
          </button>
        </div>
        <div className="flex max-h-[72dvh] items-center justify-center rounded border border-white/10 bg-black/30">
          {canShowPreview ? (
            <img
              alt={attachment.fileName}
              className="max-h-[72dvh] max-w-full object-contain"
              onError={() => setPreviewFailed(true)}
              src={attachment.objectUrl}
            />
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-10 text-center text-sm text-slate-400">
              <IconPhoto aria-hidden size={28} />
              <span>
                {attachment.objectUrl
                  ? 'Preview is not available in this browser. Download the file to view it.'
                  : 'Preview URL is not available in this test environment.'}
              </span>
            </div>
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

// Aurora activity coupling (§4.5): when `energizedSignal` changes (a send fires),
// the ambient field brightens for ~1s then settles, so it feels responsive to use
// rather than a screensaver. The pulse is opacity-only CSS; here we just flip a
// data flag for ~1s — no per-frame React state.
function AmbientField({ energizedSignal }: { energizedSignal?: number }) {
  const fieldRef = useRef<HTMLDivElement | null>(null);

  // Flip the flag straight on the DOM (an external system — the idiomatic use of
  // an effect, and §7's "no per-frame React state"): a CSS transition handles the
  // ~1s brighten-then-settle, so React never re-renders for the pulse.
  useEffect(() => {
    const el = fieldRef.current;
    if (energizedSignal == null || !el) {
      return;
    }
    el.dataset.energized = 'true';
    const timer = window.setTimeout(() => el.removeAttribute('data-energized'), 1000);

    return () => window.clearTimeout(timer);
  }, [energizedSignal]);

  return (
    <div className="ambient-field" aria-hidden="true" ref={fieldRef}>
      <div className="ambient-aurora ambient-aurora-a" />
      <div className="ambient-aurora ambient-aurora-b" />
      <div className="ambient-aurora ambient-aurora-c" />
      <div className="ambient-grid" />
      <div className="ambient-pulse" />
    </div>
  );
}

// Grain (§4.3): a single static, tiled noise layer over flat fills + aurora to
// kill colour banding on large screens. Decorative; aria-hidden, pointer-events
// none — all styling (incl. the feTurbulence data-URI) lives in `.grain-field`.
function GrainField() {
  return <div className="grain-field" aria-hidden="true" />;
}

// THE SEND — the literal travelling beam that sweeps Composer (left) → Queue
// (right). Keyed by fx.id so each send remounts the streak and replays the CSS;
// decorative, so aria-hidden and pointer-events:none.
function SendBeam({ fx }: { fx: SendFx | null }) {
  if (!fx) {
    return null;
  }

  return (
    <div className="send-beam-layer" aria-hidden="true">
      <span key={fx.id} className={cx('send-beam', fx.phase === 'recoil' && 'send-beam-recoil')} />
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
    return 'Ready';
  }

  if (attachment.status === 'signing') {
    return 'Preparing upload';
  }

  if (attachment.status === 'uploading') {
    return 'Uploading';
  }

  if (attachment.status === 'uploaded') {
    return 'Uploaded';
  }

  if (attachment.status === 'failed') {
    return 'Failed';
  }

  return 'Queued';
}

function getQueueItemTitle(item: QueueItem): string {
  const text = item.markdown
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/[#>*_`|[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text) {
    return text.length > 92 ? `${text.slice(0, 92)}...` : text;
  }

  return getAttachmentSummary(item.attachments) || 'Markdown note';
}

function getAttachmentSummary(attachments: QueueAttachment[]): string {
  if (attachments.length === 0) {
    return '';
  }

  const imageCount = attachments.filter((attachment) => attachment.previewKind === 'image').length;
  const fileCount = attachments.length - imageCount;
  const parts: string[] = [];

  if (imageCount > 0) {
    parts.push(imageCount === 1 ? '1 image' : `${imageCount} images`);
  }

  if (fileCount > 0) {
    parts.push(fileCount === 1 ? '1 file' : `${fileCount} files`);
  }

  return parts.join(' + ');
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

// Keep the arrival-origin map bounded to ids still present in the queue.
function pruneArrivals(arrivals: Record<string, ArrivalOrigin>, liveIds: Set<string>): Record<string, ArrivalOrigin> {
  const next: Record<string, ArrivalOrigin> = {};

  for (const [id, origin] of Object.entries(arrivals)) {
    if (liveIds.has(id)) {
      next[id] = origin;
    }
  }

  return next;
}

function getInitialDeleteConfirmationEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(DELETE_CONFIRMATION_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function saveDeleteConfirmationEnabled(enabled: boolean) {
  try {
    globalThis.localStorage?.setItem(DELETE_CONFIRMATION_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Preference storage is best-effort; deletion safety still defaults to confirmation.
  }
}

function createLocalId(): string {
  return globalThis.crypto.randomUUID?.() ?? `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default App;
