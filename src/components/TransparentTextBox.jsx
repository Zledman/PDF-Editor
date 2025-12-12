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
  tool = null // Aktuellt verktyg för cursor-styling
}) {
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [localText, setLocalText] = useState(textBox.text || '');
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const hasAutoFocused = useRef(false); // Spåra om vi redan har fokuserat för autoEdit

  // Konvertera pt till px för visning
  const rectPx = rectPtToPx(textBox.rect, zoom);
  const fontSizePx = ptToPx(textBox.fontSizePt || 12, zoom);
  // Använd en mer kompakt line-height för mindre utrymme under texten
  const lineHeightPx = fontSizePx * 1.1; // Minskat från LINE_HEIGHT_FACTOR (1.2) till 1.1

  useEffect(() => {
    setLocalText(textBox.text || '');
  }, [textBox.text]);

  // Om autoEdit är true, starta redigering automatiskt när komponenten monteras
  useEffect(() => {
    if (autoEdit && !isEditing) {
      setIsEditing(true);
      hasAutoFocused.current = false; // Återställ när autoEdit aktiveras
    } else if (!autoEdit) {
      hasAutoFocused.current = false; // Återställ när autoEdit är false
    }
  }, [autoEdit, isEditing]);

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
    setLocalText(e.target.value);
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
            tempSpan.textContent = e.target.value || ' ';
            document.body.appendChild(tempSpan);
            
            const textRect = tempSpan.getBoundingClientRect();
            const exactWidth = textRect.width;
            const exactHeight = textRect.height;
            
            document.body.removeChild(tempSpan);
            
            // Lägg till lite extra utrymme för descenders (g, j, p, q, y) - ca 20% av fontstorleken
            // Men max 3px för att hålla det minimalt
            const descenderPadding = Math.min(3, fontSizePx * 0.2);
            const newHeightPx = Math.max(fontSizePx, exactHeight + descenderPadding);
            
            // Minimal fast padding (1px) för att den sista bokstaven inte ska klippas bort
            const newWidthPx = Math.max(fontSizePx * 0.6, exactWidth + 1);
            
            // Uppdatera textarea först för att säkerställa korrekt mätning
            textRef.current.style.width = `${newWidthPx}px`;
            textRef.current.style.height = `${newHeightPx}px`;
            
            // Uppdatera container till exakt samma mått - ingen extra padding eller margin
            containerRef.current.style.width = `${newWidthPx}px`;
            containerRef.current.style.height = `${newHeightPx}px`;
            
            // Uppdatera textrutan med ny höjd och bredd (för persistent lagring)
            if (onUpdate) {
              const newWidthPt = pxToPt(newWidthPx, zoom);
              const newHeightPt = pxToPt(newHeightPx, zoom);
              
              onUpdate({
                ...textBox,
                text: e.target.value,
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
            tempSpan.textContent = localText || ' ';
            document.body.appendChild(tempSpan);
            
            const textRect = tempSpan.getBoundingClientRect();
            const exactWidth = textRect.width;
            const exactHeight = textRect.height;
            
            document.body.removeChild(tempSpan);
            
            // Lägg till lite extra utrymme för descenders (g, j, p, q, y) - ca 20% av fontstorleken
            // Men max 3px för att hålla det minimalt
            const descenderPadding = Math.min(3, fontSizePx * 0.2);
            const newHeightPx = Math.max(fontSizePx, exactHeight + descenderPadding);
            
            // Minimal fast padding (1px) för att den sista bokstaven inte ska klippas bort
            const newWidthPx = Math.max(fontSizePx * 0.6, exactWidth + 1);
            
            // Uppdatera textarea först för att säkerställa korrekt mätning
            textRef.current.style.width = `${newWidthPx}px`;
            textRef.current.style.height = `${newHeightPx}px`;
            
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
              textRef.current.style.lineHeight = `${actualHeightPx}px`; // Sätt line-height till containerns höjd för att rymma descenders
            }
          }
        });
      });
    }
  }, [localText, isEditing, fontSizePx, rectPx.height, rectPx.width, textBox.fontFamily, textBox.fontWeight, textBox.fontStyle]);

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
      data-textbox-container-index={textBoxIndex}
      style={{
        position: 'absolute',
        left: `${rectPx.x}px`,
        top: `${rectPx.y}px`,
        // width och height sätts via JavaScript för exakt kontroll
        minWidth: `${fontSizePx * 0.6}px`, // Minst en bokstav
        padding: 0,
        margin: 0,
        border: 'none', // Använd outline istället för att undvika layout-påverkan
        outline: isSelected ? '2px solid #0066ff' : 'none',
        outlineOffset: '0px', // Ingen offset för att outline ska ligga exakt på kanten
        backgroundColor: 'transparent',
        cursor: isEditing ? 'text' : (tool === null ? 'pointer' : (isSelected && !isEditing ? 'move' : 'default')),
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
        zIndex: 10 // Text ska alltid ligga överst, ovanpå patch boxes
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
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
            width: localText ? 'auto' : `${fontSizePx * 0.6}px`, // Minimal bredd när tom, annars auto
            minWidth: `${fontSizePx * 0.6}px`, // Minst bredd för en bokstav
            maxWidth: 'none', // Ingen max-bredd
            minHeight: `${fontSizePx}px`, // Minst en rad höjd
            height: 'auto', // Låt textarea expandera automatiskt
            fontSize: `${fontSizePx}px`,
            lineHeight: `${fontSizePx}px`, // Använd exakt fontstorlek för line-height för tajt passning
            fontFamily: textBox.fontFamily || 'Helvetica, Arial, sans-serif',
            fontWeight: textBox.fontWeight || 'normal',
            fontStyle: textBox.fontStyle || 'normal',
            color: textBox.color || '#000000', // Sätt textfärg för att säkerställa kontrast
            caretColor: '#000000', // Svart textmarkör för tydlig synlighet
            border: 'none',
            outline: 'none',
            background: 'transparent',
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
            width: 'auto', // Låt div:en anpassa sig till textens faktiska bredd
            minWidth: `${fontSizePx * 0.6}px`, // Minst en bokstav
            fontSize: `${fontSizePx}px`,
            // lineHeight och height sätts dynamiskt via JavaScript för att rymma descenders
            fontFamily: textBox.fontFamily || 'Helvetica, Arial, sans-serif',
            color: textBox.color || '#000000',
            fontWeight: textBox.fontWeight || 'normal',
            fontStyle: textBox.fontStyle || 'normal',
            overflow: 'visible', // Ändra till visible så att descenders inte klipps
            whiteSpace: 'pre', // Behåll whitespace exakt
            wordWrap: 'normal', // Bryt inte ord automatiskt
            display: 'inline-block', // Låt div:en anpassa sig till innehållet
            padding: 0,
            margin: 0,
            verticalAlign: 'top', // Justera toppen för tajt passning
            userSelect: 'none', // Förhindra text selection när man drar/resize:ar
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
        >
          {localText || ''}
        </div>
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

