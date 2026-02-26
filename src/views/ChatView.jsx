import { useState, useEffect, useRef, useCallback } from 'react';
import useAppStore from '../state/useAppStore';
import { getOrCreateThread } from '../db/threadsDb';
import { getMessages, addMessage, updateMessageContent } from '../db/messagesDb';
import { streamChat } from '../llm/llmClient';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import styles from './ChatView.module.css';

/**
 * ChatView — Phase 3.
 *
 * Two-panel layout:
 *   Left  — Contact list (acts as thread picker)
 *   Right — Conversation pane with streaming message bubbles
 */
export default function ChatView() {
    const contacts = useAppStore((s) => s.contacts);
    const settings = useAppStore((s) => s.settings);
    const isStreaming = useAppStore((s) => s.isStreaming);
    const setStreaming = useAppStore((s) => s.setStreaming);

    const [activeContactId, setActiveContactId] = useState(null);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [messages, setMessages] = useState([]);   // local display list
    const [streamingText, setStreamingText] = useState('');   // in-progress assistant text

    const messagesEndRef = useRef(null);

    const activeContact = contacts.find((c) => c.id === activeContactId) ?? null;

    /* ── Auto-scroll to bottom ────────────────────────────────────── */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText]);

    /* ── Load messages when thread changes ────────────────────────── */
    useEffect(() => {
        if (!activeThreadId) {
            setMessages([]);
            return;
        }
        (async () => {
            const msgs = await getMessages(activeThreadId);
            setMessages(msgs);
        })();
    }, [activeThreadId]);

    /* ── Pick a contact / open thread ────────────────────────────── */
    const handlePickContact = useCallback(async (contact) => {
        if (isStreaming) return;
        setActiveContactId(contact.id);
        const thread = await getOrCreateThread(contact.id);
        setActiveThreadId(thread.id);
        setStreamingText('');
    }, [isStreaming]);

    /* ── Send a message ───────────────────────────────────────────── */
    const handleSend = useCallback(async (text) => {
        if (!activeContact || !activeThreadId || isStreaming) return;

        // 1. Persist + display user message
        const userMsg = await addMessage(activeThreadId, 'user', text);
        setMessages((prev) => [...prev, userMsg]);

        // 2. Build context window (last N messages, system instruction prepended inside llmClient)
        const contextLimit = settings?.contextWindowSize ?? 20;
        const history = await getMessages(activeThreadId, contextLimit);
        const llmMessages = history.map(({ role, content }) => ({ role, content }));

        // 3. Start streaming
        setStreaming(true);
        setStreamingText('');

        let accumulated = '';

        await streamChat({
            contact: activeContact,
            settings,
            messages: llmMessages,
            onToken: (chunk) => {
                accumulated += chunk;
                setStreamingText(accumulated);
            },
            onDone: async (fullText) => {
                // Persist the completed reply
                const assistantMsg = await addMessage(activeThreadId, 'assistant', fullText || accumulated);
                setMessages((prev) => [...prev, assistantMsg]);
                setStreamingText('');
                setStreaming(false);
            },
            onError: async (err) => {
                const errMsg = await addMessage(activeThreadId, 'assistant', `⚠️ ${err.message}`);
                setMessages((prev) => [...prev, errMsg]);
                setStreamingText('');
                setStreaming(false);
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeContact, activeThreadId, isStreaming, settings]);

    /* ── Render ───────────────────────────────────────────────────── */
    return (
        <div className={styles.chatLayout}>
            {/* ── Contact / Thread list ───────────────────────── */}
            <aside
                className={`${styles.contactList} ${activeContactId ? styles.contactListHidden : ''}`}
                aria-label="Contacts"
            >
                {contacts.length === 0 ? (
                    <div className={styles.emptyContacts}>
                        <span className={styles.emptyIcon} aria-hidden="true">💬</span>
                        <p className={styles.emptyTitle}>No contacts yet</p>
                        <p className={styles.emptySubtext}>
                            Go to Contacts to add an AI persona.
                        </p>
                    </div>
                ) : (
                    <ul className={styles.contactItems} role="list">
                        {contacts.map((c) => (
                            <li key={c.id}>
                                <button
                                    className={`${styles.contactItem} ${c.id === activeContactId ? styles.contactItemActive : ''}`}
                                    onClick={() => handlePickContact(c)}
                                    id={`contact-btn-${c.id}`}
                                    aria-pressed={c.id === activeContactId}
                                >
                                    <span className={styles.contactAvatar}>{c.avatar || '🤖'}</span>
                                    <div className={styles.contactMeta}>
                                        <span className={styles.contactName}>{c.name}</span>
                                        <span className={styles.contactEndpoint}>
                                            {c.llmConfig?.endpointType ?? 'local'}
                                        </span>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </aside>

            {/* ── Conversation pane ───────────────────────────── */}
            <section
                className={`${styles.conversationPane} ${!activeContactId ? styles.conversationPaneHidden : ''}`}
                aria-label="Conversation"
            >
                {/* Back button (mobile) */}
                {activeContactId && (
                    <button
                        className={styles.backBtn}
                        onClick={() => { setActiveContactId(null); setStreamingText(''); }}
                        aria-label="Back to contacts"
                        id="chat-back-button"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        <span>{activeContact?.name}</span>
                    </button>
                )}

                {/* Messages */}
                <div className={styles.messages} role="list" aria-live="polite">
                    {messages.length === 0 && !isStreaming && (
                        <div className={styles.conversationEmpty}>
                            <span className={styles.bigAvatar}>{activeContact?.avatar ?? '🤖'}</span>
                            <p className={styles.emptyTitle}>{activeContact?.name}</p>
                            <p className={styles.emptySubtext}>Say something to start the conversation.</p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            role={msg.role}
                            content={msg.content}
                            avatar={activeContact?.avatar}
                        />
                    ))}

                    {/* Live streaming bubble */}
                    {isStreaming && (
                        <MessageBubble
                            role="assistant"
                            content={streamingText}
                            isStreaming
                            avatar={activeContact?.avatar}
                        />
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {activeContactId && (
                    <ChatInput
                        onSend={handleSend}
                        disabled={isStreaming}
                        placeholder={`Message ${activeContact?.name ?? 'AI'}…`}
                    />
                )}
            </section>
        </div>
    );
}
