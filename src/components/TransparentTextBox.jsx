import { useState, useRef, useEffect } from 'react';
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
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [localText, setLocalText] = useState(textBox.text || '');
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
  // För importerad text: låt containern växa när textBox.rect expanderar (t.ex. fler rader),
  // men behåll minst originalstorleken så masken täcker originaltexten.
  const containerRectPx = textBox.isImported
    ? {
      x: rectPx.x,
      y: rectPx.y,
      width: Math.max(rectPx.width, maskSizePx.width),
      height: Math.max(rectPx.height, maskSizePx.height)
    }
    : rectPx;
  const fontSizePx = ptToPx(textBox.fontSizePt || 12, zoom);
  // Använd en mer kompakt line-height för mindre utrymme under texten
  const lineHeightPx = fontSizePx * 1.1; // Minskat från LINE_HEIGHT_FACTOR (1.2) till 1.1

  // Dölj importerad, icke-ändrad text tills den redigeras eller ändras
  const isImportedGhost = textBox.isImported && !textBox.isDirty && !isEditing;
  const displayColor = isImportedGhost ? 'transparent' : (textBox.color || '#000000');
  const showMask = textBox.isImported && (textBox.isDirty || isEditing);
  // Opak fallback så originaltext inte syns igenom innan sampling
  const maskColor = textBox.maskColor || 'rgba(255,255,255,1)';
  const maskPadTop = 0.1;
  const maskPadBottom = 0.3;
  // Z-ordning: dirty importerad text måste ligga över andra importerade boxes.
  // Men om en dirty box är "tom" (användaren raderade texten) ska dess mask inte kunna skymma andra nya texter.
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
              textRef.current.focus();
              // Sätt cursor i början
              try {
                textRef.current.setSelectionRange(0, 0);
              } catch (e) {
                // Ignorera om setSelectionRange inte fungerar
              }
              hasAutoFocused.current = true;
            }
          }, 50); // Liten delay för att säkerställa att textarea är helt renderad
        });
      } else if (!autoEdit) {
        // För manuell redigering (dubbelklick), fokusera direkt
        setTimeout(() => {
          if (textRef.current) {
            textRef.current.focus();
            // Sätt cursor i slutet av texten
            try {
              const length = textRef.current.value.length;
              textRef.current.setSelectionRange(length, length);
            } catch (e) {
              // Ignorera om setSelectionRange inte fungerar
            }
          }
        }, 10);
      }
    }
  }, [isEditing, autoEdit]);

  const handleTextChange = (e) => {
    const nextText = normalizeNewlines(e.target.value);
    setLocalText(nextText);
    // Auto-expand textarea baserat på innehåll (både höjd och bredd)
    if (textRef.current && containerRef.current) {
      // Återställ höjd och bredd först för att få korrekt scrollHeight/scrollWidth
      textRef.current.style.height = 'auto';
      textRef.current.style.width = 'auto';
      textRef.current.style.lineHeight = `${fontSizePx}px`; // Sätt line-height till exakt fontstorlek för tajt passning

      // Vänta lite för att browser ska beräkna scrollHeight korrekt
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { // Dubbel rAF för säker mätning
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

            // Minimal fast padding (1px) för att den sista bokstaven inte ska klippas bort
            const newWidthPx = Math.max(fontSizePx * 0.6, exactWidth + 1);

            // Uppdatera textarea först för att säkerställa korrekt mätning
            textRef.current.style.width = `${newWidthPx}px`;
            textRef.current.style.height = `${newHeightPx}px`;
            // Förhindra att textarea "scrollar" internt när man gör en ny tom rad
            textRef.current.scrollTop = 0;

            // Uppdatera container till exakt samma mått - ingen extra padding eller margin
            containerRef.current.style.width = `${newWidthPx}px`;
            containerRef.current.style.height = `${newHeightPx}px`;

            // Uppdatera textrutan med ny höjd och bredd (för persistent lagring)
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
    if (isEditing && textRef.current && containerRef.current) {
      // Sätt textarea till auto-höjd och auto-bredd först för att få korrekt scrollHeight/scrollWidth
      textRef.current.style.height = 'auto';
      textRef.current.style.width = 'auto';
      textRef.current.style.lineHeight = `${fontSizePx}px`; // Sätt line-height till exakt fontstorlek

      // Vänta lite för att browser ska beräkna scrollHeight korrekt
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { // Dubbel rAF för säker mätning
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
            tempSpan.textContent = textForMeasure(localText);
            document.body.appendChild(tempSpan);

            const textRect = tempSpan.getBoundingClientRect();
            const exactWidth = textRect.width;
            const exactHeight = textRect.height;

            document.body.removeChild(tempSpan);

            // Lägg till lite extra utrymme för descenders (g, j, p, q, y) - ca 20% av fontstorleken
            // Men max 3px för att hålla det minimalt
            const descenderPadding = Math.min(3, fontSizePx * 0.2);
            const minHeightByLines = Math.max(1, lineCountOf(localText)) * fontSizePx;
            const newHeightPx = Math.max(minHeightByLines, exactHeight + descenderPadding);

            // Minimal fast padding (1px) för att den sista bokstaven inte ska klippas bort
            const newWidthPx = Math.max(fontSizePx * 0.6, exactWidth + 1);

            // Uppdatera textarea först för att säkerställa korrekt mätning
            textRef.current.style.width = `${newWidthPx}px`;
            textRef.current.style.height = `${newHeightPx}px`;
            textRef.current.scrollTop = 0;

            // Uppdatera container till exakt samma mått - ingen extra padding eller margin
            containerRef.current.style.width = `${newWidthPx}px`;
            containerRef.current.style.height = `${newHeightPx}px`;
          }
        });
      });
    } else if (!isEditing && textRef.current && containerRef.current) {
      // När inte i edit-läge, mät textens faktiska storlek och anpassa containern
      // Sätt lineHeight först för korrekt mätning
      if (textRef.current) {
        textRef.current.style.lineHeight = `${fontSizePx}px`;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { // Dubbel rAF för säker mätning
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

            // Uppdatera container-storlek till exakt samma mått som texten - ingen extra padding eller margin
            containerRef.current.style.width = `${actualWidthPx}px`;
            containerRef.current.style.height = `${actualHeightPx}px`;

            // Uppdatera även div:ens höjd för att säkerställa att descenders inte klipps
            if (textRef.current) {
              textRef.current.style.height = `${actualHeightPx}px`;
              // Behåll normal radavstånd även i visningsläge för att undvika stora mellanrum
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
  const handles = isSelected && !isEditing ? [
    { position: 'nw', style: { top: -handleOffset, left: -handleOffset, cursor: 'nw-resize' } },
    { position: 'n', style: { top: -handleOffset, left: '50%', marginLeft: -handleSize / 2, cursor: 'n-resize' } },
    { position: 'ne', style: { top: -handleOffset, right: -handleOffset, cursor: 'ne-resize' } },
    { position: 'e', style: { top: '50%', right: -handleOffset, marginTop: -handleSize / 2, cursor: 'e-resize' } },
    { position: 'se', style: { bottom: -handleOffset, right: -handleOffset, cursor: 'se-resize' } },
    { position: 's', style: { bottom: -handleOffset, left: '50%', marginLeft: -handleSize / 2, cursor: 's-resize' } },
    { position: 'sw', style: { bottom: -handleOffset, left: -handleOffset, cursor: 'sw-resize' } },
    { position: 'w', style: { top: '50%', left: -handleOffset, marginTop: -handleSize / 2, cursor: 'w-resize' } }
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
        minHeight: `${maskSizePx.height}px`, // Minst originalhöjd för importerad text
        padding: 0,
        margin: 0,
        border: 'none', // Använd outline istället för att undvika layout-påverkan
        outline: isSelected ? '2px solid #0066ff' : (hovered ? '2px solid rgba(0, 102, 255, 0.6)' : 'none'),
        boxShadow: hovered && !isSelected ? '0 0 0 2px rgba(0, 102, 255, 0.15)' : 'none',
        outlineOffset: '0px', // Ingen offset för att outline ska ligga exakt på kanten
        backgroundColor: 'transparent',
        cursor: isEditing ? 'text' : (tool === 'edit-text' ? 'text' : (tool === 'text' ? 'text' : (tool === null ? 'pointer' : (isSelected && !isEditing ? 'move' : 'default')))),
        // När highlight-verktyget eller add-text verktyget är aktivt ska text-boxar inte fånga klick.
        pointerEvents: (tool === 'highlight' || tool === 'text') ? 'none' : 'auto',
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
        <textarea
          id={textBoxIndex !== null ? `textbox-textarea-${textBoxIndex}` : undefined}
          name={textBoxIndex !== null ? `textbox-${textBoxIndex}` : undefined}
          ref={textRef}
          data-textbox-index={textBoxIndex}
          value={localText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          style={{
            width: '100%', // Fyll maskytan för att täcka originaltext
            minWidth: '100%',
            maxWidth: '100%',
            minHeight: '100%',
            height: '100%', // Täck hela ytan
            fontSize: `${fontSizePx}px`,
            lineHeight: `${fontSizePx}px`, // Använd exakt fontstorlek för line-height för tajt passning
            fontFamily: textBox.fontFamily || 'Helvetica, Arial, sans-serif',
            fontWeight: textBox.fontWeight || 'normal',
            fontStyle: textBox.fontStyle || 'normal',
            color: displayColor, // Dölj importerad text tills den ändrats
            caretColor: '#000000', // Svart textmarkör för tydlig synlighet
            border: 'none',
            outline: 'none',
            background: 'transparent',
            position: 'relative',
            zIndex: 1,
            resize: 'none',
            padding: 0,
            margin: 0,
            overflow: 'hidden', // Dölj scrollbar
            whiteSpace: 'pre', // Behåll whitespace exakt, radbrytning endast vid Enter
            transition: 'height 0.2s ease, width 0.2s ease', // Mjuk animation vid expansion/krympning
            wordWrap: 'normal' // Bryt inte ord automatiskt, bara vid Enter
          }}
          autoFocus={autoEdit}
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

      {/* Mask-overlay för importerad ändrad text, med paddning för att undvika understrykning */}
      {showMask && (
        <div
          style={{
            position: 'absolute',
            top: `${maskPadTop}px`,
            left: 0,
            // Masken ska täcka originalområdet, inte nödvändigtvis hela expanderade containern
            width: `${maskSizePx.width}px`,
            height: `${Math.max(1, maskSizePx.height - maskPadTop - maskPadBottom)}px`,
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
    </div>
  );
}

