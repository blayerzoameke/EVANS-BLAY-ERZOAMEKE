import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { UploadedFile } from '../types';
import { PdfIcon } from './icons/PdfIcon';
import { PowerPointIcon } from './icons/PowerPointIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { LayoutHorizontalIcon } from './icons/LayoutHorizontalIcon';
import { LayoutVerticalIcon } from './icons/LayoutVerticalIcon';
import { FitToPageIcon } from './icons/FitToPageIcon';
import { FitToWidthIcon } from './icons/FitToWidthIcon';


declare const pdfjsLib: any;

interface FileViewerProps {
    file: UploadedFile | null;
    zoom?: number;
    onZoomChange?: (newZoom: number) => void;
    showControls?: boolean;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, zoom: controlledZoom, onZoomChange, showControls = true }) => {
    const { t } = useLanguage();
    const pdfDocRef = useRef<any>(null);
    const [numPages, setNumPages] = useState(0);
    const [isPdfLoading, setIsPdfLoading] = useState(true);
    const [internalZoom, setInternalZoom] = useState(1.0);
    const [visiblePages, setVisiblePages] = useState(new Set([1]));
    const [pageDimensions, setPageDimensions] = useState<{width: number, height: number}[]>([]);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const activeRenderTasks = useRef(new Map());
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>('vertical');
    const [zoomMode, setZoomMode] = useState<'manual' | 'fit-page' | 'fit-width'>('manual');

    const isControlled = controlledZoom !== undefined && onZoomChange !== undefined;
    const zoom = isControlled ? controlledZoom : internalZoom;
    const setZoom = isControlled ? onZoomChange! : setInternalZoom;

    const isPdf = file?.type === 'application/pdf';
    const isImage = file?.type.startsWith('image/');
    const isPptx = file?.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    const handleZoomIn = () => {
        setZoomMode('manual');
        setZoom(Math.min(zoom + 0.25, 3.0));
    };
    const handleZoomOut = () => {
        setZoomMode('manual');
        setZoom(Math.max(zoom - 0.25, 0.25));
    };
    const handleZoomReset = () => {
        setZoomMode('manual');
        setZoom(1.0);
    };
    const handleRangeZoom = (newZoom: number) => {
        setZoomMode('manual');
        setZoom(newZoom);
    };

    const handleFitToPage = useCallback(() => setZoomMode('fit-page'), []);
    const handleFitToWidth = useCallback(() => setZoomMode('fit-width'), []);

    const recalculateZoom = useCallback(() => {
        if (zoomMode === 'manual' || !scrollContainerRef.current) {
            return;
        }

        const container = scrollContainerRef.current;
        const paddingX = 32;
        const paddingY = 32;
        const containerWidth = container.clientWidth - paddingX;
        const containerHeight = container.clientHeight - paddingY;

        let contentWidth = 0;
        let contentHeight = 0;

        if (isPdf && pageDimensions.length > 0) {
            contentWidth = pageDimensions[0].width;
            contentHeight = pageDimensions[0].height;
        } else if (isImage && imgRef.current) {
            contentWidth = imgRef.current.naturalWidth;
            contentHeight = imgRef.current.naturalHeight;
        }

        if (contentWidth === 0 || contentHeight === 0) return;

        let newZoom = 1;
        if (zoomMode === 'fit-page') {
            newZoom = Math.min(containerWidth / contentWidth, containerHeight / contentHeight);
        } else if (zoomMode === 'fit-width') {
            newZoom = containerWidth / contentWidth;
        }
        
        setZoom(Math.max(0.1, newZoom));

    }, [zoomMode, pageDimensions, isPdf, isImage, setZoom]);

    useEffect(() => {
        recalculateZoom();
        
        const container = scrollContainerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(() => {
            recalculateZoom();
        });
        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, [recalculateZoom]);
    
    useEffect(() => {
        // Trigger recalculation if the underlying content dimensions change.
        recalculateZoom();
    }, [pageDimensions, recalculateZoom]);


    useEffect(() => {
        if (!file || !isPdf) return;

        setIsPdfLoading(true);
        const loadingTask = pdfjsLib.getDocument({ data: atob(file.base64) });
        loadingTask.promise.then(async (pdf: any) => {
            pdfDocRef.current = pdf;
            setNumPages(pdf.numPages);

            const dims = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.0 });
                dims.push({ width: viewport.width, height: viewport.height });
            }
            setPageDimensions(dims);
            setVisiblePages(new Set([1]));
            setIsPdfLoading(false);

        }).catch((err: any) => {
            console.error('Error loading PDF document', err);
            setIsPdfLoading(false);
        });

        return () => {
            pdfDocRef.current = null;
            setNumPages(0);
            setPageDimensions([]);
            pageRefs.current.clear();
        };
    }, [file, isPdf]);

    useEffect(() => {
        if (!isPdf || !pdfDocRef.current || pageDimensions.length === 0) return;

        const basePdfScale = 1.0;

        visiblePages.forEach(pageNum => {
            const pageDiv = pageRefs.current.get(pageNum);
            const canvas = pageDiv?.querySelector('canvas');
            if (!canvas) return;

            if (canvas.dataset.renderedZoom === String(zoom) && canvas.dataset.renderedLayout === layoutMode) {
                return;
            }

            if (activeRenderTasks.current.has(pageNum)) {
                activeRenderTasks.current.get(pageNum).cancel();
            }

            pdfDocRef.current.getPage(pageNum).then((page: any) => {
                const context = canvas.getContext('2d');
                if (!context) return;
                
                const viewport = page.getViewport({ scale: basePdfScale * zoom });
                
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderTask = page.render({
                    canvasContext: context,
                    viewport: viewport,
                });

                activeRenderTasks.current.set(pageNum, renderTask);

                renderTask.promise
                    .then(() => {
                        canvas.dataset.renderedZoom = String(zoom);
                        canvas.dataset.renderedLayout = layoutMode;
                    })
                    .catch((err: any) => {
                        if (err.name !== 'RenderingCancelledException') {
                            console.error(`Failed to render page ${pageNum}`, err);
                        }
                    })
                    .finally(() => {
                        if (activeRenderTasks.current.get(pageNum) === renderTask) {
                            activeRenderTasks.current.delete(pageNum);
                        }
                    });
            });
        });

        return () => {
            activeRenderTasks.current.forEach(task => task.cancel());
            activeRenderTasks.current.clear();
        };
    }, [isPdf, visiblePages, zoom, pageDimensions, layoutMode]);

    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver((entries) => {
            setVisiblePages(prevVisiblePages => {
                const newVisiblePages = new Set(prevVisiblePages);
                let updated = false;
                entries.forEach(entry => {
                    const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '0', 10);
                    if (pageNum && entry.isIntersecting) {
                        if (!newVisiblePages.has(pageNum)) {
                            newVisiblePages.add(pageNum);
                            updated = true;
                        }
                    }
                });
                return updated ? newVisiblePages : prevVisiblePages;
            });
        }, { rootMargin: '200px' });

        pageRefs.current.forEach(pageElement => {
            if (pageElement) {
                observerRef.current?.observe(pageElement);
            }
        });

        return () => observerRef.current?.disconnect();
    }, [numPages, pageDimensions, layoutMode]);

    if (!file) {
        return (
            <div className="h-full flex items-center justify-center text-center text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p>{t('fileviewer.noMaterial')}</p>
            </div>
        );
    }
    
    const fileUrl = URL.createObjectURL(new Blob([Uint8Array.from(atob(file.base64), c => c.charCodeAt(0))], { type: file.type }));

    return (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden relative flex flex-col">
            {showControls && (isPdf || isImage) && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full shadow-lg flex items-center gap-2 p-2">
                    {isPdf && (
                        <>
                             <button onClick={() => setLayoutMode(layoutMode === 'vertical' ? 'horizontal' : 'vertical')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title={layoutMode === 'vertical' ? t('fileviewer.layout.horizontal') : t('fileviewer.layout.vertical')}>
                                {layoutMode === 'vertical' ? <LayoutHorizontalIcon className="w-5 h-5" /> : <LayoutVerticalIcon className="w-5 h-5" />}
                            </button>
                            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600"></div>
                        </>
                    )}
                    <button onClick={handleZoomOut} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="Zoom Out"><ZoomOutIcon className="w-5 h-5" /></button>
                    
                    <input 
                        type="range" 
                        min="0.25" 
                        max="3" 
                        step="0.05" 
                        value={zoom} 
                        onChange={(e) => handleRangeZoom(parseFloat(e.target.value))} 
                        className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary" 
                        aria-label="Zoom slider"
                    />

                    <button onClick={handleZoomIn} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="Zoom In"><ZoomInIcon className="w-5 h-5" /></button>
                    
                    <div className="w-px h-5 bg-gray-300 dark:bg-gray-600"></div>
                    
                    <button onClick={handleFitToPage} className={`p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 ${zoomMode === 'fit-page' ? 'text-primary' : ''}`} title={t('fileviewer.zoom.fitPage')}><FitToPageIcon className="w-5 h-5" /></button>
                    <button onClick={handleFitToWidth} className={`p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 ${zoomMode === 'fit-width' ? 'text-primary' : ''}`} title={t('fileviewer.zoom.fitWidth')}><FitToWidthIcon className="w-5 h-5" /></button>

                    <div className="w-px h-5 bg-gray-300 dark:bg-gray-600"></div>

                    <button onClick={handleZoomReset} className="text-sm font-semibold px-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md" title="Reset Zoom">
                        {Math.round(zoom * 100)}%
                    </button>
                </div>
            )}
            {isPdf ? (
                <>
                    {isPdfLoading && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10">
                            <div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full"></div>
                        </div>
                    )}
                    <div ref={scrollContainerRef} className={`flex-1 overflow-auto p-4 ${layoutMode === 'horizontal' ? 'flex flex-row items-center gap-4' : 'flex flex-col'}`}>
                        {Array.from(new Array(numPages), (_, index) => {
                            const pageNum = index + 1;
                            const dims = pageDimensions[index];
                            return (
                                <div
                                    key={index}
                                    ref={el => { if (el) pageRefs.current.set(pageNum, el); else pageRefs.current.delete(pageNum); }}
                                    data-page-number={pageNum}
                                    className={layoutMode === 'horizontal' ? 'h-full flex-shrink-0 flex items-center justify-center' : 'flex justify-center mb-4'}
                                    style={{ 
                                        minHeight: dims ? `${(dims.height * zoom)}px` : '1000px',
                                        ...(layoutMode === 'horizontal' && { minWidth: dims ? `${(dims.width * zoom)}px` : '700px' })
                                    }}
                                >
                                    {visiblePages.has(pageNum) && (
                                        <canvas
                                            className="shadow-lg"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : isImage ? (
                 <div ref={scrollContainerRef} className="w-full h-full overflow-auto flex justify-center items-center p-4">
                    <img ref={imgRef} src={fileUrl} alt={file.name} className="max-w-none max-h-none object-contain transition-transform" style={{ width: 'auto', height: 'auto', transform: `scale(${zoom})`, transformOrigin: 'center' }} onLoad={recalculateZoom} />
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-700 dark:text-gray-300 p-8">
                    {isPptx ? <PowerPointIcon className="w-24 h-24 text-orange-500 mb-4" /> : <PdfIcon className="w-24 h-24 text-red-500 mb-4" />}
                    <h3 className="text-xl font-bold mb-2">{t('fileviewer.previewNotAvailable')}</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        {t('fileviewer.unsupportedType', { type: file.type })}
                    </p>
                    <a 
                        href={fileUrl} 
                        download={file.name}
                        className="px-4 py-2 bg-primary text-primary-text rounded-md hover:bg-primary-dark"
                    >
                        {t('fileviewer.downloadFile', { name: file.name })}
                    </a>
                </div>
            )}
        </div>
    );
};

export default FileViewer;