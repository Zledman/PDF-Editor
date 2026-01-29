import React, { useState, useEffect, useRef } from 'react';

// A component that overlays the PDF page to handle crop selection
// It renders a semi-transparent overlay with a "hole" for the selected area
export default function CropOverlay({
    active,
    cropRegion,
    onCropChange,
    onCropComplete,
    onCancel,
    pageRect // Unused but kept for prop compatibility
}) {
    if (!active) return null;

    const [isDragging, setIsDragging] = useState(false);
    const [currentRect, setCurrentRect] = useState(cropRegion || null);
    const containerRef = useRef(null);
    const dragStartRef = useRef(null);
    const latestRect = useRef(null);
    const onCropChangeRef = useRef(onCropChange);
    const onCropCompleteRef = useRef(onCropComplete);

    // Update refs
    useEffect(() => {
        onCropChangeRef.current = onCropChange;
        onCropCompleteRef.current = onCropComplete;
    }, [onCropChange, onCropComplete]);

    // If cropRegion is provided from parent, sync it
    useEffect(() => {
        setCurrentRect(cropRegion);
    }, [cropRegion]);

    const getRelativeCoords = (e, rect) => {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return { x, y };
    };

    // Global event handlers need to be stable or ref-based
    useEffect(() => {
        const onWindowMouseMove = (e) => {
            if (!containerRef.current || !dragStartRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            let { x, y } = getRelativeCoords(e, containerRect);

            // Clamp to container
            x = Math.max(0, Math.min(x, containerRect.width));
            y = Math.max(0, Math.min(y, containerRect.height));

            const startX = dragStartRef.current.x;
            const startY = dragStartRef.current.y;

            const newRect = {
                x: Math.min(startX, x),
                y: Math.min(startY, y),
                width: Math.abs(x - startX),
                height: Math.abs(y - startY)
            };

            latestRect.current = newRect;
            setCurrentRect(newRect);
            if (onCropChangeRef.current) onCropChangeRef.current(newRect);
        };

        const onWindowMouseUp = (e) => {
            setIsDragging(false);
            window.removeEventListener('mousemove', onWindowMouseMove);
            window.removeEventListener('mouseup', onWindowMouseUp);

            const rect = latestRect.current;
            if (rect && (rect.width > 5 || rect.height > 5)) {
                if (onCropCompleteRef.current) onCropCompleteRef.current(rect);
            } else {
                setCurrentRect(null);
                if (onCropChangeRef.current) onCropChangeRef.current(null);
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', onWindowMouseMove);
            window.addEventListener('mouseup', onWindowMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', onWindowMouseMove);
            window.removeEventListener('mouseup', onWindowMouseUp);
        };
    }, [isDragging]);

    const onMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const { x, y } = getRelativeCoords(e, rect);

        setIsDragging(true);
        dragStartRef.current = { x, y };
        latestRect.current = { x, y, width: 0, height: 0 };

        setCurrentRect(latestRect.current);
        if (onCropChange) onCropChange(latestRect.current);
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 100,
                cursor: 'crosshair',
                pointerEvents: 'auto'
            }}
            onMouseDown={onMouseDown}
        >
            {/* SVG Mask for the darkened area */}
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                <defs>
                    <mask id="crop-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {currentRect && (
                            <rect
                                x={currentRect.x}
                                y={currentRect.y}
                                width={currentRect.width}
                                height={currentRect.height}
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.5)"
                    mask="url(#crop-mask)"
                />

                {/* Border for selected area */}
                {currentRect && (
                    <rect
                        x={currentRect.x}
                        y={currentRect.y}
                        width={currentRect.width}
                        height={currentRect.height}
                        fill="none"
                        stroke="#0066ff"
                        strokeWidth="2"
                        strokeDasharray="4"
                    />
                )}
            </svg>

            {/* Helper text if no selection */}
            {!currentRect && !isDragging && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                    fontWeight: 500
                }}>
                    Click and drag to crop
                </div>
            )}
        </div>
    );
}
