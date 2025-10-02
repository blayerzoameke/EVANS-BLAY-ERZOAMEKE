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

    return (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden">
            {isPdf ? (
                <iframe
                    src={fileUrl}
                    title={file.name}
                    className="w-full h-full border-none"
                />
            ) : isImage ? (
                <div className="w-full h-full overflow-auto flex justify-center items-start p-4">
                    <img
                        src={fileUrl}
                        alt={file.name}
                        className="max-w-full h-auto object-contain rounded-md"
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
    );
};

export default FileViewer;