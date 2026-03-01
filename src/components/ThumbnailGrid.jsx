import { useState, useEffect, useRef } from 'react';

export default function ThumbnailGrid({
    pdfDoc,
    pages,
    selectedPages,
    onToggleSelection,
    externalDocs,
    scale = 1 // New prop: 0.5 to 2.0
}) {
    // Cache for generated thumbnails to avoid re-rendering
    // key format suggestion: `${docId || 'main'}-${pageIndex}` to avoid collision
    const thumbnailCache = useRef(new Map());
    const [thumbnails, setThumbnails] = useState({});

    useEffect(() => {
        if (!pdfDoc) return;

        let isActive = true;

        const generateThumbnails = async () => {
            // Find pages that need thumbnails and aren't cached or deleted
            // Page key: sourceDocId + sourcePageIndex
            const pagesToRender = pages.filter(p => !p.isDeleted).filter(p => {
                const docId = p.docId || 'main';
                const cacheKey = `${docId}-${p.originalIndex}`;
                return !thumbnailCache.current.has(cacheKey) && p.originalIndex !== null;
            });

            if (pagesToRender.length === 0) {
                // Just update state from cache if needed
                const newThumbnails = {};
                pages.forEach(p => {
                    const docId = p.docId || 'main';
                    const cacheKey = `${docId}-${p.originalIndex}`;
                    if (p.originalIndex !== null && thumbnailCache.current.has(cacheKey)) {
                        newThumbnails[p.id] = thumbnailCache.current.get(cacheKey);
                    }
                });
                if (isActive) setThumbnails(prev => ({ ...prev, ...newThumbnails }));
                return;
            }

            for (const page of pagesToRender) {
                if (!isActive) break;

                try {
                    const docId = page.docId || 'main';
                    let sourceDoc = pdfDoc;

                    if (docId !== 'main') {
                        if (externalDocs && externalDocs.has(docId)) {
                            sourceDoc = externalDocs.get(docId).pdfJsDoc;
                        } else {
                            console.warn(`Source doc ${docId} not found`);
                            continue;
                        }
                    }

                    // originalIndex is 0-based, pdfjs is 1-based
                    const pdfPage = await sourceDoc.getPage(page.originalIndex + 1);

                    // Adjust viewport scale for higher quality zoom if needed, but keep it performant
                    const pixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
                    const baseScale = 0.4;
                    const renderScale = baseScale * Math.max(1, scale) * pixelRatio;

                    const viewport = pdfPage.getViewport({ scale: renderScale });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    await pdfPage.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;

                    const dataUrl = canvas.toDataURL('image/png');

                    if (isActive) {
                        const cacheKey = `${docId}-${page.originalIndex}`;
                        thumbnailCache.current.set(cacheKey, dataUrl);
                        setThumbnails(prev => ({
                            ...prev,
                            [page.id]: dataUrl
                        }));
                    }
                } catch (err) {
                    console.error(`Error rendering thumbnail for page ${page.originalIndex}`, err);
                }
            }
        };

        generateThumbnails();

        return () => { isActive = false; };
    }, [pdfDoc, pages, scale]); // Re-run when scale changes to regenerate higher resolution? Maybe optional.

    // Base width 180px * scale
    const itemWidth = Math.round(180 * scale);
    const gap = Math.round(60 * scale);

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, ${itemWidth}px)`,
            justifyContent: 'center',
            gap: `${gap}px`,
            width: '100%',
            paddingBottom: '40px'
        }}>
            {pages.map((page, index) => {
                if (page.isDeleted) return null;

                const isSelected = selectedPages.has(page.id);
                const thumbUrl = thumbnails[page.id];

                return (
                    <div
                        key={page.id}
                        onClick={() => onToggleSelection(page.id)}
                        style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        {/* Card Container */}
                        <div style={{
                            width: '100%',
                            aspectRatio: '210/297', // A4 aspect ratio approximation
                            backgroundColor: '#fff',
                            borderRadius: '4px',
                            boxShadow: isSelected ? '0 0 0 4px rgba(255, 107, 53, 0.4)' : '0 2px 5px rgba(0,0,0,0.1)',
                            border: isSelected ? '2px solid #ff6b35' : '1px solid #e0e0e0',
                            overflow: 'hidden',
                            position: 'relative',
                            transition: 'all 0.2s',
                            transform: `rotate(${page.rotation}deg)`
                        }}>
                            {thumbUrl ? (
                                <img
                                    src={thumbUrl}
                                    alt={`Page ${index + 1}`}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ccc'
                                }}>
                                    {page.originalIndex === null ? 'Blank Page' : 'Loading...'}
                                </div>
                            )}


                        </div>

                        {/* Page Number Label */}
                        <div style={{
                            marginTop: '10px',
                            backgroundColor: isSelected ? '#ff6b35' : '#6c757d',
                            color: '#fff',
                            borderRadius: '12px',
                            padding: '2px 10px',
                            fontSize: '12px',
                            fontWeight: '500'
                        }}>
                            {index + 1}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
