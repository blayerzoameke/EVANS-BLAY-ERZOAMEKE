import React, { useState, useEffect } from 'react';
import type { UserDetails, Toast } from '../types';
import { globalFeedbackService } from '../services/globalFeedbackService';
import { notificationService } from '../services/notificationService';

const MORNING_QUOTES = [
    { quote: "The secret of getting ahead is getting started.", author: "EduBlay Team 🇬🇭" },
    { quote: "Education is the most powerful weapon which you can use to change the world.", author: "EduBlay Team 🇬🇭" },
    { quote: "The beautiful thing about learning is that nobody can take it away from you.", author: "EduBlay Team 🇬🇭" },
    { quote: "An investment in knowledge pays the best interest.", author: "EduBlay Team 🇬🇭" },
    { quote: "The more that you read, the more things you will know.", author: "EduBlay Team 🇬🇭" },
    { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "EduBlay Team 🇬🇭" },
    { quote: "Strive for progress, not perfection.", author: "EduBlay Team 🇬🇭" },
    { quote: "Your future is created by what you do today, not tomorrow.", author: "EduBlay Team 🇬🇭" },
    { quote: "Don't watch the clock; do what it does. Keep going.", author: "EduBlay Team 🇬🇭" },
    { quote: "You don't have to be great to start, but you have to start to be great.", author: "EduBlay Team 🇬🇭" },
    { quote: "The expert in anything was once a beginner.", author: "EduBlay Team 🇬🇭" },
    { quote: "Push yourself, because no one else is going to do it for you.", author: "EduBlay Team 🇬🇭" },
    { quote: "Great things never come from comfort zones.", author: "EduBlay Team 🇬🇭" },
    { quote: "It always seems impossible until it's done.", author: "EduBlay Team 🇬🇭" },
    { quote: "Hard work beats talent when talent doesn't work hard.", author: "EduBlay Team 🇬🇭" },
    { quote: "Study hard, for the well is deep and our brains are shallow.", author: "EduBlay Team 🇬🇭" },
    { quote: "Discipline is the bridge between goals and accomplishment.", author: "EduBlay Team 🇬🇭" },
    { quote: "You are braver than you believe, smarter than you seem.", author: "EduBlay Team 🇬🇭" },
    { quote: "Believe you can and you're halfway there.", author: "EduBlay Team 🇬🇭" },
    { quote: "Knowledge is power. Use EduBlay to unlock yours.", author: "EduBlay Team 🇬🇭" },
    { quote: "Ghana's brightest minds study smarter with EduBlay.", author: "EduBlay Team 🇬🇭" },
    { quote: "One page at a time, one day at a time. You've got this!", author: "EduBlay Team 🇬🇭" },
    { quote: "Every great student shows up consistently. Be that student.", author: "EduBlay Team 🇬🇭" },
    { quote: "Your success story starts with one study session today.", author: "EduBlay Team 🇬🇭" },
    { quote: "West Africa's smartest students use EduBlay. Are you one of them?", author: "EduBlay Team 🇬🇭" },
];

const REENGAGEMENT_MESSAGES = [
    "📚 You haven't studied in a while! Your notes are waiting for you on EduBlay.",
    "🎯 Your study goals need you! Jump back into EduBlay and keep the streak alive.",
    "🤖 Blay AI is ready to help you ace your next exam. Come back and study smarter!",
    "⏰ Don't let your knowledge fade! EduBlay is here to keep you sharp.",
    "🔥 Your classmates are studying right now. Don't fall behind - open EduBlay!",
    "💡 A quick 15-minute study session today can make all the difference tomorrow.",
    "🌟 The best students show up consistently. EduBlay misses you - come back!",
];

interface EduBlayNotificationsProps {
    userDetails: UserDetails | null;
    addToast: (message: string, type: Toast['type']) => void;
}

const store = {
    get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

const getTodaysQuote = () => {
    const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return MORNING_QUOTES[day % MORNING_QUOTES.length];
};

/* ── Rating Prompt ── */
const RatingPrompt: React.FC<{ userDetails: UserDetails | null; addToast: (m: string, t: Toast['type']) => void; onDismiss: () => void }> = ({ userDetails, addToast, onDismiss }) => {
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);

    const emojis = ['😞','😕','😐','😊','🤩'];
    const labels = ['Poor','Fair','Good','Great','Excellent!'];
    const active = hovered || rating;

    const handleSubmit = async () => {
        if (!rating) { addToast('Please tap a star to rate!', 'warning'); return; }
        if (!userDetails?.id) { addToast('Set up your profile first.', 'error'); return; }
        
        // Optimistically dismiss
        onDismiss();

        try {
            await globalFeedbackService.submitRating(userDetails.id, rating);
            if (comment.trim()) {
                await globalFeedbackService.postComment(userDetails.id, userDetails.name, comment.trim());
            }
            store.set('eb_rated', 'true');
            store.set('eb_rating_dismissed', Date.now().toString());
            addToast('Thank you for rating EduBlay! 🎉', 'success');
        } catch (e: any) {
            console.error('Failed to submit rating', e);
            addToast('Failed to submit rating. Please try again later.', 'error');
        }
    };

    return (
        <div style={{ position:'fixed', inset:0, zIndex:9001, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
            <div style={{ background:'linear-gradient(160deg,#07050f,#1a1200,#07050f)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:28, padding:'2rem', maxWidth:440, width:'100%', boxShadow:'0 0 80px rgba(245,158,11,0.12), 0 32px 64px rgba(0,0,0,0.6)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)', width:280, height:140, borderRadius:'50%', background:'radial-gradient(ellipse,rgba(245,158,11,0.2),transparent 70%)', pointerEvents:'none' }}/>

                <div style={{ textAlign:'center', marginBottom:'1.5rem', position:'relative', zIndex:1 }}>
                    <div style={{ fontSize:52, marginBottom:'0.5rem' }}>⭐</div>
                    <h3 style={{ fontSize:20, fontWeight:900, color:'white', margin:'0 0 0.4rem' }}>Enjoying EduBlay?</h3>
                    <p style={{ fontSize:13, color:'rgba(156,163,175,0.85)', lineHeight:1.5 }}>Your rating helps us grow and serve students across Ghana, West Africa and beyond! 🌍</p>
                </div>

                <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:'0.6rem' }}>
                    {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setRating(s)} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
                            style={{ fontSize:42, background:'none', border:'none', cursor:'pointer', transition:'transform 0.15s ease', transform: active >= s ? 'scale(1.3)' : 'scale(1)', filter: active >= s ? 'none' : 'grayscale(1) opacity(0.35)', padding:0 }}>
                            ⭐
                        </button>
                    ))}
                </div>

                <div style={{ textAlign:'center', height:36, marginBottom:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    {active > 0 && <>
                        <span style={{ fontSize:26 }}>{emojis[active-1]}</span>
                        <span style={{ fontSize:14, fontWeight:800, color:'#fbbf24' }}>{labels[active-1]}</span>
                    </>}
                </div>

                <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="Share your thoughts... (optional — will appear in community feedback)"
                    rows={2}
                    style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'10px 14px', color:'white', fontSize:13, outline:'none', resize:'none', marginBottom:'1rem', boxSizing:'border-box' }}/>

                <div style={{ display:'flex', gap:10 }}>
                    <button onClick={onDismiss} style={{ flex:1, padding:'0.8rem', borderRadius:14, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(156,163,175,0.9)', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                        Maybe Later
                    </button>
                    <button onClick={handleSubmit} disabled={submitting || !rating}
                        style={{ flex:2, padding:'0.8rem', borderRadius:14, background: rating ? 'linear-gradient(135deg,#b45309,#f59e0b)' : '#1f2937', border:'none', color:'white', fontWeight:800, fontSize:14, cursor: rating ? 'pointer' : 'not-allowed', boxShadow: rating ? '0 6px 20px rgba(245,158,11,0.45)' : 'none', transition:'all 0.2s ease' }}>
                        {submitting ? 'Submitting...' : '⭐ Submit Rating'}
                    </button>
                </div>

                <p style={{ textAlign:'center', fontSize:11, color:'rgba(75,85,99,1)', marginTop:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                    Rating saved to EduBlay Community Feedback ✅
                </p>
            </div>
        </div>
    );
};

/* ── Re-engagement Banner ── */
const ReEngagementBanner: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:8999, maxWidth:500, width:'calc(100% - 2rem)' }}>
        <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', border:'1px solid rgba(99,102,241,0.45)', borderRadius:18, padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:12, boxShadow:'0 8px 32px rgba(99,102,241,0.35), 0 20px 48px rgba(0,0,0,0.5)' }}>
            <span style={{ fontSize:26, flexShrink:0 }}>📣</span>
            <p style={{ flex:1, fontSize:13, color:'rgba(209,213,219,0.95)', lineHeight:1.5, margin:0 }}>{message}</p>
            <button onClick={onDismiss} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, cursor:'pointer', color:'rgba(255,255,255,0.7)', padding:'4px 10px', flexShrink:0, fontSize:12, fontWeight:700 }}>✕</button>
        </div>
    </div>
);

/* ── Main Component ── */
const EduBlayNotifications: React.FC<EduBlayNotificationsProps> = ({ userDetails, addToast }) => {
    const [showRating, setShowRating] = useState(false);

    useEffect(() => {
        if (!userDetails) return;
        const now = Date.now();
        const today = new Date().toDateString();

        // Morning quote — show if open, also schedule for tomorrow background!
        if (store.get('eb_quote_day') !== today) {
            setTimeout(() => {
                const quote = getTodaysQuote();
                notificationService.sendNotification("EduBlay Daily Quote", { 
                    body: `${quote.quote}\n— ${quote.author}`,
                    icon: '/favicon.ico'
                });
                store.set('eb_quote_day', today);
            }, 3000);
        }
        
        // Background Schedule: Tomorrow morning's quote at 9:00 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        const tomorrowQuote = MORNING_QUOTES[(Math.floor((tomorrow.getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)) % MORNING_QUOTES.length];
        
        // Schedule it (notificationService manages overriding via ID if we implemented custom tags, but we can just schedule it)
        notificationService.scheduleNotification("EduBlay Daily Quote", {
            body: `${tomorrowQuote.quote}\n— ${tomorrowQuote.author}`,
            tag: `quote-${tomorrow.toDateString()}`
        }, tomorrow.getTime(), `quote-${tomorrow.toDateString()}`);

        store.set('eb_last_active', now.toString());

        // Rating prompt
        if (!store.get('eb_first_open')) store.set('eb_first_open', now.toString());
        const firstOpen = parseInt(store.get('eb_first_open') || now.toString());
        const lastPrompt = parseInt(store.get('eb_rating_dismissed') || '0');
        const alreadyRated = store.get('eb_rated') === 'true';
        
        if (!alreadyRated && (now - firstOpen) > 3 * 86400000 && (now - lastPrompt) > 7 * 86400000) {
            setTimeout(() => setShowRating(true), 8000);
        } else if (!alreadyRated) {
            // Schedule a background rating notification for 3 days from now
            notificationService.scheduleNotification("Enjoying EduBlay?", {
                body: "Tap here to share your feedback and help us grow! ⭐",
                tag: 'rating-prompt'
            }, now + (3 * 24 * 60 * 60 * 1000), 'rating-prompt');
        }
    }, [userDetails]);

    return (
        <>
            {showRating && <RatingPrompt userDetails={userDetails} addToast={addToast} onDismiss={() => { setShowRating(false); store.set('eb_rating_dismissed', Date.now().toString()); }} />}
        </>
    );
};

export default EduBlayNotifications;