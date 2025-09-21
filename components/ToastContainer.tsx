

import React from 'react';
// FIX: Added .ts extension to import path.
import type { Toast as ToastType } from '../types.ts';
import Toast from './Toast.tsx';

interface ToastContainerProps {
    toasts: ToastType[];
    onDismiss: (id: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    return (
        <div className="fixed top-20 right-4 z-[60] space-y-2 no-print">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

export default ToastContainer;