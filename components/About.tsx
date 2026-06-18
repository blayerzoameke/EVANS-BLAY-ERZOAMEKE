import React, { useRef, useEffect, useState } from 'react';
import type { View } from '../types';

interface CanvasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
}

interface AboutSessionCanvasProps {
  setView: (view: View) => void;
}

const AboutSessionCanvas: React.FC<AboutSessionCanvasProps> = ({ setView }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<CanvasParticle[]>([]);

  // ── Stats ─────────────────────────────────────────────────────────────
  const [counts, setCounts] = useState({ students: 0, sessions: 0, uptime: 0, features: 0 });
  const [started, setStarted] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStarted(true); io.disconnect(); } }, { threshold: 0.3 });
    if (statsRef.current) io.observe(statsRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const targets = { students: 500, sessions: 400, uptime: 99, features: 12 };
    let frame = 0; const total = 90;
    const id = setInterval(() => {
      frame++;
      const p = 1 - Math.pow(1 - frame / total, 3);
      setCounts({
        students: Math.round(p * targets.students),
        sessions: Math.round(p * targets.sessions),
        uptime: Math.round(p * targets.uptime),
        features: Math.round(p * targets.features),
      });
      if (frame >= total) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [started]);

  // ── Canvas ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = [
      'rgba(99,102,241,', 'rgba(139,92,246,',
      'rgba(56,189,248,', 'rgba(244,114,182,',
      'rgba(52,211,153,', 'rgba(251,146,60,',
    ];

    particlesRef.current = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2.2 + 0.6,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: Math.random() * 0.4 + 0.15,
    }));

    const draw = () => {
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const pts = particlesRef.current;

      pts.forEach((p, i) => {
        // Mouse repulsion
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120;
          p.vx += (dx / dist) * force * 0.3;
          p.vy += (dy / dist) * force * 0.3;
        }

        // Speed cap
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 2) { p.vx = (p.vx / speed) * 2; p.vy = (p.vy / speed) * 2; }

        // Friction
        p.vx *= 0.98; p.vy *= 0.98;

        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > W) { p.x = W; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > H) { p.y = H; p.vy *= -1; }

        // Glow near mouse
        const proximity = Math.max(0, 1 - dist / 120);
        const r = p.radius + proximity * 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + (p.opacity + proximity * 0.4) + ')';
        ctx.fill();

        // Connect nearby
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const ddx = p.x - q.x, ddy = p.y - q.y;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(139,92,246,${0.18 * (1 - d / 110)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      });

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onMouseLeave = () => { mouseRef.current = { x: -999, y: -999 }; };

  // ── Feature cards ──────────────────────────────────────────────────────
  const features = [
    { icon: '📅', label: 'Smart Timetables',    desc: 'AI-generated schedules tailored to your courses and habits.',       color: '#818cf8' },
    { icon: '🧠', label: 'AI Quiz Generator',    desc: 'Practice with auto-generated quizzes from your uploaded material.', color: '#34d399' },
    { icon: '📚', label: 'Learning Hub',          desc: 'Deep-analyse, summarise and chat with your study documents.',       color: '#f472b6' },
    { icon: '📊', label: 'Progress Tracking',     desc: 'Real-time charts showing time allocation and achievement rate.',   color: '#fb923c' },
    { icon: '🤝', label: 'Collaborative Study',   desc: 'Live study rooms with shared AI, voice notes and file sharing.',   color: '#38bdf8' },
    { icon: '🎯', label: 'Exam Prep',             desc: 'Focused exam practice with countdown and performance tracking.',   color: '#a78bfa' },
  ];

  const stats = [
    { value: counts.students, suffix: '+', label: 'Students',   color: '#818cf8', icon: '🎓' },
    { value: counts.sessions, suffix: '+', label: 'Sessions',   color: '#34d399', icon: '📖' },
    { value: counts.uptime,   suffix: '%', label: 'Uptime',     color: '#fb923c', icon: '⚡' },
    { value: counts.features, suffix: '',  label: 'Features',   color: '#f472b6', icon: '✨' },
  ];

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#e2e8f0' }}>
      <style>{`
        @keyframes asc-fade  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes asc-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes asc-glow  { 0%,100%{box-shadow:0 0 20px rgba(99,102,241,.3)} 50%{box-shadow:0 0 48px rgba(99,102,241,.7)} }
        @keyframes asc-spin  { to{transform:rotate(360deg)} }
        .asc-fade   { animation:asc-fade .7s ease both; }
        .asc-card   { transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease; }
        .asc-card:hover { transform:translateY(-5px) scale(1.02); box-shadow:0 20px 50px rgba(0,0,0,.4); }
        .asc-stat   { transition:all .2s ease; cursor:default; }
        .asc-stat:hover { transform:translateY(-4px); }
        .asc-btn    { transition:all .25s ease; }
        .asc-btn:hover { transform:translateY(-2px); }
        .asc-spinner{ animation:asc-spin 12s linear infinite; }
      `}</style>

      {/* ══ HERO CANVAS SECTION ══ */}
      <section
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'relative',
          minHeight: 520,
          borderRadius: 24,
          overflow: 'hidden',
          background: 'linear-gradient(160deg,#07050f,#0d0b2a,#07050f)',
          border: '1px solid rgba(99,102,241,.25)',
          marginBottom: '3rem',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Live particle canvas */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />

        {/* Ambient glows */}
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '45%', height: '70%', background: 'radial-gradient(ellipse,rgba(99,102,241,.18),transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '40%', height: '60%', background: 'radial-gradient(ellipse,rgba(168,85,247,.14),transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

        {/* Content overlay */}
        <div style={{ position: 'relative', zIndex: 2, padding: '3rem 2rem', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '2rem', alignItems: 'center' }}>

          {/* Left: headline */}
          <div className="asc-fade" style={{ animationDelay: '.1s' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 14px', borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.35)', color: '#a5b4fc', marginBottom: 16 }}>
              Interactive Canvas · Live Particles
            </span>
            <h2 style={{ fontSize: 'clamp(28px,5vw,52px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-.02em', color: '#fff', marginBottom: 16 }}>
              Study Smarter.<br />
              <span style={{ background: 'linear-gradient(90deg,#818cf8,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Score Higher.</span>
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(148,163,184,.9)', lineHeight: 1.7, maxWidth: 400, marginBottom: 24 }}>
              EduBlay combines AI-powered tools, smart scheduling and real-time collaboration to help every student reach their full academic potential.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button onClick={() => setView('dashboard')} className="asc-btn"
                style={{ padding: '12px 24px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 28px rgba(99,102,241,.45)' }}>
                Open Dashboard →
              </button>
              <button onClick={() => setView('collaborative' as View)} className="asc-btn"
                style={{ padding: '12px 24px', borderRadius: 14, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                Join Study Room
              </button>
            </div>
          </div>

          {/* Right: live stat cards */}
          <div ref={statsRef} className="asc-fade" style={{ animationDelay: '.3s', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {stats.map(({ value, suffix, label, color, icon }) => (
              <div key={label} className="asc-stat"
                style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 16, padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 32, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}{suffix}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,.7)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Corner decoration */}
        <div className="asc-spinner" style={{ position: 'absolute', bottom: 16, right: 16, width: 60, height: 60, borderRadius: '50%', border: '1px dashed rgba(99,102,241,.3)', pointerEvents: 'none' }} />
      </section>

      {/* ══ FEATURE CARDS ══ */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 14px', borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.3)', color: '#a5b4fc', marginBottom: 12 }}>
            What's Inside
          </span>
          <h3 style={{ fontSize: 'clamp(22px,4vw,36px)', fontWeight: 900, color: '#fff', letterSpacing: '-.02em' }}>Everything You Need</h3>
          <p style={{ fontSize: 14, color: 'rgba(148,163,184,.8)', marginTop: 8 }}>All your study tools in one place</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
          {features.map(({ icon, label, desc, color }, i) => (
            <div key={label} className="asc-card"
              style={{ background: `${color}08`, border: `1px solid ${color}22`, borderRadius: 18, padding: '22px 20px', cursor: 'default',
                animationDelay: `${i * 0.07}s` }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: `${color}18`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14, boxShadow: `0 0 20px ${color}20` }}>
                {icon}
              </div>
              <h4 style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{label}</h4>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,.85)', lineHeight: 1.6 }}>{desc}</p>
              <div style={{ marginTop: 14, height: 2, borderRadius: 1, background: `linear-gradient(90deg, ${color}60, transparent)` }} />
            </div>
          ))}
        </div>
      </section>

      {/* ══ LIVE SESSION PROMO ══ */}
      <section
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(135deg,rgba(99,102,241,.12),rgba(168,85,247,.08))', border: '1px solid rgba(99,102,241,.3)', padding: '2.5rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '2rem', alignItems: 'center' }}>

        <div className="asc-fade" style={{ animationDelay: '.2s' }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#f59e0b', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', padding: '3px 12px', borderRadius: 999 }}>New in v2.0</span>
          <h3 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '12px 0 10px', letterSpacing: '-.02em' }}>Collaborative Study Sessions</h3>
          <p style={{ fontSize: 14, color: 'rgba(148,163,184,.9)', lineHeight: 1.7, marginBottom: 20 }}>
            Create or join a live study room with a 6-letter code. Chat, share files, get AI answers together and go on camera — all in real time.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {['💬 Live Chat','🤖 Shared AI','🎤 Voice Notes','📷 Camera','📎 Files','🔑 Room Codes'].map(f => (
              <span key={f} style={{ fontSize: 12, fontWeight: 600, color: 'rgba(209,213,219,.9)', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', padding: '4px 10px', borderRadius: 8 }}>{f}</span>
            ))}
          </div>
          <button onClick={() => setView('collaborative' as View)} className="asc-btn"
            style={{ padding: '12px 28px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 28px rgba(99,102,241,.45)' }}>
            Start a Session →
          </button>
        </div>

        {/* Animated mock chat */}
        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 18, overflow: 'hidden', animation: 'asc-fade .7s ease .4s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(99,102,241,.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 900 }}>S</div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Study Room</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,.25)', color: '#a5b4fc' }}>6YGJXT</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>3 online</span>
            </div>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { from: 'Ama', color: '#818cf8', msg: 'Can you explain Newton\'s 2nd law?', align: 'left' },
              { from: 'Blay AI ✦', color: '#a78bfa', msg: 'F = ma — Force equals mass × acceleration! 🚀', align: 'left', ai: true },
              { from: 'You', color: '#6366f1', msg: 'That makes sense, thanks! 🙏', align: 'right' },
            ].map(({ from, color, msg, align, ai }, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                {align === 'left' && (
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: ai ? 'linear-gradient(135deg,#7c3aed,#a78bfa)' : 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 900, flexShrink: 0 }}>
                    {ai ? '✦' : from[0]}
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, color, marginBottom: 2, marginLeft: 2 }}>{from}</p>
                  <div style={{ padding: '8px 12px', borderRadius: align === 'right' ? '14px 14px 2px 14px' : '14px 14px 14px 2px', fontSize: 12, color: '#e2e8f0', background: align === 'right' ? 'linear-gradient(135deg,#4f46e5,#6366f1)' : ai ? 'rgba(124,58,237,.2)' : 'rgba(255,255,255,.07)', border: align === 'right' ? 'none' : `1px solid ${ai ? 'rgba(124,58,237,.3)' : 'rgba(255,255,255,.09)'}`, maxWidth: 190 }}>
                    {msg}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>
              <span style={{ fontSize: 12, color: 'rgba(156,163,175,.5)', flex: 1 }}>Type a message…</span>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>➤</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutSessionCanvas;