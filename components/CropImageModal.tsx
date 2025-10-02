import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';

interface CropImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string;
    onCropComplete: (croppedImageUrl: string) => void;
}

// Function to generate a cropped image from a source image and crop data
async function getCroppedImg(
    image: HTMLImageElement,
    crop: Crop
): Promise<string> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        throw new Error('No 2d context');
    }

    const pixelRatio = window.devicePixelRatio;
    canvas.width = crop.width * pixelRatio;
    canvas.height = crop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height
    );
    
    return new Promise((resolve) => {
        resolve(canvas.toDataURL('image/jpeg'));
    });
}

const CropImageModal: React.FC<CropImageModalProps> = ({ isOpen, onClose, imageSrc, onCropComplete }) => {
    const { t } = useLanguage();
    const [crop, setCrop] = useState<Crop>();
    const imgRef = useRef<HTMLImageElement>(null);

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        const initialCrop = centerCrop(
            makeAspectCrop(
                {
                    unit: '%',
                    width: 90,
                },
                1, // aspect ratio 1:1
                width,
                height
            ),
            width,
            height
        );
        setCrop(initialCrop);
    }

    const handleCrop = async () => {
        if (imgRef.current && crop?.width && crop?.height) {
            const croppedImageUrl = await getCroppedImg(imgRef.current, crop);
            onCropComplete(croppedImageUrl);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{t('cropModal.title')}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 flex justify-center">
                    <ReactCrop
                        crop={crop}
                        onChange={c => setCrop(c)}
                        aspect={1}
                        circularCrop
                    >
                        <img ref={imgRef} src={imageSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }} />
                    </ReactCrop>
                </div>
                <div className="flex justify-end gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">
                        {t('common.cancel')}
                    </button>
                    <button onClick={handleCrop} className="px-6 py-2 text-white bg-blue-700 rounded-md hover:bg-blue-800">
                        {t('cropModal.apply')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CropImageModal;