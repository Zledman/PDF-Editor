import React from 'react';
import { rectPtToPx } from '../utils/coordMap';

export default function LinkBox({
    linkBox,
    zoom,
    isSelected,
    onSelect,
    onResizeStart,
    onDragStart,
    tool
}) {
    const rectPx = rectPtToPx(linkBox.rect, zoom);

    const handleSize = 8;
    const handleOffset = handleSize / 2;

    const handles = [
        { position: 'nw', style: { top: -handleOffset, left: -handleOffset, cursor: 'nw-resize' } },
        { position: 'n', style: { top: -handleOffset, left: '50%', marginLeft: -handleOffset, cursor: 'n-resize' } },
        { position: 'ne', style: { top: -handleOffset, right: -handleOffset, cursor: 'ne-resize' } },
        { position: 'e', style: { top: '50%', right: -handleOffset, marginTop: -handleOffset, cursor: 'e-resize' } },
        { position: 'se', style: { bottom: -handleOffset, right: -handleOffset, cursor: 'se-resize' } },
        { position: 's', style: { bottom: -handleOffset, left: '50%', marginLeft: -handleOffset, cursor: 's-resize' } },
        { position: 'sw', style: { bottom: -handleOffset, left: -handleOffset, cursor: 'sw-resize' } },
        { position: 'w', style: { top: '50%', left: -handleOffset, marginTop: -handleOffset, cursor: 'w-resize' } }
    ];

    const handleMouseDown = (e) => {
        if (e.target.dataset.resizeHandle) {
            e.stopPropagation();
            if (onResizeStart) {
                onResizeStart(e.target.dataset.resizeHandle, e);
            }
        } else if (onDragStart) {
            e.stopPropagation();
            onSelect(); // Ensure selected when dragging starts
            onDragStart(e);
        } else {
            e.stopPropagation();
            onSelect();
        }
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            style={{
                position: 'absolute',
                top: rectPx.y,
                left: rectPx.x,
                width: rectPx.width,
                height: rectPx.height,
                backgroundColor: 'rgba(74, 144, 226, 0.2)', // Blue transparent
                border: isSelected ? '2px solid #4A90E2' : '1px solid rgba(74, 144, 226, 0.5)',
                cursor: 'pointer', // User requested "hand with index finger" for moving
                zIndex: isSelected ? 30 : 25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'none', // Disable transition during drag/resize for responsiveness
                boxSizing: 'border-box'
            }}
        >
            <div style={{
                backgroundColor: '#4A90E2',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.9,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                pointerEvents: 'none' // Let clicks pass through icon to parent
            }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            </div>

            {/* Resize handles */}
            {isSelected && handles.map((handle) => (
                <div
                    key={handle.position}
                    data-resize-handle={handle.position}
                    style={{
                        position: 'absolute',
                        width: `${handleSize}px`,
                        height: `${handleSize}px`,
                        backgroundColor: '#fff',
                        border: '1px solid #4A90E2',
                        borderRadius: '2px', // Square handles for resizing usually look better
                        zIndex: 31,
                        ...handle.style
                    }}
                />
            ))}
        </div>
    );
}
