import { useRef } from 'react';
import { rectPtToPx, rectPxToPt } from '../utils/coordMap';

export default function WhiteoutBox({ 
  whiteoutBox, 
  zoom, 
  onUpdate, 
  onDelete,
  isSelected,
  tool = null,
  onResizeStart
}) {
  const containerRef = useRef(null);

  // Konvertera pt till px för visning
  const rectPx = rectPtToPx(whiteoutBox.rect, zoom);

  const handleMouseDown = (e) => {
    // Stoppa propagation endast om det inte är whiteout-verktyget som är aktivt
    // (för att tillåta drag när verktyget är aktivt)
    if (tool !== 'whiteout' || e.target.dataset.resizeHandle) {
      e.stopPropagation();
    }
  };

  // Visa ram endast när whiteout-verktyget är aktivt
  const showBorder = tool === 'whiteout';
  const borderStyle = isSelected && tool === 'whiteout' ? '2px solid #ff6600' : showBorder ? '1px dashed rgba(255, 107, 53, 0.5)' : 'none';

  // Resize handles (endast när vald OCH whiteout-verktyget är aktivt)
  const handleSize = 8;
  const handles = isSelected && tool === 'whiteout' ? [
    { position: 'nw', style: { top: -handleSize/2, left: -handleSize/2, cursor: 'nw-resize' } },
    { position: 'n', style: { top: -handleSize/2, left: '50%', marginLeft: -handleSize/2, cursor: 'n-resize' } },
    { position: 'ne', style: { top: -handleSize/2, right: -handleSize/2, cursor: 'ne-resize' } },
    { position: 'e', style: { top: '50%', right: -handleSize/2, marginTop: -handleSize/2, cursor: 'e-resize' } },
    { position: 'se', style: { bottom: -handleSize/2, right: -handleSize/2, cursor: 'se-resize' } },
    { position: 's', style: { bottom: -handleSize/2, left: '50%', marginLeft: -handleSize/2, cursor: 's-resize' } },
    { position: 'sw', style: { bottom: -handleSize/2, left: -handleSize/2, cursor: 'sw-resize' } },
    { position: 'w', style: { top: '50%', left: -handleSize/2, marginTop: -handleSize/2, cursor: 'w-resize' } }
  ] : [];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${rectPx.x}px`,
        top: `${rectPx.y}px`,
        width: `${rectPx.width}px`,
        height: `${rectPx.height}px`,
        backgroundColor: 'white',
        border: borderStyle,
        cursor: isSelected && tool === 'whiteout' ? 'move' : 'default',
        boxSizing: 'border-box',
        opacity: 0.9
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Resize handles */}
      {isSelected && handles.map((handle) => (
        <div
          key={handle.position}
          data-resize-handle={handle.position}
          style={{
            position: 'absolute',
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            backgroundColor: '#ff6600',
            border: '1px solid #fff',
            borderRadius: '2px',
            ...handle.style,
            zIndex: 10
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onResizeStart) {
              onResizeStart(handle.position, e);
            }
          }}
        />
      ))}
    </div>
  );
}

