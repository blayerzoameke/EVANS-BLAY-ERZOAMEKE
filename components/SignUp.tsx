import React, { useState } from 'react';
import type { UserDetails } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { signUp, login, resetPassword, getUserRecoveryData, signInWithGoogle } from '../services/authService';
import { EyeIcon } from './icons/EyeIcon';
import { EyeOffIcon } from './icons/EyeOffIcon';
import { GoogleIcon } from './icons/GoogleIcon';

interface SignUpProps {
    onLogin: (user: UserDetails) => void;
}

const recoveryQuestions = ["recovery.q1","recovery.q2","recovery.q3","recovery.q4","recovery.q5"];

const Spinner: React.FC<{dark?: boolean}> = ({dark}) => (
    <div className={`w-5 h-5 border-2 ${dark?'border-[#070d18]':'border-white'} border-t-transparent rounded-full animate-spin inline-block`} />
);

// ── FORGOT PASSWORD — 3-step wizard (kept from previous design) ─────────
type ForgotStep = 'email' | 'security' | 'sending' | 'done' | 'no-account' | 'skip-to-email';

const ForgotPasswordWizard: React.FC<{
    onBack: () => void;
    onCreateAccount: () => void;
    t: (key: string, vars?: any) => string;
}> = ({ onBack, onCreateAccount, t }) => {
    const [step, setStep] = useState<ForgotStep>('email');
    const [email, setEmail] = useState('');
    const [emailBusy, setEmailBusy] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [recoveryQ, setRecoveryQ] = useState('');
    const [correctQuestion, setCorrectQuestion] = useState('');
    const [answerInput, setAnswerInput] = useState('');
    const [answerError, setAnswerError] = useState('');
    const [answerBusy, setAnswerBusy] = useState(false);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [sendBusy, setSendBusy] = useState(false);
    const [sendError, setSendError] = useState('');

    const inputCls = "w-full h-[55px] px-5 rounded-full bg-gray-100 text-gray-800 text-sm font-medium placeholder-gray-400 outline-none focus:bg-gray-200 focus:ring-2 focus:ring-[#667eea] transition";

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Please enter a valid email address.'); return; }
        setEmailError(''); setEmailBusy(true);
        try {
            const result = await getUserRecoveryData(email);
            if (result === 'unknown') setStep('skip-to-email');
            else if (!result.exists) setStep('no-account');
            else if (result.recoveryQuestion && result.recoveryAnswer) {
                setRecoveryQ(result.recoveryQuestion);
                setCorrectQuestion(result.recoveryQuestion);
                setCorrectAnswer(result.recoveryAnswer.trim().toLowerCase());
                setStep('security');
            } else setStep('skip-to-email');
        } catch { setStep('skip-to-email'); }
        finally { setEmailBusy(false); }
    };

    const handleAnswerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!answerInput.trim()) { setAnswerError('Please enter your answer.'); return; }
        setAnswerBusy(true);
        await new Promise(r => setTimeout(r, 500));
        if (recoveryQ === correctQuestion && answerInput.trim().toLowerCase() === correctAnswer) {
            setAnswerError(''); setStep('sending'); await sendResetLink();
        } else {
            setAnswerError("That question and answer sequence does not match our records. Check spelling or skip below.");
        }
        setAnswerBusy(false);
    };

    const sendResetLink = async () => {
        setSendBusy(true); setSendError('');
        try { await resetPassword(email); setStep('done'); }
        catch { setSendError('Something went wrong. Please try again.'); }
        finally { setSendBusy(false); }
    };

    const btnCls = "w-full h-[49px] rounded-full bg-[#667eea] hover:bg-[#5568d3] text-white font-semibold uppercase text-sm transition shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2";

    return (
        <div className="w-full max-w-md mx-auto p-6 sm:p-10 bg-white rounded-3xl shadow-2xl">
            <button onClick={onBack} className="text-xs text-gray-500 hover:text-[#667eea] font-bold mb-4">← Back to Sign In</button>

            {step === 'email' && (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <h2 className="text-3xl font-bold text-gray-800">Forgot password?</h2>
                    <p className="text-sm text-gray-500">Enter your email to get started.</p>
                    <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setEmailError('');}} placeholder="your@email.com" className={inputCls} autoComplete="email" />
                    {emailError && <p className="text-red-500 text-xs font-semibold">⚠ {emailError}</p>}
                    <button type="submit" disabled={emailBusy} className={btnCls}>{emailBusy ? <Spinner/> : 'Continue →'}</button>
                </form>
            )}

            {step === 'security' && (
                <form onSubmit={handleAnswerSubmit} className="space-y-4">
                    <h2 className="text-3xl font-bold text-gray-800">Security check</h2>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-2xl text-xs">
                        <p className="font-bold text-green-700">✓ Account found</p>
                        <p className="text-gray-600">{email}</p>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                        <label htmlFor="forgotRecoveryQ" className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Your security question</label>
                        <select
                            id="forgotRecoveryQ"
                            value={recoveryQ}
                            onChange={(e) => {
                                setRecoveryQ(e.target.value);
                                setAnswerError('');
                            }}
                            className="w-full bg-white text-gray-800 text-sm font-semibold border border-gray-300 rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#667eea]"
                        >
                            {recoveryQuestions.map(q => (
                                <option key={q} value={q}>{t(q as any)}</option>
                            ))}
                        </select>
                    </div>
                    <input type="text" value={answerInput} onChange={e=>{setAnswerInput(e.target.value);setAnswerError('');}} placeholder="Your answer" className={inputCls} autoComplete="off"/>
                    {answerError && <p className="text-red-500 text-xs font-semibold">⚠ {answerError}</p>}
                    <button type="submit" disabled={answerBusy} className={btnCls}>{answerBusy ? <Spinner/> : 'Verify →'}</button>
                    <button type="button" onClick={()=>setStep('skip-to-email')} className="w-full text-xs text-gray-500 hover:text-[#667eea] font-semibold">Forgot my answer — skip</button>
                </form>
            )}

            {(step === 'skip-to-email' || step === 'sending') && (
                <div className="space-y-4">
                    <h2 className="text-3xl font-bold text-gray-800">Send reset link</h2>
                    <p className="text-sm text-gray-500">We'll email a password reset link to:</p>
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800">{email}</div>
                    {sendError && <p className="text-red-500 text-xs font-semibold">⚠ {sendError}</p>}
                    <button onClick={sendResetLink} disabled={sendBusy} className={btnCls}>{sendBusy ? <Spinner/> : 'Send Reset Link →'}</button>
                </div>
            )}

            {step === 'done' && (
                <div className="space-y-4 text-center">
                    <div className="text-5xl">📬</div>
                    <h2 className="text-2xl font-bold text-gray-800">Check your inbox!</h2>
                    <p className="text-sm text-gray-500">If <span className="font-bold text-gray-800">{email}</span> has an EduBlay account, a reset link has been sent.</p>
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-gray-700">
                        <p className="font-bold text-amber-700 mb-1">⚠️ Can't find it?</p>
                        <p>Check spam, search for "EduBlay" or "noreply@". Link expires in 1 hour.</p>
                    </div>
                    <button onClick={()=>{setStep('email');}} className={btnCls}>Resend</button>
                </div>
            )}

            {step === 'no-account' && (
                <div className="space-y-4 text-center">
                    <div className="text-5xl">🔍</div>
                    <h2 className="text-2xl font-bold text-gray-800">No account found</h2>
                    <p className="text-sm text-gray-500">No EduBlay account is linked to <span className="font-bold text-gray-800">{email}</span>.</p>
                    <button onClick={onCreateAccount} className={btnCls}>🚀 Create Free Account</button>
                    <button onClick={()=>{setStep('email');setEmail('');}} className="w-full text-xs text-gray-500 hover:text-[#667eea] font-semibold">Try a different email</button>
                </div>
            )}
        </div>
    );
};

// ── Main SignUp component ──────────────────────────────────────────────
const SignUp: React.FC<SignUpProps> = ({ onLogin }) => {
    const { t } = useLanguage();
    const [viewMode, setViewMode] = useState<'auth'|'forgotPassword'>('auth');
    const [isSignUp, setIsSignUp] = useState(false);
    const [formData, setFormData] = useState({
        name:'', email:'', password:'', confirmPassword:'',
        recoveryQuestion: recoveryQuestions[0], recoveryAnswer:''
    });
    const [showPw, setShowPw] = useState(false);
    const [showCPw, setShowCPw] = useState(false);
    const [errors, setErrors] = useState<Partial<typeof formData> & { general?: string }>({});
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const change = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(p => ({ ...p, [name]: value }));
        setErrors(p => ({ ...p, [name]: undefined, general: undefined }));
        setMessage('');
    };

    const validate = (mode: 'signIn'|'signUp') => {
        const errs: Partial<typeof formData> = {};
        if (mode === 'signUp') {
            if (!formData.name.trim()) errs.name = t('validation.nameRequired');
            if (!formData.recoveryAnswer.trim()) errs.recoveryAnswer = t('validation.recoveryARequired');
        }
        if (!formData.email.trim()) errs.email = t('validation.emailRequired');
        else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = t('validation.emailInvalid');
        if (!formData.password) errs.password = t('validation.passwordRequired');
        else if (mode === 'signUp' && formData.password.length < 6) errs.password = t('validation.passwordMinLength');
        if (mode === 'signUp' && formData.password !== formData.confirmPassword) errs.confirmPassword = t('validation.passwordMismatch');
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const submit = (mode: 'signIn'|'signUp') => async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate(mode)) return;
        setBusy(true); setErrors({}); setMessage('');
        try {
            if (mode === 'signUp') {
                const user = await signUp(formData.name, formData.email, formData.password, formData.recoveryQuestion, formData.recoveryAnswer);
                setMessage(t('auth.signupSuccess'));
                setTimeout(() => onLogin(user), 800);
            } else {
                const user = await login(formData.email, formData.password);
                setMessage(t('auth.loginSuccess'));
                setTimeout(() => onLogin(user), 400);
            }
        } catch (err: any) {
            const msg = (err.message||'').toLowerCase();
            const code = (err.code||'').toLowerCase();
            if (mode==='signUp' && (msg.includes('email already registered')||code.includes('email-already-in-use'))) {
                setErrors({ email: t('validation.emailExists') }); setBusy(false); return;
            }
            const isAuth = msg.includes('invalid email or password')||code.includes('invalid-credential')||
                code.includes('user-not-found')||code.includes('wrong-password')||code.includes('invalid-login-credentials');
            setErrors({ general: isAuth ? t('validation.loginFailed') : (err.message||'Unexpected error.') });
        } finally { setBusy(false); }
    };

    const handleGoogleSignIn = () => {
        if (busy) return;
        setBusy(true); 
        setErrors({}); 
        setMessage('');
        
        signInWithGoogle().then(user => {
            setMessage(t('auth.loginSuccess') || 'Signed in with Google');
            setTimeout(() => onLogin(user), 300);
        }).catch((err: any) => {
            setBusy(false);
            if (err?.message === 'redirecting') return; 
            const code = (err?.code || '').toLowerCase();
            if (code.includes('popup-closed') || code.includes('cancelled')) {
                return;
            }
            setErrors({ general: err?.message || 'Google sign-in failed.' });
        });
    };

    const GoogleAuthButton: React.FC<{ label: string }> = ({ label }) => (
        <button type="button" onClick={handleGoogleSignIn} disabled={busy} aria-label={label} className="w-full max-w-[380px] h-[49px] rounded-full border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:border-[#764ba2] hover:-translate-y-0.5 hover:shadow-md transition flex items-center justify-center gap-3 disabled:opacity-60">
            <GoogleIcon className="w-5 h-5"/>
            {busy ? <Spinner dark/> : label}
        </button>
    );

    if (viewMode === 'forgotPassword') {
        return (
            <div style={{background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}} className="min-h-screen flex items-center justify-center p-5">
                <ForgotPasswordWizard
                    onBack={() => setViewMode('auth')}
                    onCreateAccount={() => { setViewMode('auth'); setIsSignUp(true); }}
                    t={t}
                />
            </div>
        );
    }

    const inputField = "w-full h-full bg-transparent outline-none border-none text-gray-800 text-[15px] font-medium placeholder:text-gray-400";
    const fieldWrap = "max-w-[380px] w-full bg-gray-100 my-2.5 h-[55px] rounded-full grid grid-cols-[15%_85%] px-1.5 relative transition focus-within:bg-gray-200 focus-within:ring-2 focus-within:ring-[#667eea]";
    const iconCell = "text-center leading-[55px] text-gray-500 text-lg flex items-center justify-center";

    return (
        <>
            <style>{`
                .eb-container {
                    position: relative;
                    width: 100%;
                    max-width: 900px;
                    height: 600px;
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 25px 50px rgba(0,0,0,.2);
                    overflow: hidden;
                }
                .eb-container:before {
                    content: "";
                    position: absolute;
                    height: 2000px;
                    width: 2000px;
                    top: -10%;
                    right: 48%;
                    transform: translateY(-50%);
                    background: linear-gradient(-45deg, #667eea 0%, #764ba2 100%);
                    transition: 1.8s ease-in-out;
                    border-radius: 50%;
                    z-index: 6;
                }
                .eb-forms-container { position: absolute; inset: 0; }
                .eb-signin-signup {
                    position: absolute; top: 50%; left: 75%;
                    transform: translate(-50%, -50%);
                    width: 50%;
                    display: grid; grid-template-columns: 1fr;
                    z-index: 5;
                    transition: 1s 0.7s ease-in-out;
                }
                .eb-form {
                    display: flex; align-items: center; justify-content: center;
                    flex-direction: column;
                    padding: 0 2.5rem;
                    transition: all 0.2s 0.7s;
                    overflow: hidden;
                    grid-column: 1 / 2; grid-row: 1 / 2;
                    overflow-y: auto;
                    max-height: 580px;
                }
                .eb-sign-up-form { opacity: 0; z-index: 1; }
                .eb-sign-in-form { z-index: 2; }
                .eb-panels-container {
                    position: absolute; inset: 0;
                    display: grid; grid-template-columns: repeat(2, 1fr);
                }
                .eb-panel {
                    display: flex; flex-direction: column;
                    align-items: flex-end; justify-content: space-around;
                    text-align: center; z-index: 6;
                }
                .eb-left-panel { pointer-events: all; padding: 3rem 17% 2rem 12%; }
                .eb-right-panel { pointer-events: none; padding: 3rem 12% 2rem 17%; }
                .eb-panel .eb-content { color: #fff; transition: transform .9s ease-in-out; transition-delay: .6s; }
                .eb-right-panel .eb-content { transform: translateX(800px); }

                .eb-container.eb-sign-up-mode:before {
                    transform: translate(100%, -50%); right: 52%;
                }
                .eb-container.eb-sign-up-mode .eb-left-panel .eb-content { transform: translateX(-800px); }
                .eb-container.eb-sign-up-mode .eb-signin-signup { left: 25%; }
                .eb-container.eb-sign-up-mode .eb-sign-up-form { opacity: 1; z-index: 2; }
                .eb-container.eb-sign-up-mode .eb-sign-in-form { opacity: 0; z-index: 1; }
                .eb-container.eb-sign-up-mode .eb-right-panel .eb-content { transform: translateX(0%); }
                .eb-container.eb-sign-up-mode .eb-left-panel { pointer-events: none; }
                .eb-container.eb-sign-up-mode .eb-right-panel { pointer-events: all; }

                .eb-btn-transparent {
                    background: transparent; border: 2px solid #fff;
                    width: 130px; height: 41px; border-radius: 41px;
                    color: #fff; font-weight: 600; font-size: .8rem;
                    text-transform: uppercase; cursor: pointer; transition: .3s;
                }
                .eb-btn-transparent:hover { background: rgba(255,255,255,.12); transform: translateY(-2px); }

                @media (max-width: 870px) {
                    .eb-container { min-height: 100dvh; height: auto; max-width: 100%; border-radius: 0; overflow: auto; box-shadow: none; display: flex; flex-direction: column; }
                    .eb-container:before, .eb-container.eb-sign-up-mode:before { content: none !important; display: none !important; }
                    
                    .eb-panels-container { position: relative; inset: auto; display: flex; order: 1; flex-shrink: 0; grid-template-columns: unset; grid-template-rows: unset; background: linear-gradient(-45deg, #667eea 0%, #764ba2 100%); }
                    .eb-panel { flex-direction: column; justify-content: center; align-items: center; padding: 2.5rem 1.5rem; text-align: center; }
                    .eb-panel .eb-content { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; transform: none !important; transition: none; }
                    .eb-right-panel .eb-content { transform: none !important; }
                    .eb-container.eb-sign-up-mode .eb-left-panel .eb-content { transform: none !important; }
                    .eb-container.eb-sign-up-mode .eb-right-panel .eb-content { transform: none !important; }
                    
                    /* Left panel is shown during sign-in, Right panel during sign-up */
                    .eb-left-panel { display: flex !important; pointer-events: all !important; width: 100%; }
                    .eb-right-panel { display: none !important; pointer-events: none !important; width: 100%; }
                    .eb-container.eb-sign-up-mode .eb-left-panel { display: none !important; pointer-events: none !important; }
                    .eb-container.eb-sign-up-mode .eb-right-panel { display: flex !important; pointer-events: all !important; }
                    
                    .eb-forms-container { position: relative; inset: auto; order: 2; flex: 1; display: flex; flex-direction: column; }
                    .eb-signin-signup { position: relative; top: auto; left: auto; transform: none; width: 100%; transition: none; flex: 1; display: flex; flex-direction: column; }
                    .eb-container.eb-sign-up-mode .eb-signin-signup { left: auto; top: auto; transform: none; }
                    
                    .eb-form { padding: 2rem 1.5rem; max-height: none; overflow: visible; width: 100%; flex: 1; justify-content: flex-start; }
                    
                    .eb-sign-in-form { display: flex; opacity: 1; z-index: 2; }
                    .eb-sign-up-form { display: none; opacity: 0; z-index: 1; }
                    .eb-container.eb-sign-up-mode .eb-sign-up-form { display: flex; opacity: 1; z-index: 2; }
                    .eb-container.eb-sign-up-mode .eb-sign-in-form { display: none; opacity: 0; z-index: 1; }
                    
                    .eb-form { padding-bottom: max(2rem, calc(env(safe-area-inset-bottom) + 1rem)); }
                }
                /* Google button separator */
                .eb-google-divider { display: flex; align-items: center; gap: 12px; margin: 10px 0 6px; width: 100%; max-width: 380px; }
                .eb-google-divider::before, .eb-google-divider::after { content: ""; flex: 1; height: 1px; background: #e5e7eb; }
                .eb-google-divider span { font-size: 12px; color: #9ca3af; white-space: nowrap; }
            `}</style>

            <div style={{background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily:'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'}} className="min-h-screen flex items-center justify-center p-5">
                <div className={`eb-container ${isSignUp ? 'eb-sign-up-mode' : ''}`}>
                    <div className="eb-forms-container">
                        <div className="eb-signin-signup">

                            {/* ── SIGN IN FORM ── */}
                            <form className="eb-form eb-sign-in-form" onSubmit={submit('signIn')}>
                                <h2 className="text-[2.2rem] font-bold text-gray-700 mb-2">Sign in</h2>

                                <div className={fieldWrap}>
                                    <div className={iconCell}>📧</div>
                                    <input type="email" name="email" value={formData.email} onChange={change} placeholder="Email" className={inputField} autoComplete="email"/>
                                </div>
                                {errors.email && <p className="text-red-500 text-xs font-semibold w-full max-w-[380px] px-2">⚠ {errors.email}</p>}

                                <div className={fieldWrap}>
                                    <div className={iconCell}>🔒</div>
                                    <input type={showPw?'text':'password'} name="password" value={formData.password} onChange={change} placeholder="Password" className={inputField + ' pr-10'} autoComplete="current-password"/>
                                    <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#667eea]">
                                        {showPw ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                                    </button>
                                </div>
                                {errors.password && <p className="text-red-500 text-xs font-semibold w-full max-w-[380px] px-2">⚠ {errors.password}</p>}

                                <button type="button" onClick={()=>setViewMode('forgotPassword')} className="self-end mr-[max(0px,calc((100%-380px)/2))] text-xs text-gray-500 hover:text-[#667eea] font-semibold mt-1 mb-1">
                                    {t('recovery.forgot')}
                                </button>

                                {errors.general && <p className="text-red-500 text-sm font-medium text-center max-w-[380px]">{errors.general}</p>}
                                {message && <p className="text-green-600 text-sm font-medium text-center max-w-[380px]">✓ {message}</p>}

                                <button type="submit" disabled={busy} className="w-[150px] h-[49px] mt-3 bg-[#667eea] hover:bg-[#5568d3] text-white uppercase font-semibold text-sm rounded-[49px] transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 flex items-center justify-center">
                                    {busy ? <Spinner/> : 'Sign In'}
                                </button>

                                <div className="eb-google-divider"><span>or continue with</span></div>
                                <GoogleAuthButton label="Sign in with Google" />
                                <div style={{height:'max(16px,env(safe-area-inset-bottom,16px))'}}/>

                            </form>

                            {/* ── SIGN UP FORM ── */}
                            <form className="eb-form eb-sign-up-form" onSubmit={submit('signUp')}>
                                <h2 className="text-[2.2rem] font-bold text-gray-700 mb-2">Sign up</h2>

                                <div className={fieldWrap}>
                                    <div className={iconCell}>👤</div>
                                    <input type="text" name="name" value={formData.name} onChange={change} placeholder="Full name" className={inputField} autoComplete="name"/>
                                </div>
                                {errors.name && <p className="text-red-500 text-xs font-semibold w-full max-w-[380px] px-2">⚠ {errors.name}</p>}

                                <div className={fieldWrap}>
                                    <div className={iconCell}>📧</div>
                                    <input type="email" name="email" value={formData.email} onChange={change} placeholder="Email" className={inputField} autoComplete="email"/>
                                </div>
                                {errors.email && <p className="text-red-500 text-xs font-semibold w-full max-w-[380px] px-2">⚠ {errors.email}</p>}

                                <div className={fieldWrap}>
                                    <div className={iconCell}>🔒</div>
                                    <input type={showPw?'text':'password'} name="password" value={formData.password} onChange={change} placeholder="Password" className={inputField + ' pr-10'} autoComplete="new-password"/>
                                    <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#667eea]">
                                        {showPw ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                                    </button>
                                </div>
                                {errors.password && <p className="text-red-500 text-xs font-semibold w-full max-w-[380px] px-2">⚠ {errors.password}</p>}

                                <div className={fieldWrap}>
                                    <div className={iconCell}>🔒</div>
                                    <input type={showCPw?'text':'password'} name="confirmPassword" value={formData.confirmPassword} onChange={change} placeholder="Confirm password" className={inputField + ' pr-10'} autoComplete="new-password"/>
                                    <button type="button" onClick={()=>setShowCPw(!showCPw)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#667eea]">
                                        {showCPw ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                                    </button>
                                </div>
                                {errors.confirmPassword && <p className="text-red-500 text-xs font-semibold w-full max-w-[380px] px-2">⚠ {errors.confirmPassword}</p>}

                                <div className={fieldWrap}>
                                    <div className={iconCell}>❓</div>
                                    <select name="recoveryQuestion" value={formData.recoveryQuestion} onChange={change} className={inputField + ' pr-2 cursor-pointer'}>
                                        {recoveryQuestions.map(q=><option key={q} value={q}>{t(q as any)}</option>)}
                                    </select>
                                </div>

                                <div className={fieldWrap}>
                                    <div className={iconCell}>✏️</div>
                                    <input type="text" name="recoveryAnswer" value={formData.recoveryAnswer} onChange={change} placeholder={t('recovery.answer')} className={inputField}/>
                                </div>
                                {errors.recoveryAnswer && <p className="text-red-500 text-xs font-semibold w-full max-w-[380px] px-2">⚠ {errors.recoveryAnswer}</p>}

                                {errors.general && <p className="text-red-500 text-sm font-medium text-center max-w-[380px] mt-2">{errors.general}</p>}
                                {message && <p className="text-green-600 text-sm font-medium text-center max-w-[380px] mt-2">✓ {message}</p>}

                                <button type="submit" disabled={busy} className="w-[150px] h-[49px] mt-3 bg-[#667eea] hover:bg-[#5568d3] text-white uppercase font-semibold text-sm rounded-[49px] transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 flex items-center justify-center">
                                    {busy ? <Spinner/> : 'Sign Up'}
                                </button>
                                <div className="eb-google-divider"><span>or continue with</span></div>
                                <GoogleAuthButton label="Sign up with Google" />
                                <div style={{height:'max(24px,env(safe-area-inset-bottom,24px))'}}/>
                            </form>
                        </div>
                    </div>

                    {/* ── PANELS ── */}
                    <div className="eb-panels-container">
                        <div className="eb-panel eb-left-panel">
                            <div className="eb-content">
                                <img src="/edublay-logo.png" alt="EduBlay" className="w-20 h-20 mx-auto mb-3 rounded-2xl shadow-lg object-cover"/>
                                <h3 className="font-semibold text-2xl mb-2">New here?</h3>
                                <p className="text-sm py-2 leading-relaxed">Join EduBlay today and discover a world of learning possibilities. Create your account in seconds!</p>
                                <button type="button" className="eb-btn-transparent mt-2" onClick={()=>setIsSignUp(true)}>
                                    SIGN UP
                                </button>
                            </div>
                        </div>

                        <div className="eb-panel eb-right-panel">
                            <div className="eb-content">
                                <img src="/edublay-logo.png" alt="EduBlay" className="w-20 h-20 mx-auto mb-3 rounded-2xl shadow-lg object-cover"/>
                                <h3 className="font-semibold text-2xl mb-2">Welcome back!</h3>
                                <p className="text-sm py-2 leading-relaxed">Sign in to continue your learning journey with EduBlay.</p>
                                <button type="button" className="eb-btn-transparent mt-2" onClick={()=>setIsSignUp(false)}>
                                    SIGN IN
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SignUp;