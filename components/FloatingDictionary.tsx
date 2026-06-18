import React, { useState, useEffect, useRef } from 'react';

interface DictionaryResult {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string; synonyms?: string[]; antonyms?: string[] }[];
    synonyms?: string[];
    antonyms?: string[];
  }[];
  sourceUrls?: string[];
}

type DictState = 'idle' | 'loading' | 'result' | 'error';

const FloatingDictionary: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DictionaryResult[] | null>(null);
  const [dictState, setDictState] = useState<DictState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [playingAudio, setPlayingAudio] = useState(false);

  const [fabPos, setFabPos] = useState({ x: 0, y: 0 });
  const [panelPos, setPanelPos] = useState({ x: 20, y: 20 });
  const [isDraggingFab, setIsDraggingFab] = useState(false);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const FAB = 68;
    setFabPos({ x: window.innerWidth - FAB - 24, y: window.innerHeight - FAB - 24 });
    setPanelPos({ x: window.innerWidth > 500 ? window.innerWidth - 380 : 10, y: 100 });
  }, []);

  const startFabDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDraggingFab(true);
    setDragOffset({ x: clientX - fabPos.x, y: clientY - fabPos.y });
  };

  const startPanelDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.dict-no-drag')) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDraggingPanel(true);
    setDragOffset({ x: clientX - panelPos.x, y: clientY - panelPos.y });
  };

  useEffect(() => {
    if (!isDraggingFab && !isDraggingPanel) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      if (isDraggingFab) {
        setFabPos({
          x: Math.max(0, Math.min(window.innerWidth - 64, clientX - dragOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 64, clientY - dragOffset.y)),
        });
      }
      if (isDraggingPanel) {
        setPanelPos({
          x: Math.max(0, Math.min(window.innerWidth - 340, clientX - dragOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 120, clientY - dragOffset.y)),
        });
      }
    };
    const onUp = () => { setIsDraggingFab(false); setIsDraggingPanel(false); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [isDraggingFab, isDraggingPanel, dragOffset]);

  const search = async (word?: string) => {
    const w = (word ?? query).trim().toLowerCase();
    if (!w) return;
    setDictState('loading');
    setResult(null);
    setActiveTab(0);
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
      if (!res.ok) throw new Error('Word not found');
      const data = await res.json();
      setResult(data);
      setDictState('result');
    } catch (err: any) {
      setErrorMsg(err.message);
      setDictState('error');
    }
  };

  const playAudio = () => {
    if (!result) return;
    const audio = result[0]?.phonetics?.find(p => p.audio)?.audio;
    if (!audio) return;
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = new Audio(audio.startsWith('//') ? `https:${audio}` : audio);
    audioRef.current.onplay = () => setPlayingAudio(true);
    audioRef.current.onended = () => setPlayingAudio(false);
    audioRef.current.play().catch(() => setPlayingAudio(false));
  };

  const currentEntry = result?.[activeTab];

  return (
    <>
      <style>{`
        .dict-panel {
          position: fixed;
          z-index: 9989;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Georgia', serif;
          box-shadow: 0 24px 80px rgba(0,0,0,.7);
          border-radius: 16px;
        }
        .dict-header {
          cursor: grab;
          user-select: none;
          touch-action: none;
          background: #1e293b;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(99,102,241,.2);
        }
        .dict-header:active { cursor: grabbing; }
        .dict-search-btn {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #4338ca, #6366f1);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .dict-search-btn:hover { opacity: 0.88; transform: scale(1.05); }
        .dict-search-btn:active { transform: scale(0.96); }
        .dict-search-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
      `}</style>

      {/* DRAGGABLE FAB */}
      <div
        onMouseDown={startFabDrag}
        onTouchStart={startFabDrag}
        style={{ position: 'fixed', left: fabPos.x, top: fabPos.y, zIndex: 9990, cursor: 'grab', touchAction: 'none' }}
      >
        <button
          className="dict-no-drag"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: 64, height: 64, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg, #4338ca, #6366f1)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', color: 'white', fontWeight: 800,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ marginBottom: 2 }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span style={{ fontSize: 9 }}>DICT</span>
        </button>
      </div>

      {/* DICTIONARY PANEL */}
      {isOpen && (
        <div
          className="dict-panel"
          style={{
            left: panelPos.x, top: panelPos.y, width: 340,
            height: isMinimized ? 52 : 480,
            background: 'linear-gradient(170deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid rgba(99,102,241,.3)',
          }}
        >
          {/* HEADER */}
          <div
            className="dict-header"
            onMouseDown={startPanelDrag}
            onTouchStart={startPanelDrag}
            onTouchMove={(e) => e.preventDefault()}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <strong style={{ color: 'white', fontSize: 13 }}>Dictionary</strong>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="dict-no-drag" onClick={() => setIsMinimized(!isMinimized)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
                {isMinimized ? '▲' : '▼'}
              </button>
              <button className="dict-no-drag" onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                ✕
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div style={{ padding: 14, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* ── SEARCH ROW ── */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                  placeholder="Search a word…"
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10,
                    border: '1px solid rgba(99,102,241,.35)',
                    background: 'rgba(15,23,42,.7)', color: 'white',
                    fontSize: 13, outline: 'none',
                  }}
                />
                {/* SEARCH BUTTON */}
                <button
                  className="dict-no-drag dict-search-btn"
                  onClick={() => search()}
                  disabled={dictState === 'loading' || !query.trim()}
                  title="Search"
                >
                  {dictState === 'loading' ? (
                    /* spinner */
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
                      style={{ animation: 'spin 0.7s linear infinite' }}>
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    /* magnifier icon */
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  )}
                </button>
              </div>

              {/* ERROR */}
              {dictState === 'error' && (
                <p style={{ color: '#fca5a5', fontSize: 12, margin: 0 }}>
                  ❌ {errorMsg}. Try a different spelling.
                </p>
              )}

              {/* RESULT */}
              {result && currentEntry && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* word + phonetic + audio */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ color: 'white', margin: 0, fontSize: 20, fontWeight: 900 }}>{currentEntry.word}</h2>
                    {currentEntry.phonetic && (
                      <span style={{ color: '#818cf8', fontSize: 13, fontStyle: 'italic' }}>{currentEntry.phonetic}</span>
                    )}
                    {result[0]?.phonetics?.some(p => p.audio) && (
                      <button
                        className="dict-no-drag"
                        onClick={playAudio}
                        title="Play pronunciation"
                        style={{
                          background: playingAudio ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.15)',
                          border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8,
                          color: '#818cf8', cursor: 'pointer', padding: '4px 8px', fontSize: 14,
                        }}
                      >
                        {playingAudio ? '🔊' : '🔈'}
                      </button>
                    )}
                  </div>

                  {/* multiple entries tabs */}
                  {result.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {result.map((_, i) => (
                        <button key={i} className="dict-no-drag" onClick={() => setActiveTab(i)}
                          style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: activeTab === i ? 'rgba(99,102,241,0.25)' : 'transparent',
                            border: `1px solid ${activeTab === i ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.2)'}`,
                            color: activeTab === i ? '#a5b4fc' : '#64748b',
                          }}>
                          Entry {i + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* meanings */}
                  {currentEntry.meanings.map((m, i) => (
                    <div key={i} style={{ borderLeft: '2px solid rgba(99,102,241,0.4)', paddingLeft: 10 }}>
                      <span style={{
                        display: 'inline-block', marginBottom: 6, padding: '2px 8px',
                        borderRadius: 20, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.06em', background: 'rgba(99,102,241,0.15)',
                        border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc',
                      }}>
                        {m.partOfSpeech}
                      </span>
                      {m.definitions.slice(0, 3).map((d, j) => (
                        <div key={j} style={{ marginBottom: 6 }}>
                          <p style={{ color: '#e2e8f0', fontSize: 12, margin: '0 0 2px 0', lineHeight: 1.5 }}>
                            {j + 1}. {d.definition}
                          </p>
                          {d.example && (
                            <p style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic', margin: 0 }}>
                              "{d.example}"
                            </p>
                          )}
                        </div>
                      ))}
                      {m.synonyms && m.synonyms.length > 0 && (
                        <p style={{ color: '#34d399', fontSize: 11, margin: '4px 0 0 0' }}>
                          <span style={{ fontWeight: 700 }}>Synonyms: </span>
                          {m.synonyms.slice(0, 4).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* IDLE state hint */}
              {dictState === 'idle' && (
                <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', margin: 'auto 0' }}>
                  Type a word and press Enter or tap 🔍
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FloatingDictionary;