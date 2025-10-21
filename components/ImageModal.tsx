import React from 'react';
import { CloseIcon } from './icons/CloseIcon.tsx';

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    src: string;
    alt: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, src, alt }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4 animate-fade-in" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-modal-title"
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col relative" 
                onClick={e => e.stopPropagation()}
            >
                <h2 id="image-modal-title" className="sr-only">{alt}</h2>
                <button 
                    onClick={onClose} 
                    className="absolute -top-3 -right-3 p-1.5 bg-gray-700 text-white rounded-full hover:bg-red-500 z-10 transition-colors"
                    aria-label="Close image view"
                >
                    <CloseIcon className="w-6 h-6" />
                </button>
                <img src={src} alt={alt} className="w-full h-full object-contain rounded-lg p-2" />
            </div>
        </div>
    );
};

export default ImageModal;