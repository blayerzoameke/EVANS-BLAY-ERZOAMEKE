import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import InstallButton from './InstallButton';

interface WelcomeProps {
    onProceed: () => void;
}

// ── Hero background ────────────────────────────────────────────────────────
// IMPORTANT: This screen used to embed 6 full-size photos as inline base64
// strings (~1.5 MB of JavaScript). Because Welcome is the first screen a
// logged-out user sees, that huge payload had to be parsed and held in memory
// before anything rendered — which pushed iOS browser tabs (Safari/Chrome/
// Firefox all use WebKit on iPhone) past their hard per-tab memory limit. iOS
// then silently discards and reloads the tab → the "blank flash + reload loop".
// Installed PWAs have a much larger memory budget, so they survived.
//
// We now use the existing /edublay-bg.png asset (a real cached image file, NOT
// parsed into the JS bundle). Same visual feel, ~1.5 MB lighter.
const HeroBackground: React.FC = () => (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'url(/edublay-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.30) saturate(1.15)',
            animation: 'kenburns 20s ease-in-out infinite alternate',
        }} />
        <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(160deg, rgba(11,18,32,0.72) 0%, rgba(15,23,42,0.65) 50%, rgba(17,24,39,0.80) 100%)',
        }} />
    </div>
);

const Particle: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
    <div style={{ position: 'absolute', borderRadius: '50%', opacity: 0.18, pointerEvents: 'none', ...style }} />
);

// ── Main Welcome component ───────────────────────────────────────────────────
const Welcome: React.FC<WelcomeProps> = ({ onProceed }) => {
    const { t } = useLanguage();
    const [isInstalled, setIsInstalled] = useState(false);
    const [visible, setVisible] = useState(false);
    const [hoveredPill, setHoveredPill] = useState<string | null>(null);

    // ── Smart install state ────────────────────────────────────────────────
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [canInstall, setCanInstall] = useState(false);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const [showIosPrompt, setShowIosPrompt] = useState(false);

    useEffect(() => {
        // Check if already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
        if (isStandalone) {
            setIsInstalled(true);
        } else if (isIOS) {
            // Show big prompt immediately if not installed on iOS
            setShowIosPrompt(true);
        }

        setTimeout(() => setVisible(true), 80);

        // Capture the browser's install prompt
        const handler = (e: any) => {
            e.preventDefault();
            setInstallPrompt(e);
            setCanInstall(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // Hide install button once app is installed
        const installedHandler = () => {
            setCanInstall(false);
            setIsInstalled(true);
        };
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setCanInstall(false);
            setIsInstalled(true);
        }
    };

    const particles = [
        { width: 8,  height: 8,  top: '14%', left: '7%',   background: '#60a5fa', animation: 'wfl1 6s ease-in-out infinite' },
        { width: 13, height: 13, top: '71%', left: '4%',   background: '#818cf8', animation: 'wfl2 8s ease-in-out infinite' },
        { width: 6,  height: 6,  top: '34%', right: '6%',  background: '#34d399', animation: 'wfl1 7s ease-in-out infinite 1s' },
        { width: 10, height: 10, top: '81%', right: '9%',  background: '#f472b6', animation: 'wfl2 5s ease-in-out infinite 2s' },
        { width: 15, height: 15, top: '54%', left: '11%',  background: '#fbbf24', animation: 'wfl1 9s ease-in-out infinite .5s' },
        { width: 7,  height: 7,  top: '24%', right: '17%', background: '#60a5fa', animation: 'wfl2 7s ease-in-out infinite 3s' },
        { width: 5,  height: 5,  top: '45%', left: '22%',  background: '#a78bfa', animation: 'wfl1 6s ease-in-out infinite 1.5s' },
        { width: 9,  height: 9,  top: '62%', right: '25%', background: '#34d399', animation: 'wfl2 8s ease-in-out infinite 0.7s' },
    ];

    const features = [
        ['📅','Smart Timetables'],
        ['🧠','AI Quiz Generator'],
        ['📚','Learning Hub'],
        ['📊','Progress Tracking'],
        ['🤝','Collaborative Study'],
        ['🎯','Exam Prep'],
    ];

    return (
        <>
            <style>{`
                @keyframes wfl1{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-18px) scale(1.12)}}
                @keyframes wfl2{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(14px) rotate(180deg)}}
                @keyframes wshim{0%{background-position:-200% center}100%{background-position:200% center}}
                @keyframes wpulse{0%{transform:scale(.95);box-shadow:0 0 0 0 rgba(96,165,250,.5)}70%{transform:scale(1);box-shadow:0 0 0 20px rgba(96,165,250,0)}100%{transform:scale(.95);box-shadow:0 0 0 0 rgba(96,165,250,0)}}
                @keyframes wfadein{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}
                @keyframes wspin{to{transform:rotate(360deg)}}
                @keyframes kenburns{0%{transform:scale(1) translate(0,0)}100%{transform:scale(1.12) translate(-2%,-1%)}}
                @keyframes wslideup{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
                @keyframes wbounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
                @keyframes wglow{0%,100%{box-shadow:0 0 20px rgba(37,99,235,.4),0 0 0 12px rgba(59,130,246,.08)}50%{box-shadow:0 0 40px rgba(37,99,235,.7),0 0 0 20px rgba(59,130,246,.12)}}
                @keyframes wring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.7);opacity:0}}

                .w-vis{animation:wfadein .75s cubic-bezier(.22,1,.36,1) forwards}
                .w-hidden{opacity:0}

                .w-badge{
                    background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.14) 50%,rgba(255,255,255,.04) 100%);
                    background-size:200% auto;animation:wshim 3s linear infinite;
                }

                .w-pill{
                    background:rgba(255,255,255,.05);
                    border:1px solid rgba(255,255,255,.1);
                    backdrop-filter:blur(10px);
                    transition:all .25s cubic-bezier(.22,1,.36,1);
                    cursor:default;
                }
                .w-pill:hover{
                    background:rgba(255,255,255,.12);
                    border-color:rgba(255,255,255,.25);
                    transform:translateY(-3px) scale(1.04);
                    box-shadow:0 8px 20px rgba(0,0,0,.3);
                }

                .w-cta{
                    background:linear-gradient(135deg,#2563eb,#1d4ed8,#1e40af);
                    transition:all .22s cubic-bezier(.22,1,.36,1);
                    box-shadow:0 8px 24px rgba(37,99,235,.45);
                    position:relative; overflow:hidden;
                }
                .w-cta::after{
                    content:'';position:absolute;inset:0;
                    background:linear-gradient(135deg,rgba(255,255,255,.1),transparent);
                    opacity:0;transition:opacity .2s;
                }
                .w-cta:hover{transform:translateY(-3px);box-shadow:0 18px 44px rgba(37,99,235,.6);}
                .w-cta:hover::after{opacity:1;}
                .w-cta:active{transform:translateY(0);box-shadow:0 6px 18px rgba(37,99,235,.4);}

                .w-ghost{
                    transition:all .22s cubic-bezier(.22,1,.36,1);
                    backdrop-filter:blur(10px);
                }
                .w-ghost:hover{
                    background:rgba(255,255,255,.12)!important;
                    border-color:rgba(255,255,255,.28)!important;
                    transform:translateY(-2px);
                    box-shadow:0 10px 28px rgba(0,0,0,.3);
                }

                .w-icon-pulse{animation:wglow 2.8s ease-in-out infinite;}

                .w-stat:hover .w-stat-val{
                    color:#60a5fa;
                    text-shadow:0 0 16px rgba(96,165,250,.5);
                }
                .w-stat{ transition:all .2s ease; cursor:default; }
                .w-stat:hover{ transform:translateY(-3px); }
                .w-stat-val{ transition:all .2s ease; }

                .w-slide-up{animation:wslideup .5s cubic-bezier(.22,1,.36,1) both;}

                .w-ios-tip {
                    background: rgba(37, 99, 235, 0.18);
                    border: 2px solid rgba(59, 130, 246, 0.5);
                    backdrop-filter: blur(12px);
                    border-radius: 20px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 17px;
                    font-weight: 600;
                    margin-top: 8px;
                    max-width: 440px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 12px 36px rgba(37, 99, 235, 0.25);
                    animation: wglow 3s ease-in-out infinite;
                }
            `}</style>

            <div style={{ position:'relative', minHeight:'100vh', overflow:'hidden', display:'flex', flexDirection:'column', background:'linear-gradient(160deg,#0b1220 0%,#0f172a 45%,#111827 100%)' }}>

                <HeroBackground />

                {/* Brand glows */}
                <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:1 }}>
                    <div style={{ position:'absolute', top:'-10%', left:'-10%', width:'50%', height:'60%', background:'radial-gradient(ellipse at center,rgba(37,99,235,.22) 0%,transparent 70%)', filter:'blur(60px)' }} />
                    <div style={{ position:'absolute', bottom:'-10%', right:'-5%', width:'45%', height:'55%', background:'radial-gradient(ellipse at center,rgba(99,102,241,.18) 0%,transparent 70%)', filter:'blur(60px)' }} />
                    <div style={{ position:'absolute', top:'40%', left:'50%', transform:'translateX(-50%)', width:'60%', height:'40%', background:'radial-gradient(ellipse at center,rgba(37,99,235,.08) 0%,transparent 70%)', filter:'blur(80px)' }} />
                </div>

                {/* Particles */}
                <div style={{ position:'absolute', inset:0, zIndex:2, pointerEvents:'none' }}>
                    {particles.map((p, i) => <Particle key={i} style={p as React.CSSProperties} />)}
                </div>

                {/* ── Navbar ── */}
                <nav style={{ position:'relative', zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 28px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(37,99,235,.5)' }}>
                            <span style={{ fontSize:14, fontWeight:900, color:'white', letterSpacing:'-1px', fontFamily:'system-ui,sans-serif', userSelect:'none' }}>EB</span>
                        </div>
                        <span style={{ fontWeight:800, fontSize:22, color:'white', letterSpacing:'-0.02em' }}>EduBlay</span>
                    </div>
                    <button onClick={onProceed}
                        style={{ padding:'8px 20px', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'white', boxShadow:'0 4px 14px rgba(37,99,235,.4)', transition:'all .2s' }}
                        onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 22px rgba(37,99,235,.6)'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(37,99,235,.4)'; }}>
                        {isInstalled ? 'Open App' : 'Sign In'}
                    </button>
                </nav>

                {/* ── Hero ── */}
                <div className={visible ? 'w-vis' : 'w-hidden'}
                    style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 20px 40px', position:'relative', zIndex:10 }}>

                    {/* Shimmer badge */}
                    <div className="w-badge" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 18px', borderRadius:999, marginBottom:24, border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.7)', fontSize:13, fontWeight:600 }}>
                        <span style={{ color:'#60a5fa', animation:'wbounce 2s ease infinite' }}>✦</span>
                        AI-Powered Study Companion
                        <span style={{ color:'#60a5fa', animation:'wbounce 2s ease infinite .4s' }}>✦</span>
                    </div>

                    {/* Pulsing icon with rings */}
                    <div style={{ marginBottom:28, position:'relative', display:'inline-block' }}>
                        <div style={{ position:'absolute', inset:-16, borderRadius:'50%', border:'1px solid rgba(59,130,246,.25)', animation:'wring 2.4s ease-out infinite' }} />
                        <div style={{ position:'absolute', inset:-8, borderRadius:'50%', border:'1px solid rgba(59,130,246,.35)', animation:'wring 2.4s ease-out .6s infinite' }} />
                        <div className="w-icon-pulse" style={{ width:96, height:96, borderRadius:28, background:'linear-gradient(145deg,#3b82f6 0%,#2563eb 60%,#1d4ed8 100%)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1 }}>
                            <span style={{ fontSize:32, fontWeight:900, color:'white', letterSpacing:'-2px', fontFamily:'system-ui,sans-serif', userSelect:'none' }}>EB</span>
                        </div>
                    </div>

                    {/* Headline */}
                    <h1 style={{ fontSize:'clamp(32px,6vw,60px)', fontWeight:900, letterSpacing:'-0.03em', lineHeight:1.08, maxWidth:680, color:'#fff', marginBottom:14 }}>
                        <span style={{ background:'linear-gradient(90deg,#60a5fa 0%,#818cf8 50%,#a78bfa 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Study Smarter.</span>
                        <br />Score Higher.
                    </h1>

                    <p style={{ fontSize:'clamp(14px,2vw,18px)', color:'rgba(255,255,255,.60)', maxWidth:500, lineHeight:1.7, marginBottom:8, fontWeight:500 }}>
                        Welcome to <strong style={{ color:'white' }}>EduBlay Study Hub</strong>. Your personalized learning companion — create effective schedules, prepare for exams with AI-generated quizzes, and track your progress in real-time.
                    </p>

                    {/* Feature pills */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:32 }}>
                        {features.map(([icon, label]) => (
                            <div key={label} className="w-pill"
                                onMouseEnter={() => setHoveredPill(label)}
                                onMouseLeave={() => setHoveredPill(null)}
                                style={{ padding:'7px 16px', borderRadius:999, display:'flex', alignItems:'center', gap:7, color:'rgba(255,255,255,.75)', fontSize:12, fontWeight:600,
                                    boxShadow: hoveredPill === label ? '0 0 0 2px rgba(96,165,250,.4)' : 'none' }}>
                                <span style={{ fontSize:14 }}>{icon}</span> {label}
                            </div>
                        ))}
                    </div>

                    {/* ── Install / Open buttons ── */}
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, width:'100%', maxWidth:400 }}>

                        {isInstalled ? (
                            // Already installed — show Open button
                            <button onClick={onProceed} className="w-cta"
                                style={{ width:'100%', padding:'17px 54px', borderRadius:17, cursor:'pointer', border:'none', color:'white', fontSize:17, fontWeight:800 }}>
                                Open EduBlay →
                            </button>

                        ) : canInstall ? (
                            // Browser supports install prompt — show Install button
                            <button onClick={handleInstall} className="w-cta"
                                style={{ width:'100%', padding:'17px 22px', borderRadius:17, cursor:'pointer', border:'none', color:'white', fontSize:17, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                                <span>⬇</span> Install EduBlay App
                            </button>

                        ) : isIOS ? (
                            // iOS Safari — can't trigger install programmatically, show tip instead
                            <>
                                <div className="w-ios-tip">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                                        <span style={{ fontSize: 32 }}>📲</span>
                                        <span style={{ fontSize: 20, fontWeight: 900, color: 'white' }}>Install on iPhone</span>
                                    </div>
                                    <div style={{ lineHeight: 1.6 }}>
                                        Tap the <strong style={{ color:'white' }}>Share</strong> icon (📤) in your Safari menu bar, then scroll down and tap{' '}
                                        <strong style={{ color:'white' }}>"Add to Home Screen"</strong> (➕) to install EduBlay. The app works perfectly after adding it to your home screen!
                                    </div>
                                </div>
                                <button onClick={onProceed}
                                    style={{ width:'100%', padding:'14px 22px', borderRadius:17, cursor:'pointer', border:'2px solid rgba(255,255,255,.1)', background:'none', color:'rgba(255,255,255,.7)', fontSize:15, fontWeight:700, marginTop: 4 }}>
                                    Continue in Browser
                                </button>
                            </>
                        ) : (
                            // Fallback — browser doesn't support install yet, show Sign In
                            <button onClick={onProceed} className="w-cta"
                                style={{ width:'100%', padding:'17px 22px', borderRadius:17, cursor:'pointer', border:'none', color:'white', fontSize:17, fontWeight:800 }}>
                                Get Started →
                            </button>
                        )}

                    </div>


                </div>

                {/* ── Stats strip ── */}
                <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', padding:'18px 20px', display:'flex', justifyContent:'center', gap:'clamp(18px,6vw,64px)', flexWrap:'wrap', position:'relative', zIndex:10 }}>
                    {[['AI-Powered','Quiz Generation'],['Real-Time','Progress Tracking'],['Offline','PWA Support'],['6 Tools','in One App']].map(([stat, label]) => (
                        <div key={stat} className="w-stat" style={{ textAlign:'center' }}>
                            <div className="w-stat-val" style={{ fontSize:17, fontWeight:900, color:'white', letterSpacing:'-0.02em' }}>{stat}</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,.36)', fontWeight:600, marginTop:2 }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* ── Footer ── */}
                <div style={{
                    borderTop:'1px solid rgba(255,255,255,.05)',
                    padding:'20px 24px',
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    flexWrap:'wrap', gap:8,
                    position:'relative', zIndex:10,
                    background:'rgba(0,0,0,.2)',
                }}>
                    <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', fontWeight:500 }}>
                        © {new Date().getFullYear()} StudyHub
                    </div>
                </div>

                {/* ── HUGE iOS Install Overlay ── */}
                {showIosPrompt && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(16px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        animation: 'wfadein 0.4s ease-out forwards'
                    }}>
                        <div style={{
                            background: 'linear-gradient(160deg, rgba(30,58,138,0.95), rgba(15,23,42,0.95))',
                            border: '2px solid rgba(59,130,246,0.6)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.1)',
                            borderRadius: '32px',
                            padding: '36px 28px',
                            maxWidth: '460px',
                            width: '100%',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '24px'
                        }}>
                            <div style={{
                                width: 84, height: 84, borderRadius: 24,
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 12px 32px rgba(37,99,235,0.5)',
                                marginBottom: 8
                            }}>
                                <span style={{ fontSize: 36, fontWeight: 900, color: 'white', letterSpacing: '-2px' }}>EB</span>
                            </div>
                            
                            <div>
                                <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '12px' }}>
                                    Install EduBlay App
                                </h2>
                                <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, fontWeight: 500 }}>
                                    For the best experience and to <strong style={{color:'white'}}>enable Google Sign-In</strong>, you must install EduBlay on your iPhone.
                                </p>
                            </div>

                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '20px',
                                padding: '24px',
                                width: '100%',
                                textAlign: 'left',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 20 }}>1️⃣</span>
                                    </div>
                                    <span style={{ fontSize: 16, color: 'white', fontWeight: 600 }}>Tap the <strong style={{color:'#60a5fa'}}>Share</strong> icon (📤) in the Safari menu bar below.</span>
                                </div>
                                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 20 }}>2️⃣</span>
                                    </div>
                                    <span style={{ fontSize: 16, color: 'white', fontWeight: 600 }}>Scroll down and tap <strong style={{color:'#60a5fa'}}>"Add to Home Screen"</strong> (➕).</span>
                                </div>
                            </div>
                            
                            <button onClick={() => setShowIosPrompt(false)}
                                style={{
                                    marginTop: '8px',
                                    padding: '16px 32px',
                                    borderRadius: '16px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: 'rgba(255,255,255,0.6)',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    width: '100%'
                                }}>
                                I already installed it / Continue in browser
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Welcome;