import React, { useState, useEffect } from 'react';

interface UpgradeAnnouncementModalProps {
    onClose: () => void;
    onGoToCollaborative: () => void;
    onGoToExamPrep: () => void;
}

const UpgradeAnnouncementModal: React.FC<UpgradeAnnouncementModalProps> = ({
    onClose,
    onGoToCollaborative,
    onGoToExamPrep,
}) => {
    const [visible, setVisible] = useState(false);
    const [activeCard, setActiveCard] = useState<number | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 60);
        return () => clearTimeout(t);
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 350);
    };

    const features = [
        {
            emoji: '🤝',
            badge: 'NEW',
            badgeColor: '#10b981',
            title: 'Collaborative Sessions',
            tagline: 'Study together, anywhere',
            description:
                'Create a smart study room. Invite classmates with a unique code, collaborate in real time, share notes - and get AI support for your group work. Distance is no longer an excuse.',
            cta: 'Try it now →',
            gradient: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
            accent: '#34d399',
            onCta: () => { handleClose(); onGoToCollaborative(); },
        },
        {
            emoji: '🃏',
            badge: 'UPGRADED',
            badgeColor: '#f59e0b',
            title: 'Flashcards',
            tagline: 'Smart revision, zero effort',
            description:
                'Upload your notes, PDFs or slides and EduBlay generates a full deck of Flashcards instantly. Flip, quiz yourself, track what you know - and never cram the night before again.',
            cta: 'Make flashcards →',
            gradient: 'linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #11998e 100%)',
            accent: '#fbbf24',
            onCta: () => { handleClose(); onGoToExamPrep(); },
        },
    ];

    return (
        <>
            <style>{`
                @keyframes ua-backdrop { from { opacity:0 } to { opacity:1 } }
                @keyframes ua-slide    { from { opacity:0; transform:translateY(32px) scale(.97) } to { opacity:1; transform:translateY(0) scale(1) } }
                @keyframes ua-badge    { 0%,100% { transform:scale(1) } 50% { transform:scale(1.12) } }
                @keyframes ua-shimmer  { from { background-position:-200% center } to { background-position:200% center } }
                @keyframes ua-float    { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-6px) } }
                @keyframes ua-card-in  { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
                .ua-shimmer-text {
                    background: linear-gradient(90deg, #a78bfa, #38bdf8, #34d399, #fbbf24, #a78bfa);
                    background-size: 250% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: ua-shimmer 3s linear infinite;
                }
            `}</style>

            {/* Backdrop */}
            <div
                onClick={handleClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 9000,
                    background: 'rgba(5, 7, 20, 0.85)',
                    backdropFilter: 'blur(8px)',
                    animation: 'ua-backdrop 0.3s ease both',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px',
                }}
            >
                {/* Modal */}
                <div
                    onClick={e => e.stopPropagation()}
                    className="flex flex-col"
                    style={{
                        width: '100%', maxWidth: 680,
                        maxHeight: '90vh',
                        background: '#0b0f1e',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 24,
                        boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
                        overflow: 'hidden',
                        animation: visible ? 'ua-slide 0.4s cubic-bezier(0.16,1,0.3,1) both' : 'none',
                    }}
                >
                    {/* Header strip */}
                    <div className="p-4 sm:p-7 pb-3 sm:pb-5 text-center relative shrink-0 border-b border-white/5">
                        {/* Glow orb */}
                        <div style={{
                            position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
                            width: 200, height: 200, borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
                            pointerEvents: 'none',
                        }} />

                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: 100, padding: '4px 14px', marginBottom: 14,
                        }}>
                            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.15em', color: '#818cf8', textTransform: 'uppercase' }}>
                                ✦ EduBlay Upgraded
                            </span>
                        </div>

                        <h2 className="text-xl sm:text-2xl font-black leading-tight text-white m-0">
                            Something{' '}
                            <span className="ua-shimmer-text">new</span>
                            {' '}just landed 🚀
                        </h2>
                        <p className="mt-2 text-xs sm:text-sm text-white/45 leading-relaxed m-0">
                            We've been building. Here's what's fresh and ready for you.
                        </p>
                    </div>

                    {/* Feature cards */}
                    <div className="p-3 sm:p-6 flex flex-col gap-3 sm:gap-4 overflow-y-auto flex-1 min-h-0">
                        {features.map((f, i) => (
                            <div
                                key={f.title}
                                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 p-3 sm:p-5 rounded-2xl"
                                onMouseEnter={() => setActiveCard(i)}
                                onMouseLeave={() => setActiveCard(null)}
                                style={{
                                    background: f.gradient,
                                    border: `1px solid ${activeCard === i ? f.accent + '50' : 'rgba(255,255,255,0.07)'}`,
                                    transition: 'border-color 0.25s, transform 0.2s, box-shadow 0.25s',
                                    transform: activeCard === i ? 'translateY(-2px)' : 'none',
                                    boxShadow: activeCard === i ? `0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px ${f.accent}30` : '0 4px 16px rgba(0,0,0,0.3)',
                                    cursor: 'default',
                                    animation: `ua-card-in 0.5s ${0.15 + i * 0.1}s cubic-bezier(0.16,1,0.3,1) both`,
                                }}
                            >
                                {/* Emoji */}
                                <div className="text-3xl sm:text-4xl shrink-0 leading-none" style={{
                                    animation: activeCard === i ? 'ua-float 2s ease-in-out infinite' : 'none',
                                }}>
                                    {f.emoji}
                                </div>

                                {/* Text */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span style={{
                                            fontSize: 10, fontWeight: 900, letterSpacing: '0.12em',
                                            color: f.badgeColor, textTransform: 'uppercase',
                                            background: f.badgeColor + '20',
                                            border: `1px solid ${f.badgeColor}50`,
                                            borderRadius: 6, padding: '2px 7px',
                                            animation: 'ua-badge 2s ease-in-out infinite',
                                        }}>
                                            {f.badge}
                                        </span>
                                        <span className="text-sm sm:text-base font-black text-white">{f.title}</span>
                                        <span className="hidden sm:inline text-xs font-bold" style={{ color: f.accent }}>· {f.tagline}</span>
                                    </div>
                                    <span className="sm:hidden block mb-1 text-xs font-bold" style={{ color: f.accent }}>{f.tagline}</span>
                                    <p className="m-0 text-xs sm:text-sm text-white/60 leading-relaxed">
                                        {f.description}
                                    </p>
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={f.onCta}
                                    className="w-full sm:w-auto mt-2 sm:mt-0 px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap shrink-0 text-black border-none cursor-pointer"
                                    style={{
                                        background: f.accent,
                                        transition: 'transform 0.15s, box-shadow 0.15s',
                                        boxShadow: `0 4px 16px ${f.accent}50`,
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                                    }}
                                >
                                    {f.cta}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="p-3 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border-t border-white/5 shrink-0">
                        <span className="text-xs text-white/20 italic text-center sm:text-left">
                            More updates coming soon ✦
                        </span>
                        <button
                            onClick={handleClose}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold tracking-wide cursor-pointer border border-white/10 text-white/70 bg-white/5"
                            style={{
                                transition: 'background 0.2s, color 0.2s',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)';
                                (e.currentTarget as HTMLElement).style.color = '#fff';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)';
                            }}
                        >
                            Got it, let's go!
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UpgradeAnnouncementModal;