import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon';
import { CameraIcon } from './icons/CameraIcon';

interface CameraCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (imageDataUrl: string) => void;
}

const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ isOpen, onClose, onCapture }) => {
    const { t } = useLanguage();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setCameraError(null);
            const startCamera = async () => {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        setCameraError(t('cameraModal.error.notSupported'));
                        return;
                    }
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err: any) {
                    console.error("Error accessing camera:", err);
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        setCameraError(t('cameraModal.error.permissionDenied'));
                    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                         setCameraError(t('cameraModal.error.noCamera'));
                    } else {
                        setCameraError(t('cameraModal.error.generic'));
                    }
                }
            };
            startCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isOpen, onClose, stopCamera, t]);

    const handleCapture = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1920;
            let width = videoRef.current.videoWidth;
            let height = videoRef.current.videoHeight;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                onCapture(dataUrl);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{t('cameraModal.title')}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 relative bg-black rounded-md">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-md"></video>
                    {cameraError && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-4">
                            <CameraIcon className="w-12 h-12 text-red-500 mb-4" />
                            <p className="text-white font-semibold">{t('cameraModal.error.title')}</p>
                            <p className="text-red-300 text-sm mt-2">{cameraError}</p>
                        </div>
                    )}
                </div>
                <div className="flex justify-center p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                     <button 
                        onClick={handleCapture} 
                        disabled={!!cameraError}
                        className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-4 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed group"
                        aria-label={t('cameraModal.captureButton')}
                    >
                        <div className="w-full h-full rounded-full bg-red-600 transform scale-90 group-hover:scale-95 group-active:scale-85 transition-transform"></div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CameraCaptureModal;