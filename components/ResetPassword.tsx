import React, { useState, useEffect } from 'react';
import { verifyResetCode, confirmPasswordReset } from '../services/authService';

interface ResetPasswordProps {
    onBack: () => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onBack }) => {
    const [password, setPassword] = useState('');
    const [confirmPasswordParam, setConfirmPasswordParam] = useState('');
    const [status, setStatus] = useState<'verifying' | 'ready' | 'success' | 'error' | 'no-code'>('verifying');
    const [errorMessage, setErrorMessage] = useState('');
    const [email, setEmail] = useState('');
    const [oobCode, setOobCode] = useState<string | null>(null);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const code = queryParams.get('oobCode');

        if (!code) {
            setStatus('no-code');
            return;
        }

        setOobCode(code);

        verifyResetCode(code)
            .then((emailParam) => {
                setEmail(emailParam);
                setStatus('ready');
            })
            .catch((error) => {
                setStatus('error');
                setErrorMessage('Password reset code is invalid or has expired.');
                console.error(error);
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirmPasswordParam) {
            setErrorMessage('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            setErrorMessage('Password must be at least 6 characters long');
            return;
        }

        setStatus('verifying'); // use as busy state

        try {
            if (oobCode) {
                await confirmPasswordReset(oobCode, password);
                setStatus('success');
            }
        } catch (error: any) {
            setStatus('error');
            setErrorMessage(error.message || 'Failed to finish password reset.');
        }
    };

    if (status === 'verifying') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100 dark:bg-gray-900">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Verifying link...</p>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100 dark:bg-gray-900">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Password Reset Successfully</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">You can now sign in with your new password.</p>
                    <button 
                        onClick={onBack}
                        className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-full transition-colors"
                    >
                        Return to Sign In
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'no-code') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100 dark:bg-gray-900">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
                    <div className="text-5xl mb-4">🔑</div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Password Reset Link</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm leading-relaxed">
                        If you just reset your password on the secure Firebase page, your new password has been successfully applied and you are ready to sign in!
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-xs leading-relaxed">
                        Otherwise, if you want to reset your password, please make sure to click the full link sent to your email.
                    </p>
                    <button 
                        onClick={onBack}
                        className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-full transition-colors"
                    >
                        Return to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100 dark:bg-gray-900">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2 text-center">Reset Password</h2>
                
                {status === 'error' ? (
                    <div className="text-center">
                        <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-6 text-sm">
                            {errorMessage}
                        </div>
                        <button 
                            onClick={onBack}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-full transition-colors"
                        >
                            Return to Sign In
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-gray-600 dark:text-gray-300 text-center text-sm mb-6">
                            Resetting password for: <strong className="block mt-1">{email}</strong>
                        </p>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setErrorMessage('');
                                    }}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                                    placeholder="Enter new password"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPasswordParam}
                                    onChange={(e) => {
                                        setConfirmPasswordParam(e.target.value);
                                        setErrorMessage('');
                                    }}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                                    placeholder="Confirm new password"
                                    required
                                />
                            </div>
                            
                            {errorMessage && (
                                <p className="text-red-500 text-xs font-semibold text-center">{errorMessage}</p>
                            )}
                            
                            <button 
                                type="submit"
                                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold flex items-center justify-center h-12 rounded-full transition-colors mt-2 shadow-md hover:shadow-lg"
                            >
                                Update Password
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
