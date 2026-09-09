import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LINE_HEIGHT_FACTOR, MIN_FONT_PT } from '../utils/textLayoutConstants';
import { ptToPx, pxToPt, rectPtToPx, rectPxToPt } from '../utils/coordMap';

export default function TransparentTextBox({
  textBox,
  zoom,
  onUpdate,
  onDelete,
  isSelected,
  autoEdit = false, // Ny prop för att automatiskt starta redigering
  textBoxIndex = null, // Index för att kunna hitta textarea
  onResizeStart = null, // Callback för resize-start
  onRotationStart = null, // Callback för rotation-start
  onDragStart = null, // Callback för drag-start (flytta textbox)
  tool = null, // Aktuellt verktyg för cursor-styling
  hovered = false, // Visuell hover-ram i edit-text-läge
  onHoverChange = null, // Callback för hover enter/leave
  editTrigger = null, // Nytt värde för att öppna edit-läge (t.ex. klick i edit-text-läge)
  onEditComplete = null // Callback när blur inträffar
}) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [localText, setLocalText] = useState(textBox.text || '');
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const hasAutoFocused = useRef(false); // Spåra om vi redan har fokuserat för autoEdit

  // Normalisera radbrytningar för att undvika "dubbel-rader" (Windows CRLF \r\n / \r)
  const normalizeNewlines = (s = '') => String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Mät-text: om texten slutar med '\n' måste sista tomraden räknas in i höjden.
  const textForMeasure = (s = '') => {
    const t = normalizeNewlines(s);
    if (!t) return ' ';
    return t.endsWith('\n') ? `${t} ` : t;
  };

  const lineCountOf = (s = '') => {
    const t = normalizeNewlines(s);
    // Antal rader = antal '\n' + 1 (även om sista raden är tom)
    return (t.match(/\n/g)?.length ?? 0) + 1;
  };

  // Konvertera pt till px för visning
  const rectPx = rectPtToPx(textBox.rect, zoom);
  const originalRectPt = textBox.originalRect || textBox.rect;
  const maskSizePx = textBox.isImported
    ? rectPtToPx({ x: 0, y: 0, width: originalRectPt.width, height: originalRectPt.height }, zoom)
    : rectPx;
  // För importerad text: containern ska rymma texten men inte vara större än nödvändigt
  // (annars täcker den textrader under)
  const containerRectPx = textBox.isImported
    ? {
      x: rectPx.x,
      y: rectPx.y,
      width: Math.max(rectPx.width, maskSizePx.width),
      height: rectPx.height
    }
    : rectPx;
  const fontSizePx = ptToPx(textBox.fontSizePt || 12, zoom);
  // Använd en mer kompakt line-height för mindre utrymme under texten
  const lineHeightPx = fontSizePx * 1.1; // Minskat från LINE_HEIGHT_FACTOR (1.2) till 1.1

  // Ghost mode: unedited imported text is transparent (canvas shows through).
  // Edited (isDirty): mask covers canvas text using sampled background color.
  const isImportedGhost = textBox.isImported && !textBox.isDirty;
  const displayColor = isImportedGhost ? 'transparent' : (textBox.color || '#000000');
  const showMask = textBox.isImported && textBox.isDirty;
  // Use sampled background color from canvas (set during bold detection), fallback to white
  const maskColor = textBox.maskColor || 'rgba(255,255,255,1)';
  const maskPadX = fontSizePx * 0.1;
  const maskPadTop = fontSizePx * 0.15;
  // Boxens underkant ligger redan ~0.18×fontstorleken under baslinjen. Descenders
  // (g, y, p) når ~0.21, så en knapp marginal räcker — mer än så äter upp ram-
  // linjer som ligger tätt under texten.
  const maskPadBot = fontSizePx * 0.04;
  const effectiveMaskWidth = maskSizePx.width + maskPadX * 2;
  let effectiveMaskHeight = maskSizePx.height + maskPadTop + maskPadBot;
  // Ligger en ramlinje strax under texten har den mätts upp vid import: masken
  // klipps av ovanför linjen så att ramen inte suddas bort.
  if (textBox.maskMaxBottomPt != null) {
    // Maskens underkant i absolut sidkoordinat (px, uppifrån).
    const maskBottomPx = rectPx.y - maskPadTop + effectiveMaskHeight;
    const limitPx = ptToPx(textBox.maskMaxBottomPt, zoom);
    if (maskBottomPx > limitPx) {
      effectiveMaskHeight = Math.max(0, effectiveMaskHeight - (maskBottomPx - limitPx));
    }
  }
  const hasVisibleText = (textBox.text || '').trim().length > 0;
  const baseZ = (textBox.isImported && textBox.isDirty)
    ? (hasVisibleText ? 140 : 60)
    : 10;

  // Track if we just stopped editing (to avoid race condition with parent sync)
  const justStoppedEditingRef = useRef(false);

  useEffect(() => {
    // Only sync from parent when NOT editing AND not immediately after stopping editing.
    // This prevents race condition where isEditing becomes false before onUpdate's 
    // setState has processed, which would reset localText to old value.
    if (!isEditing && !justStoppedEditingRef.current) {
      setLocalText(normalizeNewlines(textBox.text || ''));
    }
    // Reset the flag AFTER a delay to allow parent state to fully propagate
    // This prevents the race condition where textBox.text prop updates
    // trigger another effect run after the flag was reset
    if (justStoppedEditingRef.current) {
      const timer = setTimeout(() => {
        justStoppedEditingRef.current = false;
      }, 100); // 100ms delay to let parent state settle
      return () => clearTimeout(timer);
    }
  }, [textBox.text, isEditing]);

  // Om autoEdit är true, starta redigering automatiskt när komponenten monteras
  useEffect(() => {
    if (autoEdit && !isEditing) {
      setIsEditing(true);
      hasAutoFocused.current = false; // Återställ när autoEdit aktiveras
    } else if (!autoEdit) {
      hasAutoFocused.current = false; // Återställ när autoEdit är false
    }
  }, [autoEdit, isEditing]);

  // Öppna redigering när nytt editTrigger skickas in (t.ex. från edit-text-verktyget)
  useEffect(() => {
    if (editTrigger !== null) {
      setIsEditing(true);
      hasAutoFocused.current = false;
    }
  }, [editTrigger]);

  // Fokusera textarea när den renderas i edit-läge (särskilt för autoEdit)
  useEffect(() => {
    if (isEditing && textRef.current) {
      // Om det är autoEdit och vi inte redan har fokuserat
      if (autoEdit && !hasAutoFocused.current) {
        // Använd requestAnimationFrame för att säkerställa att textarea är renderad
        requestAnimationFrame(() => {
          // Försök fokusera med en liten delay
          setTimeout(() => {
            if (textRef.current) {
              // Set contentEditable text content
              textRef.current.textContent = localText;
              textRef.current.focus();
              // Cursor at start for auto-edit
              try {
                const sel = window.getSelection();
                sel.collapse(textRef.current, 0);
              } catch (e) {}
              hasAutoFocused.current = true;
            }
          }, 50);
        });
      } else if (!autoEdit) {
        // Manual edit (double-click) — focus and cursor at end
        setTimeout(() => {
          if (textRef.current) {
            textRef.current.textContent = localText;
            textRef.current.focus();
            try {
              const sel = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(textRef.current);
              range.collapse(false); // collapse to end
              sel.removeAllRanges();
              sel.addRange(range);
            } catch (e) {}
          }
        }, 10);
      }
    }
  }, [isEditing, autoEdit]);

  // Prevent rich formatting in contentEditable — paste as plain text only
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // Handle Enter key to insert newline (not <br> or <div>)
  const handleContentEditableKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertText', false, '\n');
    }
  };

  // ContentEditable input handler
  const handleContentEditableInput = (e) => {
    const nextText = normalizeNewlines(e.target.textContent || '');
    setLocalText(nextText);

    // Auto-expand container
    if (textRef.current && containerRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (textRef.current && containerRef.current) {
            // Skapa en temporär span för exakt mätning av textens storlek
            const tempSpan = document.createElement('span');
            tempSpan.style.position = 'absolute';
            tempSpan.style.visibility = 'hidden';
            tempSpan.style.whiteSpace = 'pre';
            tempSpan.style.fontSize = `${fontSizePx}px`;
            tempSpan.style.lineHeight = `${fontSizePx}px`;
            tempSpan.style.fontFamily = textBox.fontFamily || 'Helvetica, Arial, sans-serif';
            tempSpan.style.fontWeight = textBox.fontWeight || 'normal';
            tempSpan.style.fontStyle = textBox.fontStyle || 'normal';
            tempSpan.style.padding = '0';
            tempSpan.style.margin = '0';
            tempSpan.style.border = 'none';
            tempSpan.textContent = textForMeasure(nextText);
            document.body.appendChild(tempSpan);

            const textRect = tempSpan.getBoundingClientRect();
            const exactWidth = textRect.width;
            const exactHeight = textRect.height;

            document.body.removeChild(tempSpan);

            // Lägg till lite extra utrymme för descenders (g, j, p, q, y) - ca 20% av fontstorleken
            // Men max 3px för att hålla det minimalt
            const descenderPadding = Math.min(3, fontSizePx * 0.2);
            const minHeightByLines = Math.max(1, lineCountOf(nextText)) * fontSizePx;
            const newHeightPx = Math.max(minHeightByLines, exactHeight + descenderPadding);

            const newWidthPx = Math.max(fontSizePx * 0.6, exactWidth + 2);

            // Only resize container — contentEditable div auto-sizes
            containerRef.current.style.width = `${newWidthPx}px`;
            containerRef.current.style.height = `${newHeightPx}px`;

            if (onUpdate) {
              const newWidthPt = pxToPt(newWidthPx, zoom);
              const newHeightPt = pxToPt(newHeightPx, zoom);

              onUpdate({
                ...textBox,
                text: nextText,
                rect: {
                  ...textBox.rect,
                  width: newWidthPt,
                  height: newHeightPt
                }
              });
            }
          }
        });
      });
    }
  };

  // Uppdatera container-höjd och bredd när textarea expanderar eller när edit-läge ändras
  useEffect(() => {
    if (isEditing && containerRef.current) {
      // ContentEditable div auto-sizes — just ensure container is big enough
      requestAnimationFrame(() => {
        if (textRef.current && containerRef.current) {
          const rect = textRef.current.getBoundingClientRect();
          containerRef.current.style.width = `${Math.max(containerRectPx.width, rect.width)}px`;
          containerRef.current.style.height = `${Math.max(containerRectPx.height, rect.height)}px`;
        }
      });
    } else if (!isEditing && textRef.current && containerRef.current) {
      // När inte i edit-läge, mät textens faktiska storlek och anpassa containern
      if (textRef.current) {
        textRef.current.style.lineHeight = `${fontSizePx}px`;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (textRef.current && containerRef.current) {
            // Skapa en temporär span för exakt mätning av textens storlek
            const tempSpan = document.createElement('span');
            tempSpan.style.position = 'absolute';
            tempSpan.style.visibility = 'hidden';
            tempSpan.style.whiteSpace = 'pre';
            tempSpan.style.fontSize = `${fontSizePx}px`;
            tempSpan.style.lineHeight = `${fontSizePx}px`;
            tempSpan.style.fontFamily = textBox.fontFamily || 'Helvetica, Arial, sans-serif';
            tempSpan.style.fontWeight = textBox.fontWeight || 'normal';
            tempSpan.style.fontStyle = textBox.fontStyle || 'normal';
            tempSpan.style.color = textBox.color || '#000000';
            tempSpan.style.padding = '0';
            tempSpan.style.margin = '0';
            tempSpan.style.border = 'none';
            tempSpan.textContent = localText || ' ';
            document.body.appendChild(tempSpan);

            const textRect = tempSpan.getBoundingClientRect();
            const exactWidth = textRect.width;
            const exactHeight = textRect.height;

            document.body.removeChild(tempSpan);

            // Lägg till lite extra utrymme för descenders (g, j, p, q, y) - ca 20% av fontstorleken
            // Men max 3px för att hålla det minimalt
            const descenderPadding = Math.min(3, fontSizePx * 0.2);

            // Beräkna faktisk storlek med minimal fast padding (1px) - samma som i edit-läge
            const actualWidthPx = Math.max(fontSizePx * 0.6, exactWidth + 1);
            // Använd exakt höjd från mätning + padding för descenders, minst en rad höjd
            const actualHeightPx = Math.max(fontSizePx, exactHeight + descenderPadding);

            containerRef.current.style.width = `${actualWidthPx}px`;
            containerRef.current.style.height = `${actualHeightPx}px`;
            if (textRef.current) {
              textRef.current.style.height = `${actualHeightPx}px`;
              textRef.current.style.lineHeight = `${fontSizePx}px`;
            }
          }
        });
      });
    }
  }, [localText, isEditing, fontSizePx, rectPx.height, rectPx.width, textBox.fontFamily, textBox.fontWeight, textBox.fontStyle]);

  const handleBlur = () => {
    // Set flag BEFORE changing isEditing to prevent race condition in sync useEffect
    justStoppedEditingRef.current = true;
    setIsEditing(false);
    const nextText = normalizeNewlines(localText);
    if (onUpdate) {
      onUpdate({
        ...textBox,
        text: nextText
      });
    }
    if (onEditComplete) {
      onEditComplete(textBoxIndex);
    }
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleMouseDown = (e) => {
    // Stoppa propagation endast om det inte är en resize-handle eller rotation-handle
    // (för att tillåta drag när textrutan är vald)
    if (e.target.dataset.resizeHandle) {
      e.stopPropagation();
      if (onResizeStart) {
        onResizeStart(e.target.dataset.resizeHandle, e);
      }
    } else if (e.target.dataset.rotationHandle) {
      e.stopPropagation();
      if (onRotationStart) {
        onRotationStart(e);
      }
    } else if (isEditing) {
      // Om vi är i edit-läge, stoppa propagation för att inte avmarkera
      e.stopPropagation();
    } else if (isSelected && onDragStart) {
      // Om textrutan är markerad och inte i edit-läge, starta drag för att flytta
      e.stopPropagation();
      onDragStart(e);
    }
  };

  // Diagnostik: logga overlay vs stored vs export (endast vid första markering, inte under resize)
  // Kommenterad ut för att undvika spam i konsolen under resize
  // useEffect(() => {
  //   if (isSelected) {
  //     console.table({
  //       'Overlay (px)': rectPx,
  //       'Stored (pt)': textBox.rect,
  //       'Font Size (pt)': textBox.fontSizePt,
  //       'Font Size (px)': fontSizePx,
  //       'Line Height (px)': lineHeightPx,
  //       'Text': localText
  //     });
  //   }
  // }, [isSelected, rectPx, textBox, fontSizePx, lineHeightPx, localText]);

  // Resize handles (endast när vald och inte i edit-läge)
  const handleSize = 8;
  // Offset för att flytta alla handles utanför textrutan för att undvika att täcka texten
  const handleOffset = handleSize; // Flytta handles längre ut
  // Only 4 corner handles (nw, ne, se, sw) - no edge handles
  const handles = isSelected && !isEditing ? [
    { position: 'nw', style: { top: -handleOffset, left: -handleOffset, cursor: 'nw-resize' } },
    { position: 'ne', style: { top: -handleOffset, right: -handleOffset, cursor: 'ne-resize' } },
    { position: 'se', style: { bottom: -handleOffset, right: -handleOffset, cursor: 'se-resize' } },
    { position: 'sw', style: { bottom: -handleOffset, left: -handleOffset, cursor: 'sw-resize' } }
  ] : [];

  return (
    <div
      ref={containerRef}
      data-textbox-container-index={textBoxIndex}
      style={{
        position: 'absolute',
        left: `${containerRectPx.x}px`,
        top: `${containerRectPx.y}px`,
        width: `${containerRectPx.width}px`,
        height: `${containerRectPx.height}px`,
        minWidth: `${maskSizePx.width}px`, // Minst originalbredd för importerad text
        padding: 0,
        margin: 0,
        border: 'none', // Använd outline istället för att undvika layout-påverkan
        outline: !isEditing && isSelected ? '2px solid #0066ff' : (!isEditing && hovered ? '2px solid rgba(0, 102, 255, 0.6)' : 'none'),
        boxShadow: !isEditing && hovered && !isSelected ? '0 0 0 2px rgba(0, 102, 255, 0.15)' : 'none',
        outlineOffset: '3px', // Lite luft mellan text och ram
        backgroundColor: 'transparent',
        cursor: isEditing ? 'text' : (tool === 'edit-text' ? 'text' : (tool === 'text' ? 'text' : (tool === null ? 'pointer' : (isSelected && !isEditing ? 'move' : 'default')))),
        // När highlight-verktyget är aktivt eller add-text är aktivt för ICKE-valda boxar, ska text-boxar inte fånga klick.
        // Men valda textrutor ska alltid kunna interageras med för resize/drag.
        pointerEvents: (tool === 'highlight' || (tool === 'text' && !isSelected)) ? 'none' : 'auto',
        boxSizing: 'content-box', // Använd content-box så att outline inte påverkar mått
        display: 'inline-block', // Låt containern expandera med innehållet
        overflow: 'visible', // Tillåt att descenders syns utanför containern om nödvändigt
        userSelect: isEditing ? 'auto' : 'none', // Förhindra text selection när man drar/resize:ar
        WebkitUserSelect: isEditing ? 'auto' : 'none',
        MozUserSelect: isEditing ? 'auto' : 'none',
        msUserSelect: isEditing ? 'auto' : 'none',
        transition: isEditing ? 'height 0.2s ease, width 0.2s ease' : 'none', // Mjuk animation vid expansion/krympning
        transform: `rotate(${textBox.rotation || 0}deg)`, // Applicera rotation
        transformOrigin: 'center', // Rotera runt centrum
        // Viktigt: många importerade text-items kan ligga överlappande. När en box blir "dirty"
        // (redigerad importerad text) måste den ligga över andra boxar/maskar även efter att den avmarkeras.
        zIndex: isEditing ? 200 : (isSelected ? 150 : baseZ),
        isolation: 'isolate' // Stabiliserar stacking context så masken aldrig hamnar "framför" texten
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => {
        if (onHoverChange) {
          onHoverChange(true);
        }
      }}
      onMouseLeave={() => {
        if (onHoverChange) {
          onHoverChange(false);
        }
      }}
    >
      {isEditing ? (
        <div
          id={textBoxIndex !== null ? `textbox-textarea-${textBoxIndex}` : undefined}
          ref={textRef}
          data-textbox-index={textBoxIndex}
          contentEditable
          suppressContentEditableWarning
          onInput={handleContentEditableInput}
          onKeyDown={handleContentEditableKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          style={{
            minWidth: '100%',
            minHeight: '100%',
            fontSize: `${fontSizePx}px`,
            lineHeight: `${fontSizePx}px`,
            fontFamily: textBox.fontFamily || 'Helvetica, Arial, sans-serif',
            fontWeight: textBox.fontWeight || 'normal',
            fontStyle: textBox.fontStyle || 'normal',
            color: displayColor,
            caretColor: '#000000',
            border: 'none',
            outline: '2px solid #0066ff',
            outlineOffset: '3px',
            background: 'transparent',
            position: 'relative',
            zIndex: 1,
            padding: 0,
            margin: 0,
            overflow: 'visible',
            whiteSpace: 'pre',
            wordWrap: 'normal',
            display: 'inline-block',
            cursor: 'text'
          }}
        />
      ) : (
        <div
          ref={textRef}
          style={{
            width: '100%', // Fyll maskytan
            minWidth: '100%',
            fontSize: `${fontSizePx}px`,
            // lineHeight och height sätts dynamiskt via JavaScript för att rymma descenders
            fontFamily: textBox.fontFamily || 'Helvetica, Arial, sans-serif',
            color: displayColor, // Dölj importerad text tills den ändrats
            fontWeight: textBox.fontWeight || 'normal',
            fontStyle: textBox.fontStyle || 'normal',
            overflow: 'visible', // Ändra till visible så att descenders inte klipps
            whiteSpace: 'pre', // Behåll whitespace exakt
            wordWrap: 'normal', // Bryt inte ord automatiskt
            display: 'inline-block', // Låt div:en anpassa sig till innehållet
            padding: 0,
            margin: 0,
            verticalAlign: 'top', // Justera toppen för tajt passning
            position: 'relative',
            zIndex: 1,
            userSelect: 'none', // Förhindra text selection när man drar/resize:ar
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
        >
          {localText || ''}
        </div>
      )}

      {/* Mask-overlay för importerad ändrad text — täcker exakt originalområdet */}
      {showMask && (
        <div
          style={{
            position: 'absolute',
            top: `${-maskPadTop}px`,
            left: `${-maskPadX}px`,
            width: `${effectiveMaskWidth}px`,
            height: `${effectiveMaskHeight}px`,
            backgroundColor: maskColor,
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
      )}

      {/* Resize handles */}
      {isSelected && !isEditing && handles.map((handle) => (
        <div
          key={handle.position}
          data-resize-handle={handle.position}
          style={{
            position: 'absolute',
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            backgroundColor: '#0066ff',
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

      {/* Linje mellan s-handle och rotation-handle */}
      {isSelected && !isEditing && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '100%',
            marginLeft: -1, // Centrera 1px bred linje
            marginTop: -handleOffset, // Börja från s-handlen (som är på -handleOffset från bottom)
            width: '2px',
            height: `${30 + handleOffset}px`, // Avstånd från s-handle till rotation-handle (30px + handleOffset)
            backgroundColor: '#0066ff',
            pointerEvents: 'none', // Låt klick gå igenom linjen
            zIndex: 9 // Under handles men över text
          }}
        />
      )}

      {/* Rotation handle - längre ner, centrerad */}
      {isSelected && !isEditing && (
        <div
          data-rotation-handle
          style={{
            position: 'absolute',
            left: '50%',
            top: '100%',
            marginLeft: -handleSize / 2,
            marginTop: 30, // Fast avstånd under textrutan
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            backgroundColor: '#0066ff',
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

      {/* Info button for imported text - shows font warning on hover */}
      {textBox.isImported && (isSelected || isEditing) && (
        <div
          style={{ position: 'absolute', top: '-20px', right: '-20px', zIndex: 300 }}
          onMouseEnter={() => setShowInfoTooltip(true)}
          onMouseLeave={() => setShowInfoTooltip(false)}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#0066ff',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 'bold',
              lineHeight: '16px',
              textAlign: 'center',
              cursor: 'default',
              fontFamily: 'serif',
              fontStyle: 'italic',
              userSelect: 'none',
              pointerEvents: 'auto'
            }}
          >
            i
          </div>
          {showInfoTooltip && (
            <div
              style={{
                position: 'absolute',
                top: '20px',
                right: '0',
                width: '220px',
                padding: '8px 10px',
                backgroundColor: '#333',
                color: '#fff',
                fontSize: '12px',
                lineHeight: '1.4',
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                pointerEvents: 'none',
                whiteSpace: 'normal',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: 'normal',
                fontStyle: 'normal'
              }}
            >
              {t('info.fontStyleWarning', 'Dokumentets originalfonter kan inte användas för redigering. Ändrad text kommer använda ett standardtypsnitt (Helvetica).')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

