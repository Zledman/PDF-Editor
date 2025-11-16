import { useState, useRef, useEffect } from 'react';
import { LINE_HEIGHT_FACTOR, MIN_FONT_PT } from '../utils/textLayoutConstants';
import { ptToPx, pxToPt, rectPtToPx, rectPxToPt } from '../utils/coordMap';

export default function TransparentTextBox({ 
  textBox, 
  zoom, 
  onUpdate, 
  onDelete,
  isSelected,
  autoEdit = false // Ny prop för att automatiskt starta redigering
}) {
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [localText, setLocalText] = useState(textBox.text || '');
  const textRef = useRef(null);
  const containerRef = useRef(null);

  // Konvertera pt till px för visning
  const rectPx = rectPtToPx(textBox.rect, zoom);
  const fontSizePx = ptToPx(textBox.fontSizePt || 12, zoom);
  const lineHeightPx = fontSizePx * LINE_HEIGHT_FACTOR;

  useEffect(() => {
    setLocalText(textBox.text || '');
  }, [textBox.text]);

  // Om autoEdit är true, starta redigering automatiskt
  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true);
    }
  }, [autoEdit]);

  const handleTextChange = (e) => {
    setLocalText(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onUpdate) {
      onUpdate({
        ...textBox,
        text: localText
      });
    }
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || e.target === textRef.current) {
      e.stopPropagation();
    }
  };

  // Diagnostik: logga overlay vs stored vs export
  useEffect(() => {
    if (isSelected) {
      console.table({
        'Overlay (px)': rectPx,
        'Stored (pt)': textBox.rect,
        'Font Size (pt)': textBox.fontSizePt,
        'Font Size (px)': fontSizePx,
        'Line Height (px)': lineHeightPx,
        'Text': localText
      });
    }
  }, [isSelected, rectPx, textBox, fontSizePx, lineHeightPx, localText]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${rectPx.x}px`,
        top: `${rectPx.y}px`,
        width: `${rectPx.width}px`,
        height: `${rectPx.height}px`,
        border: isSelected ? '2px solid #0066ff' : '1px dashed rgba(0,0,0,0.3)',
        backgroundColor: 'transparent',
        cursor: 'move',
        boxSizing: 'border-box'
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <textarea
          ref={textRef}
          value={localText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          style={{
            width: '100%',
            height: '100%',
            fontSize: `${fontSizePx}px`,
            lineHeight: `${lineHeightPx}px`,
            fontFamily: textBox.fontFamily || 'Helvetica, Arial, sans-serif',
            fontWeight: textBox.fontWeight || 'normal',
            fontStyle: textBox.fontStyle || 'normal',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            resize: 'none',
            padding: 0,
            margin: 0
          }}
          autoFocus
        />
      ) : (
        <div
          ref={textRef}
          style={{
            width: '100%',
            height: '100%',
            fontSize: `${fontSizePx}px`,
            lineHeight: `${lineHeightPx}px`,
            fontFamily: textBox.fontFamily || 'Helvetica, Arial, sans-serif',
            color: textBox.color || '#000000',
            fontWeight: textBox.fontWeight || 'normal',
            fontStyle: textBox.fontStyle || 'normal',
            overflow: 'hidden',
            wordWrap: 'break-word'
          }}
        >
          {localText || 'Dubbelklicka för att redigera'}
        </div>
      )}
    </div>
  );
}

