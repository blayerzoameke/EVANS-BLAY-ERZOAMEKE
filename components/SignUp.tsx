import React, { useState } from 'react';
import type { UserDetails } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { signUp, login, findUserByEmail, verifyRecoveryAnswer, resetPassword } from '../src/services/authService';
import { EyeIcon } from './icons/EyeIcon';
import { EyeOffIcon } from './icons/EyeOffIcon';

interface SignUpProps {
    onLogin: (user: UserDetails) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
);

const recoveryQuestions = [
    "recovery.q1",
    "recovery.q2",
    "recovery.q3",
    "recovery.q4",
    "recovery.q5",
];

const SignUp: React.FC<SignUpProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'signIn' | 'signUp' | 'forgotPassword'>('signIn');
  const [resetStep, setResetStep] = useState(1);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    recoveryQuestion: recoveryQuestions[0],
    recoveryAnswer: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<typeof formData> & { general?: string }>({});
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
    setErrors(prev => ({...prev, general: undefined}));
    setMessage('');
  };

  const validate = () => {
    const newErrors: Partial<typeof formData> = {};
    if (viewMode === 'signUp') {
        if (!formData.name.trim()) newErrors.name = t('validation.nameRequired');
        if (!formData.recoveryQuestion) newErrors.recoveryQuestion = t('validation.recoveryQRequired');
        if (!formData.recoveryAnswer.trim()) newErrors.recoveryAnswer = t('validation.recoveryARequired');
    }
    if (viewMode === 'signUp' || viewMode === 'signIn') {
        if (!formData.email.trim()) newErrors.email = t('validation.emailRequired');
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = t('validation.emailInvalid');
        if (!formData.password) newErrors.password = t('validation.passwordRequired');
        else if (viewMode === 'signUp' && formData.password.length < 6) newErrors.password = t('validation.passwordMinLength');
        if (viewMode === 'signUp' && formData.password !== formData.confirmPassword) newErrors.confirmPassword = t('validation.passwordMismatch');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsSubmitting(true);
    setErrors({});
    setMessage('');

    try {
        if (viewMode === 'signUp') {
            const user = await signUp(formData.name, formData.email, formData.password, formData.recoveryQuestion, formData.recoveryAnswer);
            setMessage(t('auth.signupSuccess'));
            setTimeout(() => onLogin(user), 500);
        } else { // signIn
            const user = await login(formData.email, formData.password);
            setMessage(t('auth.loginSuccess'));
            setTimeout(() => onLogin(user), 500);
        }
    } catch (error: any) {
        if (error.message.toLowerCase().includes('email already registered')) {
            setErrors({ email: t('validation.emailExists') });
        } else if (error.message.toLowerCase().includes('invalid email or password')) {
            setErrors({ general: t('validation.loginFailed') });
        } else {
            setErrors({ general: error.message });
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    setMessage('');

    try {
        if (resetStep === 1) {
            const userExists = await findUserByEmail(formData.email);
            if (userExists) {
                setResetStep(2);
            } else {
                setErrors({ email: t('validation.userNotFound') });
            }
        } else if (resetStep === 2) {
            const isCorrect = await verifyRecoveryAnswer(formData.email, formData.recoveryQuestion, formData.recoveryAnswer);
            if (isCorrect) {
                setResetStep(3);
            } else {
                setErrors({ recoveryAnswer: t('validation.recoveryAIncorrect') });
            }
        } else if (resetStep === 3) {
            if (formData.password.length < 6) {
                 setErrors({ password: t('validation.passwordMinLength') });
                 setIsSubmitting(false);
                 return;
            }
            if (formData.password !== formData.confirmPassword) {
                setErrors({ confirmPassword: t('validation.passwordMismatch') });
                setIsSubmitting(false);
                return;
            }
            const success = await resetPassword(formData.email, formData.password);
            if (success) {
                setMessage(t('recovery.success'));
                setViewMode('signIn');
                setResetStep(1);
                setFormData({ name: '', email: '', password: '', confirmPassword: '', recoveryQuestion: recoveryQuestions[0], recoveryAnswer: '' });
            } else {
                setErrors({ general: t('recovery.error') });
            }
        }
    } catch (error: any) {
         setErrors({ general: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    const inputClasses = (field: keyof typeof errors) => `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-black ${errors[field] ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-primary'}`;

    if (viewMode === 'forgotPassword') {
        return (
            <div className="space-y-6">
                <div><h2 className="text-center text-3xl font-extrabold">{t('recovery.title')}</h2></div>
                <form onSubmit={handlePasswordReset} className="space-y-4 pt-8">
                    {resetStep === 1 && (
                        <>
                            <p className="text-center text-sm text-gray-600 dark:text-gray-400">{t('recovery.step1.prompt')}</p>
                            <div><label className="sr-only">{t('auth.email')}</label><input type="email" name="email" value={formData.email} onChange={handleInputChange} className={inputClasses('email')} placeholder="evans@example.com" required />{errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}</div>
                        </>
                    )}
                    {resetStep === 2 && (
                        <>
                            <p className="text-center text-sm text-gray-600 dark:text-gray-400">{t('recovery.step2.prompt')}</p>
                            <div><label htmlFor="recoveryQuestion" className="sr-only">{t('recovery.question')}</label><select name="recoveryQuestion" value={formData.recoveryQuestion} onChange={handleInputChange} className={inputClasses('recoveryQuestion')}>{recoveryQuestions.map(q => <option key={q} value={q}>{t(q as any)}</option>)}</select></div>
                            <div><label className="sr-only">{t('recovery.answer')}</label><input type="text" name="recoveryAnswer" value={formData.recoveryAnswer} onChange={handleInputChange} className={inputClasses('recoveryAnswer')} placeholder={t('recovery.answer')} required />{errors.recoveryAnswer && <p className="text-red-500 text-xs mt-1">{errors.recoveryAnswer}</p>}</div>
                        </>
                    )}
                    {resetStep === 3 && (
                        <>
                            <p className="text-center text-sm text-gray-600 dark:text-gray-400">{t('recovery.step3.prompt')}</p>
                            <div className="relative"><label className="sr-only">{t('recovery.newPassword')}</label><input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} className={inputClasses('password')} placeholder={t('recovery.newPassword')} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">{showPassword ? <EyeOffIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5"/>}</button></div>{errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                            <div><label className="sr-only">{t('auth.confirmPassword')}</label><input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className={inputClasses('confirmPassword')} placeholder={t('auth.confirmPassword')} />{errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}</div>
                        </>
                    )}
                    <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50">
                        {isSubmitting ? <LoadingSpinner /> : t('common.proceed')}
                    </button>
                    {errors.general && <p className="text-red-500 text-sm mt-2 text-center">{errors.general}</p>}
                </form>
                <div className="text-sm text-center">
                    <button onClick={() => { setViewMode('signIn'); setResetStep(1); }} className="font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary">{t('recovery.backToLogin')}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
             <div><h2 className="mt-6 text-center text-3xl font-extrabold">{viewMode === 'signUp' ? t('auth.createAccount') : t('auth.signInToEduBlay')}</h2></div>
             {message && <p className="text-green-500 text-center">{message}</p>}
             <form onSubmit={handleSubmit} className="space-y-4 pt-8">
                {viewMode === 'signUp' && (
                    <>
                        <div><label className="sr-only">{t('auth.fullName')}</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} className={inputClasses('name')} placeholder={t('auth.fullName')} />{errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}</div>
                    </>
                )}
                <div><label className="sr-only">{t('auth.email')}</label><input type="email" name="email" value={formData.email} onChange={handleInputChange} className={inputClasses('email')} placeholder="evans@example.com" required />{errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}</div>
                <div className="relative"><label className="sr-only">{t('auth.password')}</label><input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} className={inputClasses('password')} placeholder={t('auth.password')} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">{showPassword ? <EyeOffIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5"/>}</button></div>{errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                 {viewMode === 'signUp' && (
                    <>
                    <div><label className="sr-only">{t('auth.confirmPassword')}</label><input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className={inputClasses('confirmPassword')} placeholder={t('auth.confirmPassword')} />{errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}</div>
                    <div className="pt-2"><label htmlFor="recoveryQuestion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('recovery.question')}</label><select name="recoveryQuestion" value={formData.recoveryQuestion} onChange={handleInputChange} className={inputClasses('recoveryQuestion')}>{recoveryQuestions.map(q => <option key={q} value={q}>{t(q as any)}</option>)}</select></div>
                    <div><label className="sr-only">{t('recovery.answer')}</label><input type="text" name="recoveryAnswer" value={formData.recoveryAnswer} onChange={handleInputChange} className={inputClasses('recoveryAnswer')} placeholder={t('recovery.answer')} required />{errors.recoveryAnswer && <p className="text-red-500 text-xs mt-1">{errors.recoveryAnswer}</p>}</div>
                    </>
                )}
                {viewMode === 'signIn' && (
                    <div className="text-right text-sm"><button type="button" onClick={() => setViewMode('forgotPassword')} className="font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary">{t('recovery.forgot')}</button></div>
                )}
                <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50">
                     {isSubmitting ? <LoadingSpinner /> : (viewMode === 'signUp' ? t('auth.signUp') : t('auth.signIn'))}
                </button>
                {errors.general && <p className="text-red-500 text-sm mt-2 text-center">{errors.general}</p>}
            </form>

            <div className="text-sm text-center">
                {viewMode === 'signUp' ? t('auth.alreadyAccount') : t('auth.needAnAccount')}{' '}
                <button onClick={() => { setViewMode(viewMode === 'signUp' ? 'signIn' : 'signUp'); setErrors({}); setMessage(''); }} className="font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary">
                  {viewMode === 'signUp' ? t('auth.signIn') : t('auth.signUpWithEmail')}
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {renderContent()}
      </div>
    </div>
  );
};

export default SignUp;