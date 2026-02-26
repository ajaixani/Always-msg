import { useState, useEffect, useRef, useCallback } from 'react';
import useAppStore from '../state/useAppStore';
import { getAllThreads, getOrCreateThread, createGroupThread, deleteThread, updateThreadTimestamp } from '../db/threadsDb';
import { getMessages, addMessage, getLastMessage } from '../db/messagesDb';
import { streamChat } from '../llm/llmClient';
import { startRecording, MicPermissionError } from '../audio/micCapture';
import { createVAD } from '../audio/vad';
import { isSpeechAPIAvailable, createSpeechSession, transcribeBlob } from '../audio/asrClient';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import GroupSheet from '../components/GroupSheet';
import styles from './ChatView.module.css';

/** Format a timestamp as a relative label like "2m ago", "3h ago", "Mon" */
function relativeTime(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    if (min < 1) return 'now';
    if (min < 60) return `${min}m`;
    if (hr < 24) return `${hr}h`;
    return new Date(ts).toLocaleDateString(undefined, { weekday: 'short' });
}

/**
 * ChatView — Phase 4.
 *
 * Left panel: thread list with last-message preview + new-chat FAB.
 * Right panel: conversation with streaming bubbles, group send loop, retry.
 */
export default function ChatView() {
    const contacts = useAppStore((s) => s.contacts);
    const settings = useAppStore((s) => s.settings);
    const isStreaming = useAppStore((s) => s.isStreaming);
    const setStreaming = useAppStore((s) => s.setStreaming);
    const setActiveThreadTitle = useAppStore((s) => s.setActiveThreadTitle);
    const setRecording = useAppStore((s) => s.setRecording);
    const setVadActive = useAppStore((s) => s.setVadActive);
    const setListening = useAppStore((s) => s.setListening);
    const setMicError = useAppStore((s) => s.setMicError);

    // ── Thread list state ────────────────────────────────────────────
    const [threads, setThreads] = useState([]);   // all threads
    const [previews, setPreviews] = useState({});   // { threadId: Message }
    const [activeThread, setActiveThread] = useState(null); // full thread object

    // ── Conversation state ───────────────────────────────────────────
    const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState('');
    const [lastUserText, setLastUserText] = useState('');   // for retry
    const [sheetOpen, setSheetOpen] = useState(false);

    const messagesEndRef = useRef(null);
    const speechSessionRef = useRef(null);   // Web Speech API session handle
    const recorderRef = useRef(null);        // MediaRecorder handle (Whisper path)
    const vadLoopRef = useRef(null);         // live-mode VAD handle

    // Contacts in the active thread
    const threadContacts = activeThread
        ? String(activeThread.contactIds).split(',').map(Number)
            .map((id) => contacts.find((c) => c.id === id))
            .filter(Boolean)
        : [];

    /* ── Load thread list ──────────────────────────────────────────── */
    const refreshThreads = useCallback(async () => {
        const all = await getAllThreads();
        setThreads(all);
        // Load last-message previews for each thread
        const prevMap = {};
        await Promise.all(all.map(async (t) => {
            prevMap[t.id] = await getLastMessage(t.id);
        }));
        setPreviews(prevMap);
    }, []);

    useEffect(() => { refreshThreads(); }, [refreshThreads]);

    /* ── Auto-scroll ───────────────────────────────────────────────── */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText]);

    /* ── Load messages when active thread changes ──────────────────── */
    useEffect(() => {
        if (!activeThread) { setMessages([]); return; }
        (async () => {
            const msgs = await getMessages(activeThread.id);
            setMessages(msgs);
        })();
    }, [activeThread]);

    /* ── Open a thread ─────────────────────────────────────────────── */
    const openThread = useCallback(async (thread) => {
        if (isStreaming) return;
        setActiveThread(thread);
        setStreamingText('');
        // Derive title: explicit title, or contact name(s)
        const ids = String(thread.contactIds).split(',').map(Number);
        const names = ids.map((id) => contacts.find((c) => c.id === id)?.name ?? '?');
        const title = thread.title || names.join(', ');
        setActiveThreadTitle(title);
    }, [isStreaming, contacts, setActiveThreadTitle]);

    /* ── Create solo thread from sheet ────────────────────────────── */
    const handleCreateSolo = useCallback(async (contactId) => {
        const thread = await getOrCreateThread(contactId);
        await refreshThreads();
        openThread(thread);
    }, [refreshThreads, openThread]);

    /* ── Create group thread from sheet ───────────────────────────── */
    const handleCreateGroup = useCallback(async (contactIds, title) => {
        const thread = await createGroupThread(contactIds, title);
        await refreshThreads();
        openThread(thread);
    }, [refreshThreads, openThread]);

    /* ── Delete thread ─────────────────────────────────────────────── */
    const handleDeleteThread = useCallback(async (threadId, e) => {
        e.stopPropagation();
        await deleteThread(threadId);
        if (activeThread?.id === threadId) {
            setActiveThread(null);
            setActiveThreadTitle('');
        }
        await refreshThreads();
    }, [activeThread, setActiveThreadTitle, refreshThreads]);

    /* ── PTT: record start ─────────────────────────────────────────── */
    const handleRecordStart = useCallback(async () => {
        if (isStreaming) return;
        setMicError(null);
        setRecording(true);

        const asrEndpoint = settings?.asrEndpoint?.trim();
        const useWhisper = !!asrEndpoint;

        if (useWhisper || !isSpeechAPIAvailable()) {
            // Whisper endpoint path: capture audio blob on stop
            try {
                recorderRef.current = await startRecording();
            } catch (err) {
                if (err instanceof MicPermissionError) setMicError(err.message);
                else setMicError(`Mic error: ${err.message}`);
                setRecording(false);
            }
        } else {
            // Web Speech API path: recognition runs during hold
            speechSessionRef.current = createSpeechSession({
                onResult: (transcript) => {
                    if (transcript) handleSend(transcript);
                    speechSessionRef.current = null;
                },
                onError: (err) => {
                    setMicError(err.message);
                    speechSessionRef.current = null;
                },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStreaming, settings]);

    /* ── PTT: record stop ──────────────────────────────────────────── */
    const handleRecordStop = useCallback(async () => {
        setRecording(false);

        // Web Speech API path — stop recognition, result comes via onResult callback
        if (speechSessionRef.current) {
            speechSessionRef.current.stop();
            speechSessionRef.current = null;
            return;
        }

        // Whisper path — finalise blob and POST
        if (recorderRef.current) {
            try {
                const blob = await recorderRef.current.stop();
                recorderRef.current = null;
                const transcript = await transcribeBlob(blob, settings);
                if (transcript) handleSend(transcript);
            } catch (err) {
                setMicError(err.message);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings]);

    /* ── Live mode: VAD auto-listen loop ───────────────────────────── */
    useEffect(() => {
        const isLive = settings?.activeMode === 'live';
        if (!isLive || !activeThread) {
            vadLoopRef.current?.destroy();
            vadLoopRef.current = null;
            setListening(false);
            return;
        }

        let recorder = null;
        let session = null;
        const sensitivity = Number(settings?.vadSensitivity ?? 0.5);
        const asrEndpoint = settings?.asrEndpoint?.trim();
        const useWhisper = !!asrEndpoint;

        async function startLiveListening(stream) {
            setListening(true);
            vadLoopRef.current = createVAD({
                stream,
                sensitivity,
                onSpeechStart: () => setVadActive(true),
                onSpeechEnd: async () => {
                    setVadActive(false);
                    if (useWhisper && recorder) {
                        const blob = await recorder.stop();
                        recorder = null;
                        try {
                            const text = await transcribeBlob(blob, settings);
                            if (text) handleSend(text);
                        } catch (err) { setMicError(err.message); }
                    } else if (!useWhisper && session) {
                        session.stop();
                        session = null;
                    }
                },
            });

            if (useWhisper) {
                recorder = await startRecording();
            } else if (isSpeechAPIAvailable()) {
                session = createSpeechSession({
                    onResult: (t) => { if (t) handleSend(t); },
                    onError: (e) => setMicError(e.message),
                });
            }
        }

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(startLiveListening)
            .catch((err) => setMicError(err.message));

        return () => {
            vadLoopRef.current?.destroy();
            vadLoopRef.current = null;
            setListening(false);
            setVadActive(false);
            recorder?.stop().catch(() => { });
            session?.stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeThread, settings?.activeMode, settings?.vadSensitivity]);

    /* ── Send a message (solo + group) ────────────────────────────── */

    const handleSend = useCallback(async (text) => {
        if (!activeThread || !threadContacts.length || isStreaming) return;

        setLastUserText(text);

        // 1. Persist + display user message
        const userMsg = await addMessage(activeThread.id, 'user', text);
        setMessages((prev) => [...prev, userMsg]);

        setStreaming(true);
        setStreamingText('');

        const contextLimit = settings?.contextWindowSize ?? 20;

        // 2. Loop through each contact in the thread
        for (const contact of threadContacts) {
            const history = await getMessages(activeThread.id, contextLimit);
            const llmMessages = history.map(({ role, content }) => ({ role, content }));

            let accumulated = '';
            const isGroup = threadContacts.length > 1;

            await streamChat({
                contact,
                settings,
                messages: llmMessages,
                onToken: (chunk) => {
                    accumulated += chunk;
                    setStreamingText(accumulated);
                },
                onDone: async (fullText) => {
                    const saved = await addMessage(activeThread.id, 'assistant', fullText || accumulated);
                    // Tag group messages with the sender contact id for label rendering
                    setMessages((prev) => [
                        ...prev,
                        { ...saved, _contactId: isGroup ? contact.id : undefined },
                    ]);
                    accumulated = '';
                    setStreamingText('');
                },
                onError: async (err) => {
                    const errMsg = await addMessage(activeThread.id, 'assistant', `⚠️ ${err.message}`);
                    setMessages((prev) => [
                        ...prev,
                        { ...errMsg, _contactId: isGroup ? contact.id : undefined },
                    ]);
                    accumulated = '';
                    setStreamingText('');
                },
            });
        }

        setStreaming(false);
        await updateThreadTimestamp(activeThread.id);
        await refreshThreads();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeThread, threadContacts, isStreaming, settings]);

    /* ── Derive header avatars for thread ─────────────────────────── */
    function threadAvatars(thread) {
        const ids = String(thread.contactIds).split(',').map(Number).slice(0, 3);
        return ids.map((id) => contacts.find((c) => c.id === id)?.avatar ?? '🤖');
    }

    function threadTitle(thread) {
        if (thread.title) return thread.title;
        const ids = String(thread.contactIds).split(',').map(Number);
        return ids.map((id) => contacts.find((c) => c.id === id)?.name ?? '?').join(', ');
    }

    /* ── Render ────────────────────────────────────────────────────── */
    return (
        <div className={styles.chatLayout}>

            {/* ── Thread sidebar ───────────────────────────── */}
            <aside
                className={`${styles.contactList} ${activeThread ? styles.contactListHidden : ''}`}
                aria-label="Threads"
            >
                {threads.length === 0 ? (
                    <div className={styles.emptyContacts}>
                        <span className={styles.emptyIcon} aria-hidden="true">💬</span>
                        <p className={styles.emptyTitle}>No chats yet</p>
                        <p className={styles.emptySubtext}>Tap + to start a conversation.</p>
                    </div>
                ) : (
                    <ul className={styles.contactItems} role="list">
                        {threads.map((t) => {
                            const preview = previews[t.id];
                            const avatars = threadAvatars(t);
                            const isActive = t.id === activeThread?.id;
                            return (
                                <li key={t.id}>
                                    <button
                                        className={`${styles.contactItem} ${isActive ? styles.contactItemActive : ''}`}
                                        onClick={() => openThread(t)}
                                        id={`thread-btn-${t.id}`}
                                        aria-pressed={isActive}
                                    >
                                        <span className={styles.contactAvatar}>
                                            {avatars.join('')}
                                        </span>
                                        <div className={styles.contactMeta}>
                                            <span className={styles.contactName}>{threadTitle(t)}</span>
                                            <span className={styles.threadPreview}>
                                                {preview
                                                    ? (preview.role === 'user' ? 'You: ' : '') +
                                                    preview.content.replace(/^⚠️ /, '').slice(0, 55) +
                                                    (preview.content.length > 55 ? '…' : '')
                                                    : 'No messages yet'}
                                            </span>
                                        </div>
                                        <div className={styles.threadMeta}>
                                            <span className={styles.threadTime}>
                                                {relativeTime(t.updatedAt)}
                                            </span>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={(e) => handleDeleteThread(t.id, e)}
                                                aria-label="Delete thread"
                                                title="Delete thread"
                                                id={`thread-delete-${t.id}`}
                                            >✕</button>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {/* FAB — new chat */}
                <button
                    className={styles.fab}
                    onClick={() => setSheetOpen(true)}
                    aria-label="New chat"
                    id="new-chat-fab"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
            </aside>

            {/* ── Conversation pane ────────────────────────── */}
            <section
                className={`${styles.conversationPane} ${!activeThread ? styles.conversationPaneHidden : ''}`}
                aria-label="Conversation"
            >
                {/* Back button (mobile) */}
                {activeThread && (
                    <button
                        className={styles.backBtn}
                        onClick={() => { setActiveThread(null); setActiveThreadTitle(''); setStreamingText(''); }}
                        aria-label="Back to threads"
                        id="chat-back-button"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        <span className={styles.backTitle}>
                            {threadContacts.map((c) => c.avatar).join(' ')} {activeThread && threadTitle(activeThread)}
                        </span>
                    </button>
                )}

                {/* Messages */}
                <div className={styles.messages} role="list" aria-live="polite">
                    {messages.length === 0 && !isStreaming && activeThread && (
                        <div className={styles.conversationEmpty}>
                            <span className={styles.bigAvatar}>
                                {threadContacts.map((c) => c.avatar).join(' ') || '🤖'}
                            </span>
                            <p className={styles.emptyTitle}>{activeThread && threadTitle(activeThread)}</p>
                            <p className={styles.emptySubtext}>Say something to start the conversation.</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        const isLast = idx === messages.length - 1;
                        const isLastError = isLast && msg.role === 'assistant' && msg.content?.startsWith('⚠️');
                        // For group threads, look up sender by _contactId tag
                        const senderContact = msg._contactId
                            ? contacts.find((c) => c.id === msg._contactId)
                            : (msg.role === 'assistant' ? threadContacts[0] : null);
                        const showName = threadContacts.length > 1 && msg.role === 'assistant';
                        return (
                            <MessageBubble
                                key={msg.id ?? `msg-${idx}`}
                                role={msg.role}
                                content={msg.content}
                                avatar={senderContact?.avatar ?? '🤖'}
                                senderName={showName ? senderContact?.name : undefined}
                                onRetry={isLastError ? () => handleSend(lastUserText) : undefined}
                            />
                        );
                    })}

                    {/* Live streaming bubble */}
                    {isStreaming && streamingText !== '' && (
                        <MessageBubble
                            role="assistant"
                            content={streamingText}
                            isStreaming
                            avatar={threadContacts[0]?.avatar ?? '🤖'}
                            senderName={threadContacts.length > 1 ? threadContacts[0]?.name : undefined}
                        />
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {activeThread && (
                    <ChatInput
                        onSend={handleSend}
                        onRecordStart={handleRecordStart}
                        onRecordStop={handleRecordStop}
                        disabled={isStreaming}
                        placeholder={`Message ${activeThread && threadTitle(activeThread)}…`}
                    />
                )}
            </section>

            {/* ── New Chat Sheet ───────────────────────────── */}
            <GroupSheet
                contacts={contacts}
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onCreateSolo={handleCreateSolo}
                onCreateGroup={handleCreateGroup}
            />
        </div>
    );
}
