
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { AddScreenshotIcon } from './icons/AddScreenshotIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import ImageModal from './ImageModal.tsx';
import { Toast } from '../types.ts';
import { storageService } from '../services/authService';

interface ScreenshotGalleryProps {
    addToast: (message: string, type: Toast['type']) => void;
}

const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({ addToast }) => {
    const { t } = useLanguage();
    const [screenshots, setScreenshots] = useState<string[]>([]);
    const [modalImage, setModalImage] = useState<{ src: string, alt: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            const saved = await storageService.loadItem<string[]>('dashboard_screenshots');
            if (saved) setScreenshots(saved);
        };
        load();
    }, []);

    const handleAddScreenshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 25 * 1024 * 1024) {
                addToast(t('toasts.imageSizeError5' as any), 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = async () => {
                const updated = [...screenshots, reader.result as string];
                setScreenshots(updated);
                await storageService.saveItem('dashboard_screenshots', updated);
            };
            reader.readAsDataURL(file);
        }
        if (event.target) event.target.value = '';
    };

    const handleDeleteScreenshot = async (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = screenshots.filter((_, i) => i !== index);
        setScreenshots(updated);
        await storageService.saveItem('dashboard_screenshots', updated);
    };

    return (
        <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mt-8">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('dashboard.screenshots.title')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {screenshots.map((src, index) => (
                        <div key={index} className="relative group aspect-square cursor-pointer" onClick={() => setModalImage({ src, alt: `Screenshot ${index + 1}` })}>
                            <img src={src} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover rounded-lg shadow-md"/>
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <button onClick={(e) => handleDeleteScreenshot(index, e)} className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-primary transition-colors">
                        <AddScreenshotIcon className="w-8 h-8 mb-2"/>
                        <span className="text-sm font-semibold">{t('dashboard.screenshots.add')}</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleAddScreenshot} className="hidden" accept="image/png, image/jpeg, image/webp" />
                </div>
            </div>
             {modalImage && <ImageModal isOpen={!!modalImage} onClose={() => setModalImage(null)} src={modalImage.src} alt={modalImage.alt} />}
        </>
    );
};
export default ScreenshotGallery;
