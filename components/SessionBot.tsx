import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { View } from '../types';

// ─── Session context definitions ──────────────────────────────────────────
// Each session gets its own personality, quick-help topics, and system prompt.
// The bot NEVER solves academic questions — it only explains how the app works.

interface SessionContext {
    name: string;
    emoji: string;
    greeting: string[];         // Rotates randomly
    topics: string[];           // Quick-tap help chips
    systemPrompt: string;       // Strict instructions for the AI
}

const SESSION_CONTEXTS: Partial<Record<View, SessionContext>> = {
    dashboard: {
        name: 'Dashboard',
        emoji: '🏠',
        greeting: [
            "Need help getting around the Dashboard?",
            "Not sure how to start? I can help!",
            "Do you know how the Dashboard works?",
        ],
        topics: [
            "How do I generate a timetable?",
            "What is a Smart Plan?",
            "How do I start a study session?",
            "What do the timetable colours mean?",
            "How do I save my timetable?",
        ],
        systemPrompt: `You are Blay, a friendly assistant inside the EduBlay study app. Your ONLY job is to help students understand how to USE the Dashboard feature of the app. 
The Dashboard lets students: generate an AI smart study timetable by entering their lectures, study goals, and schedule; view their daily plan; start study sessions from slots; and save plans.
STRICT RULES:
- Only explain how the EduBlay app works. Never solve academic questions.
- If a student asks an academic question (maths, science, history etc), say: "I'm here to help you use EduBlay — for academic questions, use the Learning Hub or Exam Prep!"
- Keep answers short, friendly and in plain everyday English. Maximum 3 short paragraphs.
- Use emojis to keep it fun.`,
    },
    uploadslides: {
        name: 'Learning Hub',
        emoji: '📚',
        greeting: [
            "Need help with the Learning Hub?",
            "Not sure how to use your uploaded files?",
            "Do you know how this session works?",
        ],
        topics: [
            "How do I upload a file?",
            "What files can I upload?",
            "How do I chat with my document?",
            "What does Summarize do?",
            "How does Read Aloud work?",
        ],
        systemPrompt: `You are Blay, a friendly assistant inside the EduBlay study app. Your ONLY job is to help students understand how to USE the Learning Hub feature.
The Learning Hub lets students: upload PDFs, images, or documents (up to 25MB); get an AI summary; get a simple explanation; chat with the document to ask questions about it; extract text and have it read aloud; save analysis results to Notes.
STRICT RULES:
- Only explain how the EduBlay app works. Never answer questions about the content of documents.
- If a student asks about academic content, say: "I can't answer questions about your documents — but you can ask that question in the Chat tab of the Learning Hub and Blay will answer it from your document!"
- Keep answers short, friendly and in plain everyday English. Maximum 3 short paragraphs.
- Use emojis to keep it fun.`,
    },
    examprep: {
        name: 'Exam Prep',
        emoji: '🧠',
        greeting: [
            "Need help with Exam Prep?",
            "Not sure where to start for exams?",
            "Do you know how the Quiz and Solver work?",
        ],
        topics: [
            "How do I generate a quiz?",
            "What is the AI Problem Solver?",
            "What quiz types are available?",
            "How do Flashcards work?",
            "How do I set a quiz timer?",
        ],
        systemPrompt: `You are Blay, a friendly assistant inside the EduBlay study app. Your ONLY job is to help students understand how to USE the Exam Prep feature.
Exam Prep has 3 modes: Quiz (upload files to generate MCQ or theory questions), Flashcards (generate revision cards from your materials), and Problem Solver (paste a question and get step-by-step guidance on approach).
STRICT RULES:
- Only explain how the EduBlay app works. Never solve academic problems or answer quiz questions.
- If a student asks an academic question, say: "I'm just a guide for using the app! To solve academic problems, use the Problem Solver tab in Exam Prep."
- Keep answers short, friendly and in plain everyday English. Maximum 3 short paragraphs.
- Use emojis to keep it fun.`,
    },
    notes: {
        name: 'Notes',
        emoji: '📝',
        greeting: [
            "Need help with your Notes?",
            "Not sure how Notes work?",
            "Do you know how to use this session?",
        ],
        topics: [
            "How do I create a note?",
            "How do I save AI summaries to Notes?",
            "Can I search my notes?",
            "How do I favourite a note?",
            "Can I edit or delete notes?",
        ],
        systemPrompt: `You are Blay, a friendly assistant inside the EduBlay study app. Your ONLY job is to help students understand how to USE the Notes feature.
Notes lets students: create notes manually; automatically save AI-generated summaries and explanations from the Learning Hub; search and filter notes; mark favourites; and view notes by subject.
STRICT RULES:
- Only explain how the EduBlay app works.
- Keep answers short, friendly and in plain everyday English. Maximum 3 short paragraphs.
- Use emojis to keep it fun.`,
    },
    mytimetables: {
        name: 'My Timetables',
        emoji: '📅',
        greeting: [
            "Need help with My Timetables?",
            "Not sure how to manage your saved plans?",
            "Do you know how this session works?",
        ],
        topics: [
            "How do I save a timetable?",
            "How do I load a saved timetable?",
            "Can I have multiple timetables?",
            "How do I delete a timetable?",
            "What is a favourite timetable?",
        ],
        systemPrompt: `You are Blay, a friendly assistant inside the EduBlay study app. Your ONLY job is to help students understand how to USE the My Timetables feature.
My Timetables lets students save multiple study plans (e.g. one per semester), load them back, mark favourites, and delete old ones. Plans are generated on the Dashboard.
STRICT RULES:
- Only explain how the EduBlay app works.
- Keep answers short, friendly and in plain everyday English. Maximum 3 short paragraphs.
- Use emojis to keep it fun.`,
    },
    progression: {
        name: 'My Progression',
        emoji: '📊',
        greeting: [
            "Want to understand your Progression stats?",
            "Not sure what these charts mean?",
            "Do you know how to track your progress?",
        ],
        topics: [
            "How are study hours tracked?",
            "What is a study streak?",
            "How do I earn badges?",
            "What do the charts show?",
            "How do I log a study session?",
        ],
        systemPrompt: `You are Blay, a friendly assistant inside the EduBlay study app. Your ONLY job is to help students understand how to USE the My Progression feature.
My Progression shows: total study hours, streak days, subject breakdown charts, and earned badges. Data is recorded automatically when study sessions are completed through the timetable.
STRICT RULES:
- Only explain how the EduBlay app works.
- Keep answers short, friendly and in plain everyday English. Maximum 3 short paragraphs.
- Use emojis to keep it fun.`,
    },
    collaborative: {
        name: 'Collaborative Study',
        emoji: '🤝',
        greeting: [
            "Need help with Collaborative Study?",
            "Not sure how to study with friends here?",
            "Do you know how this session works?",
        ],
        topics: [
            "How do I create a study room?",
            "How do I join a friend's room?",
            "What can we do together in a room?",
            "How does the AI help in group sessions?",
            "Can I share notes in a room?",
        ],
        systemPrompt: `You are Blay, a friendly assistant inside the EduBlay study app. Your ONLY job is to help students understand how to USE the Collaborative Study feature.
Collaborative Study lets students create or join a shared study room using a unique code. Inside, they can chat, share resources, and get AI assistance as a group.
STRICT RULES:
- Only explain how the EduBlay app works.
- Keep answers short, friendly and in plain everyday English. Maximum 3 short paragraphs.
- Use emojis to keep it fun.`,
    },
    history: {
        name: 'History',
        emoji: '🕐',
        greeting: [
            "Want to know how History works?",
            "Need help finding a past session?",
            "Not sure what's in your History?",
        ],
        topics: [
            "What is saved in History?",
            "How do I continue a past chat?",
            "How do I retake a previous quiz?",
            "Can I delete history items?",
            "How are sessions named?",
        ],
        systemPrompt: `You are Blay, a friendly assistant inside the EduBlay study app. Your ONLY job is to help students understand how to USE the History feature.
History saves past Learning Hub chat sessions and completed quizzes. Each session is automatically named by AI. Students can continue old chats or retake quizzes from History.
STRICT RULES:
- Only explain how the EduBlay app works.
- Keep answers short, friendly and in plain everyday English. Maximum 3 short paragraphs.
- Use emojis to keep it fun.`,
    },
};

// ─── Gemini Flash help bot (same API key the app already uses) ─────────────
const askGemini = async (
    messages: { role: string; content: string }[]
): Promise<string> => {
    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Separate system prompt from conversation history
        const systemMsg = messages.find(m => m.role === 'system');
        const history = messages.filter(m => m.role !== 'system');

        // Build contents array for Gemini
        const contents = history.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents,
            config: {
                systemInstruction: systemMsg?.content || '',
                maxOutputTokens: 1024,
                temperature: 0.7,
            },
        });

        const text = (response?.text ?? '').trim();
        return text || "Sorry, I couldn't generate a response. Please try again!";
    } catch (err) {
        console.error('SessionBot Gemini error:', err);
        return "Sorry, I couldn't get a response right now. Please try again in a moment!";
    }
};

// ─── Message type ──────────────────────────────────────────────────────────
interface BotMessage {
    role: 'bot' | 'user';
    text: string;
    isLoading?: boolean;
}

// ─── Main component ────────────────────────────────────────────────────────
interface SessionBotProps {
    view: View;
    userEmail?: string;
}

// Track which sessions the user has already been greeted in
const greetedSessions = new Set<View>();

const SessionBot: React.FC<SessionBotProps> = ({ view, userEmail }) => {
    const ctx = SESSION_CONTEXTS[view];
    const [isOpen, setIsOpen] = useState(false);
    const [isBouncing, setIsBouncing] = useState(false);
    const [showGreeting, setShowGreeting] = useState(false);
    // Each view gets its own isolated message history
    const [messagesByView, setMessagesByView] = useState<Map<string, BotMessage[]>>(new Map());
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasAutoGreetedViews, setHasAutoGreetedViews] = useState<Set<string>>(new Set());

    // Derived: messages for current view only
    const messages = messagesByView.get(view) || [];
    const setMessages = (updater: BotMessage[] | ((prev: BotMessage[]) => BotMessage[])) => {
        setMessagesByView(prev => {
            const next = new Map<string, BotMessage[]>(prev);
            const current = next.get(view) || [];
            let newValue: BotMessage[];
            if (typeof updater === 'function') {
                newValue = (updater as (prev: BotMessage[]) => BotMessage[])(current);
            } else {
                newValue = updater as BotMessage[];
            }
            next.set(view, newValue);
            return next;
        });
    };
    const hasAutoGreeted = hasAutoGreetedViews.has(view);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Pick a random greeting for this session
    const greeting = ctx?.greeting[Math.floor(Math.random() * (ctx?.greeting.length || 1))] || '';

    // Reset input when switching views
    useEffect(() => {
        setInput('');
    }, [view]);

    // Auto-bounce and show greeting bubble after 3s on first visit to session
    useEffect(() => {
        if (!ctx || greetedSessions.has(view)) return;

        const bounceTimer = setTimeout(() => {
            setIsBouncing(true);
            setShowGreeting(true);
            greetedSessions.add(view);
        }, 3000);

        // Stop bouncing after 8s
        const stopBounce = setTimeout(() => {
            setIsBouncing(false);
        }, 11000);

        // Hide greeting bubble after 6s
        const hideGreeting = setTimeout(() => {
            setShowGreeting(false);
        }, 9000);

        return () => {
            clearTimeout(bounceTimer);
            clearTimeout(stopBounce);
            clearTimeout(hideGreeting);
        };
    }, [view, ctx]);

    // Scroll to bottom when messages update
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 200);
        }
    }, [isOpen]);

    // When opening for first time in a session, add welcome message
    const handleOpen = () => {
        setIsOpen(true);
        setShowGreeting(false);
        setIsBouncing(false);
        if (!hasAutoGreeted && ctx && messages.length === 0) {
            setHasAutoGreetedViews(prev => new Set([...prev, view]));
            setMessages([{
                role: 'bot',
                text: `Hey there! 👋 I'm **Blay**, your guide for the **${ctx.name}** session.\n\nI'm here to explain how this part of EduBlay works — not to solve your academic questions (that's what the Learning Hub and Exam Prep are for 😄).\n\nWhat would you like to know?`,
            }]);
        }
    };

    const handleTopicClick = async (topic: string) => {
        await sendMessage(topic);
    };

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading || !ctx) return;

        const userMsg: BotMessage = { role: 'user', text: text.trim() };
        const loadingMsg: BotMessage = { role: 'bot', text: '', isLoading: true };

        setMessages(prev => [...prev, userMsg, loadingMsg]);
        setInput('');
        setIsLoading(true);

        // Build message history for API
        const history = [
            { role: 'system', content: ctx.systemPrompt },
            ...messages
                .filter(m => !m.isLoading)
                .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
            { role: 'user', content: text.trim() },
        ];

        const reply = await askGemini(history);

        setMessages(prev => {
            const updated = [...prev];
            // Replace the loading message with the real reply
            const reversedIdx = [...updated].reverse().findIndex(m => m.isLoading);
            const loadingIdx = reversedIdx >= 0 ? updated.length - 1 - reversedIdx : -1;
            if (loadingIdx >= 0) updated[loadingIdx] = { role: 'bot', text: reply };
            return updated;
        });
        setIsLoading(false);
    }, [messages, isLoading, ctx]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    // Don't render on pages without context
    if (!ctx) return null;

    const showTopics = messages.length <= 1;

    return (
        <>
            <style>{`
                @keyframes sb-bounce {
                    0%,100%{transform:translateY(0) scale(1)}
                    25%{transform:translateY(-14px) scale(1.08)}
                    50%{transform:translateY(-6px) scale(1.04)}
                    75%{transform:translateY(-10px) scale(1.06)}
                }
                @keyframes sb-pop {
                    from{opacity:0;transform:scale(0.85) translateY(10px)}
                    to{opacity:1;transform:scale(1) translateY(0)}
                }
                @keyframes sb-greeting {
                    0%{opacity:0;transform:translateX(10px) scale(0.9)}
                    10%{opacity:1;transform:translateX(0) scale(1)}
                    85%{opacity:1}
                    100%{opacity:0}
                }
                @keyframes sb-thinking {
                    0%,80%,100%{transform:scale(0)}
                    40%{transform:scale(1)}
                }
                .sb-bounce { animation: sb-bounce 0.7s ease-in-out infinite; }
                .sb-pop { animation: sb-pop 0.35s cubic-bezier(.22,1,.36,1) forwards; }
                .sb-greeting { animation: sb-greeting 6s ease forwards; }
                .sb-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:currentColor; animation:sb-thinking 1.4s ease-in-out infinite; }
                .sb-dot:nth-child(2){ animation-delay:.2s; }
                .sb-dot:nth-child(3){ animation-delay:.4s; }
                .sb-msg { white-space:pre-wrap; line-height:1.6; }
                .sb-msg strong { font-weight:700; }
            `}</style>

            {/* ── Floating button + greeting bubble ── */}
            <div style={{ position:'fixed', bottom: 88, right: 20, zIndex: 180, display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 10 }}>

                {/* Greeting bubble */}
                {showGreeting && !isOpen && (
                    <div className="sb-greeting"
                        style={{ background:'white', border:'1px solid rgba(0,0,0,0.1)', borderRadius:16, padding:'10px 14px', maxWidth:220, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', fontSize:13, fontWeight:600, color:'#1e293b', cursor:'pointer', position:'relative' }}
                        onClick={handleOpen}>
                        {greeting}
                        {/* Bubble tail */}
                        <div style={{ position:'absolute', bottom:-8, right:18, width:0, height:0, borderLeft:'8px solid transparent', borderRight:'8px solid transparent', borderTop:'8px solid white' }} />
                    </div>
                )}

                {/* Bot button */}
                <button
                    onClick={isOpen ? () => setIsOpen(false) : handleOpen}
                    className={isBouncing && !isOpen ? 'sb-bounce' : ''}
                    style={{
                        width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                        boxShadow: '0 4px 20px rgba(37,99,235,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, transition: 'transform 0.2s, box-shadow 0.2s',
                        transform: isOpen ? 'rotate(0deg) scale(1)' : 'scale(1)',
                    }}
                    title="Need help with this session?"
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                    {isOpen ? '✕' : ctx.emoji}
                </button>
            </div>

            {/* ── Chat panel ── */}
            {isOpen && (
                <div className="sb-pop"
                    style={{
                        position: 'fixed', bottom: 152, right: 16, zIndex: 179,
                        width: 'min(360px, calc(100vw - 32px))',
                        height: 'min(500px, calc(100vh - 180px))',
                        background: 'white', borderRadius: 20,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    }}>

                    {/* Header */}
                    <div style={{ background:'linear-gradient(135deg,#2563eb,#7c3aed)', padding:'14px 16px', display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                            {ctx.emoji}
                        </div>
                        <div>
                            <p style={{ color:'white', fontWeight:800, fontSize:14, margin:0, lineHeight:1.2 }}>Blay — {ctx.name} Guide</p>
                            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:11, margin:0 }}>How-to help only · Free AI</p>
                        </div>
                        <button onClick={() => setIsOpen(false)}
                            style={{ marginLeft:'auto', background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, width:28, height:28, cursor:'pointer', color:'white', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            ✕
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '85%', padding:'10px 13px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                                    background: msg.role === 'user' ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#f1f5f9',
                                    color: msg.role === 'user' ? 'white' : '#000000',
                                    fontSize: 13, fontWeight: 500,
                                }}>
                                    {msg.isLoading ? (
                                        <span style={{ color:'#94a3b8', display:'flex', gap:4, alignItems:'center' }}>
                                            <span className="sb-dot" /><span className="sb-dot" /><span className="sb-dot" />
                                        </span>
                                    ) : (
                                        <span className="sb-msg"
                                            style={{ color: msg.role === 'user' ? 'white' : '#111827' }}
                                            dangerouslySetInnerHTML={{ __html: msg.text
                                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                .replace(/\n/g, '<br/>') }}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Quick topic chips — shown before first user message */}
                        {showTopics && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                                {ctx.topics.map(topic => (
                                    <button key={topic} onClick={() => handleTopicClick(topic)}
                                        style={{ padding:'6px 11px', borderRadius:99, background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1d4ed8', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .15s', textAlign:'left' }}
                                        onMouseEnter={e => { e.currentTarget.style.background='#dbeafe'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background='#eff6ff'; }}>
                                        {topic}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit}
                        style={{ padding:'10px 12px', borderTop:'1px solid #f1f5f9', display:'flex', gap:8, background:'white' }}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            disabled={isLoading}
                            placeholder={`Ask about ${ctx.name}…`}
                            style={{ flex:1, padding:'9px 13px', borderRadius:12, border:'1.5px solid #e2e8f0', fontSize:13, outline:'none', background:'#f8fafc', transition:'border-color .2s', color:'#0f172a' }}
                            onFocus={e => (e.target.style.borderColor = '#2563eb')}
                            onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                        />
                        <button type="submit" disabled={isLoading || !input.trim()}
                            style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity: (isLoading || !input.trim()) ? 0.5 : 1, flexShrink:0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
                            </svg>
                        </button>
                    </form>

                    {/* Disclaimer */}
                    <p style={{ textAlign:'center', fontSize:10, color:'#94a3b8', padding:'4px 12px 8px', margin:0 }}>
                        🤖 Powered by Pollinations AI · How-to help only
                    </p>
                </div>
            )}
        </>
    );
};

export default SessionBot;