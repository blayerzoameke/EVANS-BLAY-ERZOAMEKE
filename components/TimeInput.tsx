import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ClockIcon } from './icons/ClockIcon';
import { useLanguage } from '../contexts/LanguageContext';

// ── Parse "hh:mm AM/PM" → { hours12, minutes, period } ────────────────────
const parseTime = (val: string) => {
    const match = val.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
        return {
            hours12: parseInt(match[1], 10),
            minutes: parseInt(match[2], 10),
            period: match[3].toUpperCase() as 'AM' | 'PM',
        };
    }
    return { hours12: 12, minutes: 0, period: 'AM' as 'AM' | 'PM' };
};

// ── Format back to "hh:mm AM/PM" ─────────────────────────────────────────
const formatTime = (hours12: number, minutes: number, period: 'AM' | 'PM') =>
    `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;

// ── Detect touch/mobile ───────────────────────────────────────────────────
const isTouchDevice = () =>
    typeof window !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

// ── Scroll-wheel column ───────────────────────────────────────────────────
const WheelColumn: React.FC<{
    items: string[];
    selected: string;
    onSelect: (v: string) => void;
    width?: string;
}> = ({ items, selected, onSelect, width = '64px' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const ITEM_H = 44; // px per row

    // Scroll to selected on mount/change
    useEffect(() => {
        const idx = items.indexOf(selected);
        if (idx >= 0 && containerRef.current) {
            containerRef.current.scrollTop = idx * ITEM_H;
        }
    }, [selected, items]);

    const handleScroll = useCallback(() => {
        if (!containerRef.current) return;
        const idx = Math.round(containerRef.current.scrollTop / ITEM_H);
        const clamped = Math.max(0, Math.min(items.length - 1, idx));
        if (items[clamped] !== selected) onSelect(items[clamped]);
    }, [items, selected, onSelect]);

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            style={{
                width,
                height: ITEM_H * 5,
                overflowY: 'scroll',
                scrollSnapType: 'y mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                position: 'relative',
            }}
            className="hide-scrollbar"
        >
            {/* padding so first/last items can center */}
            <div style={{ height: ITEM_H * 2 }} />
            {items.map(item => (
                <div
                    key={item}
                    onClick={() => onSelect(item)}
                    style={{
                        height: ITEM_H,
                        scrollSnapAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: item === selected ? '22px' : '16px',
                        fontWeight: item === selected ? 800 : 400,
                        color: item === selected ? '#6366f1' : '#6b7280',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    {item}
                </div>
            ))}
            <div style={{ height: ITEM_H * 2 }} />
        </div>
    );
};

// ── Hours, minutes, period options ───────────────────────────────────────
const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

// ── Mobile wheel picker modal ────────────────────────────────────────────
const WheelPicker: React.FC<{
    value: string;
    onChange: (v: string) => void;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement>;
}> = ({ value, onChange, onClose }) => {
    const { hours12, minutes, period } = parseTime(value);
    const [h, setH] = useState(String(hours12).padStart(2, '0'));
    const [m, setM] = useState(String(minutes).padStart(2, '0'));
    const [p, setP] = useState<'AM' | 'PM'>(period);

    const commit = () => {
        onChange(formatTime(parseInt(h, 10), parseInt(m, 10), p));
        onClose();
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#1c1c1e',
                    borderRadius: '20px 20px 0 0',
                    width: '100%', maxWidth: 480,
                    paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
                    overflow: 'hidden',
                }}
            >
                {/* ── Handle bar ── */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.25)' }} />
                </div>

                {/* ── Toolbar — ALWAYS at top so Reset & ✓ are never hidden ── */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 20px 10px',
                    borderBottom: '1px solid rgba(255,255,255,.08)',
                }}>
                    {/* Reset — closes without applying, restores original */}
                    <button
                        onClick={onClose}
                        style={{
                            fontSize: 15, fontWeight: 600, color: '#9ca3af',
                            background: 'rgba(255,255,255,.07)',
                            border: 'none', cursor: 'pointer',
                            padding: '9px 18px', borderRadius: 10,
                            minHeight: 44, minWidth: 80,
                        }}
                    >
                        Reset
                    </button>

                    <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
                        Select Time
                    </span>

                    {/* ✓ — confirm selection */}
                    <button
                        onClick={commit}
                        style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: '#6366f1', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 14px rgba(99,102,241,.5)',
                            flexShrink: 0,
                        }}
                    >
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </button>
                </div>

                {/* ── Wheels ── */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 0, position: 'relative', padding: '8px 20px 4px' }}>
                    {/* Selection highlight bar */}
                    <div style={{
                        position: 'absolute', left: 20, right: 20,
                        top: '50%', transform: 'translateY(-50%)',
                        height: 44, borderRadius: 12,
                        background: 'rgba(99,102,241,.15)',
                        border: '1px solid rgba(99,102,241,.3)',
                        pointerEvents: 'none',
                    }} />
                    <WheelColumn items={HOURS}   selected={h} onSelect={setH} width="80px" />
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 22, fontWeight: 900, color: '#6366f1', padding: '0 4px', zIndex: 1 }}>:</div>
                    <WheelColumn items={MINUTES} selected={m} onSelect={setM} width="80px" />
                    <WheelColumn items={PERIODS} selected={p} onSelect={v => setP(v as 'AM' | 'PM')} width="72px" />
                </div>
            </div>

            <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

// ── Desktop dropdown (existing behaviour) ─────────────────────────────────
const generateTimeOptions = () => {
    const times: string[] = [];
    for (let i = 0; i < 24 * 4; i++) {
        const total = i * 15;
        const h24 = Math.floor(total / 60);
        const min = total % 60;
        const period = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 || 12;
        times.push(`${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`);
    }
    return times;
};
const TIME_OPTIONS = generateTimeOptions();

// ── Main TimeInput ────────────────────────────────────────────────────────
interface TimeInputProps {
    value: string;
    onChange: (newValue: string) => void;
    id?: string;
    disabled?: boolean;
}

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, id, disabled = false }) => {
    const { t } = useLanguage();
    const [inputValue, setInputValue] = useState(value);
    const [isOpen, setIsOpen] = useState(false);       // desktop dropdown
    const [showWheel, setShowWheel] = useState(false); // mobile wheel
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isTouch = isTouchDevice();

    useEffect(() => { setInputValue(value); }, [value]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        onChange(e.target.value);
        if (!isOpen) setIsOpen(true);
    };

    const handleSelect = (t: string) => {
        setInputValue(t);
        onChange(t);
        setIsOpen(false);
    };

    const filtered = TIME_OPTIONS.filter(o => o.toLowerCase().includes(inputValue.toLowerCase()));

    const baseClasses = "w-full h-10 pl-3 pr-8 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-inner text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm";

    // On touch devices → show wheel picker
    if (isTouch && !disabled) {
        return (
            <>
                <button
                    type="button"
                    id={id}
                    disabled={disabled}
                    onClick={() => setShowWheel(true)}
                    className="w-full h-10 pl-3 pr-8 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 text-sm text-left relative focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                    {/* Show full time on mobile including AM/PM */}
                    <span className="block truncate">{value}</span>
                    <ClockIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </button>
                {showWheel && (
                    <WheelPicker
                        value={value}
                        onChange={v => { onChange(v); setInputValue(v); }}
                        onClose={() => setShowWheel(false)}
                    />
                )}
            </>
        );
    }

    // Desktop dropdown
    return (
        <div className="relative" ref={dropdownRef}>
            <input
                id={id}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => !disabled && setIsOpen(true)}
                placeholder={t('timeInput.placeholder' as any)}
                autoComplete="off"
                className={baseClasses}
                disabled={disabled}
            />
            <ClockIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            {isOpen && !disabled && (
                <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto">
                    {filtered.length > 0
                        ? filtered.map((o, i) => (
                            <li key={i} onClick={() => handleSelect(o)} className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-200 text-sm">
                                {o}
                            </li>
                          ))
                        : <li className="px-3 py-2 text-gray-500 text-sm">{t('timeInput.noMatch' as any)}</li>
                    }
                </ul>
            )}
        </div>
    );
};

export default TimeInput;