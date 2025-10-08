import React, { useState, useEffect } from 'react';
import type { UploadedFile } from '../types.ts';
import { PdfIcon } from './icons/PdfIcon.tsx';
import { PowerPointIcon } from './icons/PowerPointIcon.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';

interface FileViewerProps {
    file: UploadedFile | null;
}

const FileViewer: React.FC<FileViewerProps> = ({ file }) => {
    const { t } = useLanguage();
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1.0);

    useEffect(() => {
        if (file) {
            const blob = new Blob([Uint8Array.from(atob(file.base64), c => c.charCodeAt(0))], { type: file.type });
            const url = URL.createObjectURL(blob);
            setFileUrl(url);

            return () => {
                URL.revokeObjectURL(url);
            };
        }
    }, [file]);

    if (!file || !fileUrl) {
        return (
            <div className="h-full flex items-center justify-center text-center text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p>{t('fileviewer.noMaterial' as any)}</p>
            </div>
        );
    }

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    const isPptx = file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    const renderable = isPdf || isImage;

    return (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden relative">
            <div className="w-full h-full overflow-auto">
                {isPdf ? (
                    <iframe
                        src={fileUrl}
                        title={file.name}
                        className="border-none transition-transform duration-200 origin-top-left"
                        style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
                    />
                ) : isImage ? (
                    <div className="w-full h-full flex justify-center items-center p-4">
                        <img
                            src={fileUrl}
                            alt={file.name}
                            className="max-w-none transition-transform duration-200"
                            style={{ transform: `scale(${zoom})` }}
                        />
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-700 dark:text-gray-300 p-8">
                         {isPptx ? <PowerPointIcon className="w-24 h-24 text-orange-500 mb-4" /> : <PdfIcon className="w-24 h-24 text-red-500 mb-4" />}
                        <h3 className="text-xl font-bold mb-2">{t('fileviewer.previewNotAvailable' as any)}</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            {t('fileviewer.unsupportedType' as any, { type: file.type })}
                        </p>
                        <a 
                            href={fileUrl} 
                            download={file.name}
                            className="px-4 py-2 bg-primary text-primary-text rounded-md hover:bg-primary-dark"
                        >
                            {t('fileviewer.downloadFile' as any, { name: file.name })}
                        </a>
                    </div>
                )}
            </div>

            {renderable && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full shadow-lg p-1.5 flex items-center gap-2 text-sm font-medium">
                    <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center font-bold text-lg">-</button>
                    <input 
                        type="range" 
                        min="0.2" 
                        max="3" 
                        step="0.1" 
                        value={zoom} 
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-32"
                    />
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center font-bold text-lg">+</button>
                    <span className="text-xs font-mono w-12 text-center text-gray-600 dark:text-gray-300">{(zoom * 100).toFixed(0)}%</span>
                    <button onClick={() => setZoom(1)} className="text-xs px-3 py-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">{t('common.reset')}</button>
                </div>
            )}
        </div>
    );
};

export default FileViewer;
