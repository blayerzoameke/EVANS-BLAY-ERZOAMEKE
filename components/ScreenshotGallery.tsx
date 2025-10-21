import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { AddScreenshotIcon } from './icons/AddScreenshotIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import ImageModal from './ImageModal.tsx';
import { Toast } from '../types.ts';

interface ScreenshotGalleryProps {
    addToast: (message: string, type: Toast['type']) => void;
}

const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({ addToast }) => {
    const { t } = useLanguage();
    const [screenshots, setScreenshots] = useState<string[]>([]);
    const [modalImage, setModalImage] = useState<{ src: string, alt: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const savedScreenshots = localStorage.getItem('dashboard_screenshots');
            if (savedScreenshots) {
                setScreenshots(JSON.parse(savedScreenshots));
            }
        } catch (error) {
            console.error("Failed to load screenshots from localStorage", error);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('dashboard_screenshots', JSON.stringify(screenshots));
        } catch (error) {
            console.error("Failed to save screenshots to localStorage", error);
        }
    }, [screenshots]);

    const handleAddScreenshot = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                addToast(t('toasts.imageSizeError5' as any), 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setScreenshots(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        } else if (file) {
            addToast(t('toasts.invalidImageFile' as any), 'error');
        }
        // Reset file input to allow uploading the same file again
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleDeleteScreenshot = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setScreenshots(prev => prev.filter((_, i) => i !== index));
    };

    const openImageModal = (src: string, index: number) => {
        setModalImage({ src, alt: `Screenshot ${index + 1}` });
    };

    const closeImageModal = () => {
        setModalImage(null);
    };

    return (
        <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mt-8">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('dashboard.screenshots.title')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {screenshots.map((src, index) => (
                        <div key={index} className="relative group aspect-square cursor-pointer" onClick={() => openImageModal(src, index)}>
                            <img src={src} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover rounded-lg shadow-md"/>
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <button
                                    onClick={(e) => handleDeleteScreenshot(index, e)}
                                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                                    aria-label={`Delete screenshot ${index + 1}`}
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-primary dark:hover:border-primary-light transition-colors"
                        aria-label={t('dashboard.screenshots.add')}
                    >
                        <AddScreenshotIcon className="w-8 h-8 mb-2"/>
                        <span className="text-sm font-semibold">{t('dashboard.screenshots.add')}</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAddScreenshot}
                        className="hidden"
                        accept="image/png, image/jpeg, image/webp"
                    />
                </div>
            </div>
             {modalImage && (
                <ImageModal
                    isOpen={!!modalImage}
                    onClose={closeImageModal}
                    src={modalImage.src}
                    alt={modalImage.alt}
                />
            )}
        </>
    );
};

export default ScreenshotGallery;