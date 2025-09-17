import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadIcon } from './icons/UploadIcon';
import { PdfIcon } from './icons/PdfIcon';
import { CloseIcon } from './icons/CloseIcon';
import type { UploadedFile } from '../types';

interface UploadSlidesProps {
    file: UploadedFile | null;
    setFile: (file: UploadedFile | null) => void;
    disabled?: boolean;
}

const UploadSlides: React.FC<UploadSlidesProps> = ({ file, setFile, disabled }) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const selectedFile = acceptedFiles[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = (e.target?.result as string).split(',')[1];
                setFile({
                    file: selectedFile,
                    name: selectedFile.name,
                    size: selectedFile.size,
                    type: selectedFile.type,
                    base64: base64,
                });
            };
            reader.readAsDataURL(selectedFile);
        }
    }, [setFile]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpeg', '.jpg', '.png'] },
        multiple: false,
        disabled,
    });

    const removeFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFile(null);
    };

    return (
        <div
            {...getRootProps()}
            className={`w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${isDragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-600'}
            ${disabled ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-800' : 'hover:border-indigo-400'}`}
        >
            <input {...getInputProps()} />
            {file ? (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <PdfIcon className="w-10 h-10 text-red-500" />
                        <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">{file.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button
                        onClick={removeFile}
                        className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        aria-label="Remove file"
                        disabled={disabled}
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                    <UploadIcon className="w-12 h-12 mb-4" />
                    <p className="font-semibold">
                        {isDragActive ? 'Drop the file here...' : 'Drag & drop file here, or click to select'}
                    </p>
                    <p className="text-sm">PDF or Image files supported</p>
                </div>
            )}
        </div>
    );
};

export default UploadSlides;
