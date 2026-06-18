import React, { useState, useEffect } from 'react';

interface CollaborativeOnboardingProps {
    onComplete: () => void;
}

const steps = [
    {
        icon: '🌐',
        title: 'Study with friends — together, in real time',
        body: "Collaborative Sessions give you a shared room where you and your classmates can study together from anywhere. No more WhatsApp chaos or scattered Google Docs.",
        highlight: 'Real-time, live, no lag.',
        color: '#6366f1',
        glow: 'rgba(99,102,241,0.3)',
    },
    {
        icon: '🔑',
        title: 'One code. Everyone in.',
        body: "Create a session and get a unique 6-digit room code. Share it with anyone — they paste it in and join your room instantly. No sign-up needed for guests.",
        highlight: 'You control who joins.',
        color: '#10b981',
        glow: 'rgba(16,185,129,0.3)',
    },
    {
        icon: '💬',
        title: 'Chat, share files, ask AI',
        body: "Send messages, share images and notes, and tag @Blay at any time to get AI-powered explanations, summaries, or answers — right inside your group chat.",
        highlight: 'AI is part of your study group.',
        color: '#f59e0b',
        glow: 'rgba(245,158,11,0.3)',
    },
    {
        icon: '📝',
        title: 'Your notes stay with you',
        body: "Anything useful from a session can be saved directly to your personal Notes. Your study history is always accessible even after the session ends.",
        highlight: 'Nothing gets lost.',
        color: '#ec4899',
        glow: 'rgba(236,72,153,0.3)',
    },
    {
        icon: '🚀',
        title: "You're ready. Let's go!",
        body: "Create your first session or join one a friend started. Your room is waiting. Good luck studying — and remember, Blay is always there to help.",
        highlight: 'Your study group is one click away.',
        color: '#38bdf8',
        glow: 'rgba(56,189,248,0.3)',
        isFinal: true,
    },
];

const CollaborativeOnboarding: React.FC<CollaborativeOnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [animating, setAnimating] = useState(false);
    const [dir, setDir] = useState<'in' | 'out'>('in');
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    const current = steps[step];
    const isLast = step === steps.length - 1;

    const goTo = (next: number) => {
        if (animating) return;
        setAnimating(true);
        setDir('out');
        setTimeout(() => {
            setStep(next);
            setDir('in');
            setAnimating(false);
        }, 220);
    };

    const handleNext = () => {
        if (isLast) {
            setVisible(false);
            setTimeout(onComplete, 300);
        } else {
            goTo(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 0) goTo(step - 1);
    };

    const handleSkip = () => {
        setVisible(false);
        setTimeout(onComplete, 300);
    };

    return (
        <>
            <style>{`
                @keyframes co-back { from { opacity:0 } to { opacity:1 } }
                @keyframes co-in-r  { from { opacity:0; transform:translateX(30px) } to { opacity:1; transform:translateX(0) } }
                @keyframes co-out-r { from { opacity:1; transform:translateX(0) }    to { opacity:0; transform:translateX(-30px) } }
                @keyframes co-modal { from { opacity:0; transform:scale(.95) translateY(16px) } to { opacity:1; transform:scale(1) translateY(0) } }
                @keyframes co-float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }
                @keyframes co-pulse { 0%,100% { box-shadow:0 0 0 0 var(--glow) } 70% { box-shadow:0 0 0 12px transparent } }
                @keyframes co-pip-pop { from{transform:scale(0)}to{transform:scale(1)} }
                .co-slide-in  { animation: co-in-r  0.22s cubic-bezier(0.16,1,0.3,1) both; }
                .co-slide-out { animation: co-out-r 0.22s ease-in both; }
            `}</style>

            {/* Backdrop */}
            <div
                onClick={handleSkip}
                style={{
                    position: 'fixed', inset: 0, zIndex: 9100,
                    background: 'rgba(4, 7, 18, 0.88)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 16,
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    animation: 'co-back 0.3s ease both',
                }}
            >
                {/* Modal card */}
                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '100%', maxWidth: 500,
                        background: '#0d1117',
                        border: `1px solid ${current.color}30`,
                        borderRadius: 24,
                        boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 60px ${current.glow}`,
                        overflow: 'hidden',
                        animation: 'co-modal 0.4s cubic-bezier(0.16,1,0.3,1) both',
                        transition: 'border-color 0.4s, box-shadow 0.4s',
                    }}
                >
                    {/* Colour accent top bar */}
                    <div style={{
                        height: 4,
                        background: `linear-gradient(90deg, ${current.color}, ${current.color}80)`,
                        transition: 'background 0.4s ease',
                    }} />

                    {/* Step progress pills */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 6, padding: '18px 24px 0',
                    }}>
                        {steps.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => goTo(i)}
                                style={{
                                    height: 5, borderRadius: 99,
                                    width: i === step ? 28 : 8,
                                    background: i === step ? current.color : i < step ? current.color + '60' : 'rgba(255,255,255,0.12)',
                                    border: 'none', cursor: 'pointer', padding: 0,
                                    transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s',
                                    animation: i === step ? 'co-pip-pop 0.3s cubic-bezier(0.16,1,0.3,1)' : 'none',
                                }}
                                aria-label={`Go to step ${i + 1}`}
                            />
                        ))}
                        <span style={{
                            marginLeft: 8, fontSize: 11, fontWeight: 700,
                            color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em',
                        }}>
                            {step + 1}/{steps.length}
                        </span>
                    </div>

                    {/* Content — slides on change */}
                    <div
                        className={dir === 'in' ? 'co-slide-in' : 'co-slide-out'}
                        key={step}
                        style={{ padding: '24px 32px 8px', textAlign: 'center' }}
                    >
                        {/* Icon */}
                        <div style={{
                            fontSize: 60, lineHeight: 1, marginBottom: 20,
                            display: 'inline-block',
                            animation: 'co-float 3s ease-in-out infinite',
                            '--glow': current.glow,
                            filter: `drop-shadow(0 0 20px ${current.glow})`,
                        } as React.CSSProperties}>
                            {current.icon}
                        </div>

                        <h3 style={{
                            margin: '0 0 12px',
                            fontSize: 21, fontWeight: 900, color: '#fff',
                            lineHeight: 1.25,
                        }}>
                            {current.title}
                        </h3>

                        <p style={{
                            margin: '0 0 16px',
                            fontSize: 14, color: 'rgba(255,255,255,0.55)',
                            lineHeight: 1.7,
                        }}>
                            {current.body}
                        </p>

                        {/* Highlight chip */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: current.color + '18',
                            border: `1px solid ${current.color}40`,
                            borderRadius: 100, padding: '5px 14px',
                            marginBottom: 8,
                        }}>
                            <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: current.color,
                                animation: 'co-pulse 1.8s infinite',
                                '--glow': current.glow,
                            } as React.CSSProperties} />
                            <span style={{ fontSize: 12, fontWeight: 800, color: current.color }}>
                                {current.highlight}
                            </span>
                        </div>
                    </div>

                    {/* Interactive visual for each step */}
                    <div style={{ padding: '12px 32px 8px' }}>
                        <StepVisual step={step} color={current.color} />
                    </div>

                    {/* Navigation */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px 28px 24px', gap: 12,
                    }}>
                        {/* Back / Skip */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            {step > 0 ? (
                                <button
                                    onClick={handleBack}
                                    style={{
                                        padding: '9px 18px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 12, color: 'rgba(255,255,255,0.5)',
                                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                        transition: 'background 0.2s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                >
                                    ← Back
                                </button>
                            ) : (
                                <button
                                    onClick={handleSkip}
                                    style={{
                                        padding: '9px 18px',
                                        background: 'transparent', border: 'none',
                                        color: 'rgba(255,255,255,0.25)',
                                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                    }}
                                >
                                    Skip
                                </button>
                            )}
                        </div>

                        {/* Next / Got it */}
                        <button
                            onClick={handleNext}
                            style={{
                                padding: '11px 28px',
                                background: current.color,
                                color: '#000',
                                border: 'none', borderRadius: 14,
                                fontSize: 14, fontWeight: 900,
                                cursor: 'pointer',
                                boxShadow: `0 6px 24px ${current.glow}`,
                                transition: 'transform 0.15s, box-shadow 0.15s',
                                letterSpacing: '0.02em',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)';
                                (e.currentTarget as HTMLElement).style.boxShadow = `0 10px 30px ${current.glow}`;
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                                (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${current.glow}`;
                            }}
                        >
                            {isLast ? "✓ Got it, let's study!" : 'Next →'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// ── Per-step interactive visual widgets ──────────────────────────────
const StepVisual: React.FC<{ step: number; color: string }> = ({ step, color }) => {
    const [code] = useState('EBL-' + Math.floor(100 + Math.random() * 900));
    const [copied, setCopied] = useState(false);
    const [typed, setTyped] = useState('');
    const [aiMsg, setAiMsg] = useState('');
    const fullAi = 'Sure! The mitochondria is known as the powerhouse of the cell because it produces ATP through cellular respiration 🔋';

    useEffect(() => {
        setTyped(''); setAiMsg('');
        if (step === 1) {
            let i = 0;
            const iv = setInterval(() => {
                setTyped(code.slice(0, i + 1));
                i++;
                if (i >= code.length) clearInterval(iv);
            }, 80);
            return () => clearInterval(iv);
        }
        if (step === 2) {
            let i = 0;
            const delay = setTimeout(() => {
                const iv = setInterval(() => {
                    setAiMsg(fullAi.slice(0, i + 1));
                    i++;
                    if (i >= fullAi.length) clearInterval(iv);
                }, 22);
                return () => clearInterval(iv);
            }, 600);
            return () => clearTimeout(delay);
        }
    }, [step]);

    const base: React.CSSProperties = {
        borderRadius: 12, overflow: 'hidden',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 16px',
    };

    if (step === 0) return (
        <div style={base}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                {[
                    { name: 'You', msg: 'Hey, anyone understand photosynthesis?', color: color, align: 'flex-end' },
                    { name: 'Ama', msg: 'Yes! Let me share my notes 📎', color: '#a78bfa', align: 'flex-start' },
                    { name: 'You', msg: 'Thanks! Sharing mine too ✅', color: color, align: 'flex-end' },
                ].map((m, i) => (
                    <div key={i} style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: m.align as any,
                        animation: `co-in-r 0.4s ${i * 0.12}s both`,
                    }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 3, fontWeight: 700 }}>{m.name}</div>
                        <div style={{
                            background: m.color + '20', border: `1px solid ${m.color}30`,
                            borderRadius: 10, padding: '6px 10px', maxWidth: 160,
                            fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4,
                        }}>{m.msg}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    if (step === 1) return (
        <div style={base}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your room code</div>
                    <div style={{
                        fontSize: 26, fontWeight: 900, letterSpacing: '0.12em',
                        color: color, fontFamily: 'monospace',
                    }}>
                        {typed}<span style={{ opacity: 0.4 }}>|</span>
                    </div>
                </div>
                <button
                    onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    style={{
                        padding: '8px 16px',
                        background: copied ? '#10b981' : color,
                        color: '#000', border: 'none', borderRadius: 10,
                        fontSize: 12, fontWeight: 900, cursor: 'pointer',
                        transition: 'background 0.3s',
                    }}
                >
                    {copied ? '✓ Copied!' : 'Copy'}
                </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                Share this code with your study partners →
            </div>
        </div>
    );

    if (step === 2) return (
        <div style={base}>
            <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                <div style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: '5px 10px', fontSize: 11, color: 'rgba(255,255,255,0.5)',
                }}>Kwame: @Blay explain mitochondria</div>
            </div>
            <div style={{
                background: color + '12', border: `1px solid ${color}25`,
                borderRadius: 10, padding: '8px 12px',
                fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5,
                minHeight: 44,
            }}>
                <span style={{ fontWeight: 900, color: color }}>@Blay  </span>{aiMsg}
                {aiMsg.length < fullAi.length && <span style={{ opacity: 0.4 }}>|</span>}
            </div>
        </div>
    );

    if (step === 3) return (
        <div style={base}>
            <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', gap: 10 } as any}>
                <div style={{ flex: 1 }}>
                    {['Chapter 4 summary — Bio 201', 'Kwame\'s formula sheet', 'Exam prep Q&A'].map((n, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            animation: `co-in-r 0.3s ${i * 0.1}s both`,
                        }}>
                            <span style={{ fontSize: 14 }}>📄</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', flex: 1 }}>{n}</span>
                            <span style={{
                                fontSize: 10, fontWeight: 800, color: color,
                                background: color + '15', borderRadius: 6, padding: '2px 7px',
                            }}>Saved</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // Step 4 — final
    return (
        <div style={{
            ...base,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '20px 16px', gap: 12,
        }}>
            <div style={{ display: 'flex', gap: 10 }}>
                {['Create session', 'Join session'].map((label, i) => (
                    <div key={i} style={{
                        flex: 1, padding: '10px 14px',
                        background: i === 0 ? color + '20' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${i === 0 ? color + '40' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 12, textAlign: 'center',
                        fontSize: 12, fontWeight: 800,
                        color: i === 0 ? color : 'rgba(255,255,255,0.5)',
                        animation: `co-in-r 0.4s ${i * 0.1}s both`,
                    }}>{label}</div>
                ))}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                These options await you right after ✓
            </div>
        </div>
    );
};

export default CollaborativeOnboarding;