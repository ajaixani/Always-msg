import { useState, useEffect, useRef, useCallback } from 'react';
import useAppStore from '../state/useAppStore';
import { getAllThreads, getOrCreateThread, createGroupThread, deleteThread, updateThreadTimestamp } from '../db/threadsDb';
import { getMessages, addMessage, getLastMessage } from '../db/messagesDb';
import { streamChat } from '../llm/llmClient';
import { startRecording, MicPermissionError } from '../audio/micCapture';
import { createVAD } from '../audio/vad';
import { isSpeechAPIAvailable, createSpeechSession, transcribeBlob } from '../audio/asrClient';
import { speak } from '../audio/ttsClient';
import { ttsPlayer } from '../audio/ttsPlayer';
import { saveSetting } from '../db/settingsDb';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import GroupSheet from '../components/GroupSheet';
import ImagePreview from '../components/ImagePreview';
import SummarizerSheet from '../components/SummarizerSheet';
import SeedCrystalSheet from '../components/SeedCrystalSheet';
import SpectrographMouth from '../components/SpectrographMouth';
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
    const setTTSPlaying = useAppStore((s) => s.setTTSPlaying);
    const setTTSLevel = useAppStore((s) => s.setTTSLevel);
    const isTTSPlaying = useAppStore((s) => s.isTTSPlaying);
    const setSetting = useAppStore((s) => s.setSetting);

    // ── Thread list state ────────────────────────────────────────────
    const [threads, setThreads] = useState([]);   // all threads
    const [previews, setPreviews] = useState({});   // { threadId: Message }
    const [activeThread, setActiveThread] = useState(null); // full thread object

    // ── Conversation state ───────────────────────────────────────────
    const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState('');
    const [lastUserText, setLastUserText] = useState('');   // for retry
    const [sheetOpen, setSheetOpen] = useState(false);

    // ── Phase 10 sheet states ────────────────────────────────────────
    const [summarizerOpen, setSummarizerOpen] = useState(false);
    const [seedMode, setSeedMode] = useState(null); // null | 'current' | 'single'
    const [menuOpen, setMenuOpen] = useState(false);
    const menuWrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuWrapperRef.current && !menuWrapperRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [menuWrapperRef, setMenuOpen]);

    const messagesEndRef = useRef(null);
    const speechSessionRef = useRef(null);   // Web Speech API session handle
    const recorderRef = useRef(null);   // MediaRecorder handle (Whisper path)
    const vadLoopRef = useRef(null);   // live-mode VAD handle
    const ttsHandleRef = useRef(null);   // current TTS play handle → .stop()
    const fileInputRef = useRef(null);   // hidden file input for image attach
    const cameraStreamRef = useRef(null); // live camera MediaStream

    // ── Image attachment state (Phase 9) ────────────────────────────
    const [pendingImage, setPendingImage] = useState(null); // data URL | null

    // ── ASR mode + live toggle ────────────────────────────────────────
    const [isRecordingToggle, setIsRecordingToggle] = useState(false);
    const [liveMuted, setLiveMuted] = useState(false);

    // Flip PUSH ↔ LIVE and persist immediately
    const toggleLiveMode = useCallback(() => {
        const next = (settings?.activeMode === 'live') ? 'push' : 'live';
        setSetting('activeMode', next);
        saveSetting('activeMode', next);
        setLiveMuted(false); // reset mute on mode switch
    }, [settings?.activeMode, setSetting]);

    // Contacts in the active thread
    const threadContacts = activeThread
        ? String(activeThread.contactIds).split(',').map(Number)
            .map((id) => contacts.find((c) => c.id === id))
            .filter(Boolean)
        : [];

    // ── Vision capability check ──────────────────────────────────────
    function isVisionCapable(contact) {
        const v = contact?.llmConfig?.vision;
        if (v === 'on') return true;
        if (v === 'off') return false;
        // Auto-detect from model name
        const model = (contact?.llmConfig?.model || settings?.model || '').toLowerCase();
        return (
            model.includes('vision') ||
            model.startsWith('gpt-4') ||
            model.includes('claude-3') ||
            model.includes('gemini')
        );
    }
    // True if ANY contact in the thread supports vision
    const threadHasVision = threadContacts.some(isVisionCapable);

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

    /* ── PTT: record start (hold) ──────────────────────────────────── */
    const handleRecordStart = useCallback(async () => {
        if (isStreaming) return;

        // Interrupt any playing TTS immediately
        ttsHandleRef.current?.stop();
        ttsHandleRef.current = null;
        setMicError(null);
        setRecording(true);

        const asrEndpoint = settings?.asrEndpoint?.trim();
        const useWhisper = !!asrEndpoint;

        if (useWhisper || !isSpeechAPIAvailable()) {
            // Whisper endpoint path: capture audio blob, stop on pointer-up
            try {
                recorderRef.current = await startRecording();
            } catch (err) {
                if (err instanceof MicPermissionError) setMicError(err.message);
                else setMicError(`Mic error: ${err.message}`);
                setRecording(false);
            }
        } else {
            // Web Speech API path: recognition runs until stop() is called
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
        setIsRecordingToggle(false);

        // VAD cleanup for push mode single-shot tap
        if (vadLoopRef.current && settings?.activeMode !== 'live') {
            vadLoopRef.current.destroy();
            vadLoopRef.current = null;
            setVadActive(false);
        }

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

    /* ── Tap-to-toggle / Single-shot VAD ───────────────────────────── */
    const handleMicTap = useCallback(async () => {
        if (isStreaming) return;

        const isLive = settings?.activeMode === 'live';
        if (isLive) {
            setLiveMuted(m => !m);
            return;
        }

        // Second tap → stop early
        if (isRecordingToggle) {
            handleRecordStop();
            return;
        }

        // First tap → start single-shot VAD
        ttsHandleRef.current?.stop();
        ttsHandleRef.current = null;
        setMicError(null);
        setRecording(true);
        setIsRecordingToggle(true);

        const asrEndpoint = settings?.asrEndpoint?.trim();
        const sensitivity = Number(settings?.vadSensitivity ?? 0.5);

        if (asrEndpoint || !isSpeechAPIAvailable()) {
            // Whisper path: start MediaRecorder + VAD
            try {
                const recorder = await startRecording();
                recorderRef.current = recorder;

                vadLoopRef.current = createVAD({
                    stream: recorder.stream,
                    sensitivity,
                    onSpeechStart: () => setVadActive(true),
                    onSpeechEnd: () => {
                        setVadActive(false);
                        if (recorderRef.current === recorder) {
                            handleRecordStop(); // finalize and send
                        }
                    },
                    onLevel: (rms) => setTTSLevel(rms),
                });
            } catch (err) {
                if (err instanceof MicPermissionError) setMicError(err.message);
                else setMicError(`Mic error: ${err.message}`);
                setRecording(false);
                setIsRecordingToggle(false);
            }
        } else {
            // Web Speech API: continuous=false acts as native single-shot VAD
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false; // auto-stops after silence
            recognition.interimResults = false;
            recognition.lang = navigator.language || 'en-US';
            recognition.maxAlternatives = 1;

            recognition.onresult = (event) => {
                const finalTranscript = event.results[0][0].transcript;
                if (finalTranscript.trim()) handleSend(finalTranscript.trim());
            };

            recognition.onerror = (event) => {
                const msg = event.error === 'no-speech' ? 'No speech detected.' : `ASR error: ${event.error}`;
                setMicError(msg);
                setRecording(false);
                setIsRecordingToggle(false);
                speechSessionRef.current = null;
            };

            recognition.onend = () => {
                setRecording(false);
                setIsRecordingToggle(false);
                speechSessionRef.current = null;
            };

            recognition.start();
            speechSessionRef.current = { stop: () => recognition.stop() };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStreaming, isRecordingToggle, settings]);

    /* ── Live mode: VAD auto-listen loop ───────────────────────────── */
    useEffect(() => {
        const isLive = settings?.activeMode === 'live';
        if (!isLive || !activeThread || liveMuted) {
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

        // Change B: receive the already-open stream so VAD and recorder share one mic.
        async function startLiveListening(stream) {
            setListening(true);

            // Change D: helper that (re)starts a Web Speech session and loops on result.
            function startSession() {
                session = createSpeechSession({
                    onResult: (t) => {
                        if (t) handleSend(t);
                        session = null;
                        if (!liveMuted) startSession(); // loop for the next utterance
                    },
                    onError: (e) => {
                        setMicError(e.message);
                        session = null;
                    },
                });
            }

            vadLoopRef.current = createVAD({
                stream,
                sensitivity,
                onSpeechStart: () => {
                    // Interrupt TTS immediately when user speaks in live mode
                    ttsHandleRef.current?.stop();
                    ttsHandleRef.current = null;
                    setVadActive(true);
                },
                onSpeechEnd: async () => {
                    setVadActive(false);
                    if (useWhisper && recorder) {
                        const blobPromise = recorder.stop();
                        recorder = null;
                        try {
                            const blob = await blobPromise;
                            const text = await transcribeBlob(blob, settings);
                            if (text) handleSend(text);
                        } catch (err) { setMicError(err.message); }

                        // Change C: restart recorder on the shared stream for the next utterance.
                        if (!liveMuted) {
                            recorder = await startRecording({ stream });
                        }
                    } else if (!useWhisper && session) {
                        // Web Speech looping is handled inside startSession() via onResult.
                        // Nothing extra needed here; the session will restart itself.
                    }
                },
            });

            // Change B: pass the shared stream into the recorder (no second getUserMedia).
            if (useWhisper) {
                recorder = await startRecording({ stream });
            } else if (isSpeechAPIAvailable()) {
                startSession();
            }
        }

        // Open one stream for both VAD and recorder.
        let sharedStream = null;
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
                sharedStream = stream;
                return startLiveListening(stream);
            })
            .catch((err) => setMicError(err.message));

        return () => {
            vadLoopRef.current?.destroy();
            vadLoopRef.current = null;
            setListening(false);
            setVadActive(false);
            recorder?.stop().catch(() => { });
            session?.stop();
            // Change E: caller owns the shared stream — close it here on cleanup.
            sharedStream?.getTracks().forEach((t) => t.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeThread, settings?.activeMode, settings?.vadSensitivity, liveMuted]);

    /* ── Send a message (solo + group) ────────────────────────────── */

    const handleSend = useCallback(async (text) => {
        if (!activeThread || !threadContacts.length || isStreaming) return;

        setLastUserText(text);

        // Consume and clear the pending image
        const imageToSend = pendingImage;
        setPendingImage(null);

        // 1. Persist + display user message (with optional image)
        const userMsg = await addMessage(activeThread.id, 'user', text, imageToSend);
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

            // ── Sentence-streaming TTS: sequential queue ───────────────
            const ttsEndpoint = contact.ttsConfig?.endpoint?.trim() || settings?.ttsEndpoint?.trim();
            const ttsSettings = ttsEndpoint ? {
                ...settings,
                ttsEndpoint,
                ttsVoice: contact.ttsConfig?.voice?.trim() || settings?.ttsVoice || 'af_heart',
            } : null;
            let ttsBuffer = '';             // partial sentence accumulator
            const ttsQueue = [];            // queued complete sentences
            let ttsSpeaking = false;        // is a sentence currently playing?

            function flushTTSQueue() {
                if (ttsSpeaking || ttsQueue.length === 0) return;
                const sentence = ttsQueue.shift();
                ttsSpeaking = true;
                speak(sentence, ttsSettings, {
                    onPlay: () => setTTSPlaying(true),
                    onStop: () => {
                        setTTSPlaying(false);
                        ttsSpeaking = false;
                        flushTTSQueue(); // play next sentence in queue
                    },
                    onLevel: (rms) => setTTSLevel(rms),
                }).then((h) => { ttsHandleRef.current = h; })
                    .catch((err) => {
                        console.warn('[TTS queue]', err.message);
                        ttsSpeaking = false;
                        flushTTSQueue();
                    });
            }

            await streamChat({
                contact,
                settings,
                messages: llmMessages,
                imageDataUrl: imageToSend,
                onToken: (chunk) => {
                    accumulated += chunk;
                    setStreamingText(accumulated);

                    // ── Sentence-streaming TTS ──────────────────────────
                    if (!ttsSettings) return;
                    let rest = ttsBuffer + chunk;
                    // Sentence boundary: . ! ? optionally followed by closing punctuation + whitespace
                    const boundary = /[.!?][)\]"'`]?\s+/g;
                    let lastIndex = 0;
                    let match;
                    // eslint-disable-next-line no-cond-assign
                    while ((match = boundary.exec(rest)) !== null) {
                        const sentence = rest.slice(lastIndex, match.index + match[0].length).trim();
                        lastIndex = match.index + match[0].length;
                        if (sentence.length > 3) {
                            ttsQueue.push(sentence);
                            flushTTSQueue();
                        }
                    }
                    ttsBuffer = rest.slice(lastIndex);
                },
                onDone: async (fullText) => {
                    const saved = await addMessage(activeThread.id, 'assistant', fullText || accumulated);
                    setMessages((prev) => [
                        ...prev,
                        { ...saved, _contactId: isGroup ? contact.id : undefined },
                    ]);
                    accumulated = '';
                    setStreamingText('');

                    // Speak any remaining fragment
                    const remaining = ttsBuffer.trim();
                    ttsBuffer = '';
                    if (remaining.length > 2 && ttsSettings) {
                        ttsQueue.push(remaining);
                        flushTTSQueue();
                    }
                },
                onError: async (err) => {
                    ttsBuffer = '';
                    ttsQueue.length = 0; // discard any queued sentences
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
    }, [activeThread, threadContacts, isStreaming, settings, pendingImage]);

    /* ── Attach image from file picker ─────────────────────────────── */
    const handleAttachFile = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setPendingImage(ev.target.result);
        reader.readAsDataURL(file);
        // Reset input so same file can be reselected
        e.target.value = '';
    }, []);

    /* ── Camera capture (Live mode) ────────────────────────────────── */
    const handleCameraCapture = useCallback(async () => {
        // If we already have a pending camera image, clear it instead
        if (pendingImage) { setPendingImage(null); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            cameraStreamRef.current = stream;
            const video = document.createElement('video');
            video.srcObject = stream;
            video.playsInline = true;
            await video.play();
            // Wait one frame for the camera to warm up
            await new Promise((r) => setTimeout(r, 300));
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            // Stop the stream immediately
            stream.getTracks().forEach((t) => t.stop());
            cameraStreamRef.current = null;
            setPendingImage(dataUrl);
        } catch (err) {
            console.warn('[Camera]', err.message);
        }
    }, [pendingImage]);

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
    const isLive = settings?.activeMode === 'live';
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
                className={[
                    styles.conversationPane,
                    !activeThread ? styles.conversationPaneHidden : '',
                    isLive ? styles.liveMode : '',
                ].join(' ')}
                aria-label="Conversation"
                aria-busy={isStreaming}
            >
                {/* Back button + ⋯ menu header */}
                {activeThread && (
                    <div className={styles.convHeader}>
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
                                {threadContacts.map((c) => c.avatar).join(' ')} {threadTitle(activeThread)}
                            </span>
                        </button>

                        {/* ⋯ menu */}
                        <div className={styles.menuWrapper} ref={menuWrapperRef}>
                            <button
                                className={styles.menuBtn}
                                onClick={() => setMenuOpen((o) => !o)}
                                aria-label="Thread options"
                                aria-expanded={menuOpen}
                                id="thread-menu-btn"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                    <circle cx="5" cy="12" r="2" />
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="19" cy="12" r="2" />
                                </svg>
                            </button>
                            {menuOpen && (
                                <div className={styles.menuPopover} role="menu">
                                    <button
                                        className={styles.menuItem}
                                        role="menuitem"
                                        onClick={() => { setMenuOpen(false); setSummarizerOpen(true); }}
                                        id="menu-summarize"
                                    >
                                        📝 Summarize
                                    </button>
                                    <button
                                        className={styles.menuItem}
                                        role="menuitem"
                                        onClick={() => { setMenuOpen(false); setSeedMode('current'); }}
                                        id="menu-seed-current"
                                    >
                                        🌱 New Chat from Current
                                    </button>
                                    <button
                                        className={styles.menuItem}
                                        role="menuitem"
                                        onClick={() => { setMenuOpen(false); setSeedMode('single'); }}
                                        id="menu-seed-single"
                                    >
                                        💬 New Chat from Single Response
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
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

                {/* Spectrograph mouth visualizer */}
                {activeThread && (
                    <div className={styles.spectrographWrapper}>
                        <SpectrographMouth
                            size={settings?.activeMode === 'live' ? 'large' : 'small'}
                            active={isTTSPlaying}
                        />
                    </div>
                )}

                {/* Input area */}
                {activeThread && (
                    <>
                        {/* Image attachment preview */}
                        {pendingImage && (
                            <ImagePreview
                                src={pendingImage}
                                onClear={() => setPendingImage(null)}
                            />
                        )}

                        {/* Hidden file input for push-mode image attach */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className={styles.hiddenInput}
                            onChange={handleFileChange}
                            aria-hidden="true"
                        />

                        {/* ─── Input row: left rail + ChatInput ────────────────────── */}
                        <div className={styles.inputRow}>

                            {/* Slim vertical left rail: LIVE pill + attach icon */}
                            <div className={styles.leftRail}>

                                {/* LIVE ↔ PUSH oval */}
                                <button
                                    className={`${styles.railPill} ${isLive ? styles.railPillLive : ''}`}
                                    onClick={toggleLiveMode}
                                    type="button"
                                    aria-label={isLive ? 'Switch to Push mode' : 'Switch to Live mode'}
                                    id="live-push-toggle"
                                >
                                    {isLive ? '🔴' : '🖊'}
                                    <span>{isLive ? 'LIVE' : 'PUSH'}</span>
                                </button>

                                {/* Attach / Camera icon — only when thread supports vision */}
                                {threadHasVision && (
                                    <button
                                        className={`${styles.railIcon} ${pendingImage ? styles.railIconActive : ''}`}
                                        onClick={isLive ? handleCameraCapture : handleAttachFile}
                                        type="button"
                                        aria-label={isLive ? 'Capture camera frame' : 'Attach image'}
                                        id="attach-btn"
                                    >
                                        {isLive ? (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M23 7l-7 5 7 5V7z" />
                                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Chat input: mic (tap=toggle / hold=PTT) + textarea + send */}
                            <ChatInput
                                onSend={handleSend}
                                onTap={handleMicTap}
                                onRecordStart={isLive ? undefined : handleRecordStart}
                                onRecordStop={isLive ? undefined : handleRecordStop}
                                disabled={isStreaming}
                                placeholder={`Message ${threadTitle(activeThread)}…`}
                                isMuted={isLive ? liveMuted : false}
                            />
                        </div>
                    </>
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

            {/* ── Summarizer Sheet (Phase 10) ───────────────── */}
            <SummarizerSheet
                open={summarizerOpen}
                onClose={() => setSummarizerOpen(false)}
                messages={messages}
                contact={threadContacts[0] ?? null}
                settings={settings}
                threadId={activeThread?.id}
                onContactUpdate={() => {
                    // Re-load contacts so any notes update is reflected
                }}
            />

            {/* ── Seed Crystal Sheet (Phase 10) ─────────────── */}
            <SeedCrystalSheet
                open={seedMode !== null}
                onClose={() => setSeedMode(null)}
                mode={seedMode ?? 'current'}
                messages={messages}
                contact={threadContacts[0] ?? null}
                settings={settings}
                threadContacts={threadContacts}
                onThreadCreated={async (newThread) => {
                    setSeedMode(null);
                    await refreshThreads();
                    openThread(newThread);
                }}
            />
        </div>
    );
}
