import { useRef } from 'react';
import { rectPtToPx, rectPxToPt } from '../utils/coordMap';

export default function WhiteoutBox({ 
  whiteoutBox, 
  zoom, 
  onUpdate, 
  onDelete,
  isSelected,
  tool = null,
  onResizeStart,
  onRotationStart,
  whiteoutBoxIndex = null
}) {
  const containerRef = useRef(null);

  // Konvertera pt till px för visning
  const rectPx = rectPtToPx(whiteoutBox.rect, zoom);

  const handleMouseDown = (e) => {
    // Stoppa propagation endast om whiteout-verktyget är aktivt
    // När text-verktyget eller andra verktyg är aktiva, låt klick gå igenom
    if (tool === 'whiteout') {
      // Låt whiteout-verktyget hantera klick
      return;
    }
    // För alla andra verktyg (inklusive text), låt klick gå igenom
    // (pointerEvents: 'none' borde redan hantera detta, men detta är en extra säkerhet)
  };

  // Visa ram endast när whiteout-verktyget är aktivt
  const showBorder = tool === 'whiteout';
  const borderStyle = isSelected && tool === 'whiteout' ? '2px solid #ff6600' : showBorder ? '1px dashed rgba(255, 107, 53, 0.5)' : 'none';
  
  // Cursor: pointer när tool === null, move när vald och verktyget är aktivt, annars default
  let cursorStyle = 'default';
  if (tool === null) {
    cursorStyle = 'pointer';
  } else if (isSelected && tool === 'whiteout') {
    cursorStyle = 'move';
  }

  // Resize handles (endast när vald OCH whiteout-verktyget är aktivt)
  const handleSize = 8;
  const handleOffset = handleSize; // flytta handles utanför rutan
  const handles = isSelected && tool === 'whiteout' ? [
    { position: 'nw', style: { top: -handleOffset, left: -handleOffset, cursor: 'nw-resize' } },
    { position: 'n', style: { top: -handleOffset, left: '50%', marginLeft: -handleSize/2, cursor: 'n-resize' } },
    { position: 'ne', style: { top: -handleOffset, right: -handleOffset, cursor: 'ne-resize' } },
    { position: 'e', style: { top: '50%', right: -handleOffset, marginTop: -handleSize/2, cursor: 'e-resize' } },
    { position: 'se', style: { bottom: -handleOffset, right: -handleOffset, cursor: 'se-resize' } },
    { position: 's', style: { bottom: -handleOffset, left: '50%', marginLeft: -handleSize/2, cursor: 's-resize' } },
    { position: 'sw', style: { bottom: -handleOffset, left: -handleOffset, cursor: 'sw-resize' } },
    { position: 'w', style: { top: '50%', left: -handleOffset, marginTop: -handleSize/2, cursor: 'w-resize' } }
  ] : [];

  return (
    <div
      ref={containerRef}
      data-whiteout-container-index={whiteoutBoxIndex}
      style={{
        position: 'absolute',
        left: `${rectPx.x}px`,
        top: `${rectPx.y}px`,
        width: `${rectPx.width}px`,
        height: `${rectPx.height}px`,
        backgroundColor: whiteoutBox.color || 'white',
        border: borderStyle,
        cursor: cursorStyle,
        boxSizing: 'border-box',
        opacity: 0.9,
        zIndex: 2, // Whiteout boxes ska ligga under text boxes
        pointerEvents: (tool === null || tool === 'whiteout') ? 'auto' : 'none' // Tillåt klick när tool === null (för selektion) eller när whiteout-verktyget är aktivt
        ,
        transform: `rotate(${whiteoutBox.rotation || 0}deg)`,
        transformOrigin: 'center'
      }}
      onMouseDown={(tool === null || tool === 'whiteout') ? handleMouseDown : undefined}
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

      {/* Linje till rotationshandtaget */}
      {isSelected && tool === 'whiteout' && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '100%',
            marginLeft: -1,
            marginTop: -handleOffset,
            width: '2px',
            height: `${30 + handleOffset}px`,
            backgroundColor: '#ff6600',
            pointerEvents: 'none',
            zIndex: 9
          }}
        />
      )}

      {/* Rotationshandtag */}
      {isSelected && tool === 'whiteout' && (
        <div
          data-rotation-handle
          style={{
            position: 'absolute',
            left: '50%',
            top: '100%',
            marginLeft: -handleSize / 2,
            marginTop: 30,
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            backgroundColor: '#ff6600',
            border: '1px solid #fff',
            borderRadius: '2px',
            cursor: 'grab',
            zIndex: 10
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onRotationStart) {
              onRotationStart(e);
            }
          }}
        />
      )}
    </div>
  );
}

