import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { rectPtToPx } from '../utils/coordMap';

// Clamp-funktion för att säkerställa att värde är inom min/max
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const DEFAULT_COMMENT_COLOR = '#FFF59D';

function expandHex(hex) {
  if (!hex) return null;
  const h = hex.trim().replace('#', '');
  if (h.length === 3) return h.split('').map((c) => c + c).join('');
  if (h.length === 6) return h;
  return null;
}

function hexToRgb(hex) {
  const h = expandHex(hex);
  if (!h) return null;
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function componentToHex(c) {
  const clamped = Math.max(0, Math.min(255, Math.round(c)));
  const str = clamped.toString(16);
  return str.length === 1 ? '0' + str : str;
}

function adjustLightness(hex, delta) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return (
    '#' +
    componentToHex(rgb.r + delta) +
    componentToHex(rgb.g + delta) +
    componentToHex(rgb.b + delta)
  );
}

function createGradient(colorInput) {
  const base = (colorInput || DEFAULT_COMMENT_COLOR).trim();
  if (hexToRgb(base)) {
    const light = adjustLightness(base, 40);
    const dark = adjustLightness(base, -25);
    return `linear-gradient(180deg, ${light} 0%, ${dark} 100%)`;
  }
  return `linear-gradient(180deg, ${base} 0%, ${base} 100%)`;
}

export default function CommentBox({
  commentBox,
  zoom,
  onUpdate,
  onDelete,
  onEditEnd,
  isSelected,
  forceHidePopup = false
}) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [localText, setLocalText] = useState(commentBox.text || '');
  const [popupHeight, setPopupHeight] = useState(0);
  const [popupWidth, setPopupWidth] = useState(0);
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const popupRef = useRef(null);

  // Konvertera pt till px för visning
  const rectPx = rectPtToPx(commentBox.rect, zoom);

  // Markör-storlek (sticky note-storlek)
  const markerSize = 24; // 24px för sticky note-utseende

  useEffect(() => {
    setLocalText(commentBox.text || '');
    // Om kommentaren är ny, öppna redigeringsläge automatiskt
    if (commentBox.isNew && !isEditing) {
      setIsEditing(true);
      setIsHovering(true);
    }
  }, [commentBox.text, commentBox.isNew, isEditing]);

  // Fokusera textarea när redigeringsläge aktiveras
  useEffect(() => {
    if (isEditing && textRef.current) {
      setTimeout(() => {
        if (textRef.current) {
          textRef.current.focus();
          try {
            const length = textRef.current.value.length;
            textRef.current.setSelectionRange(length, length);
          } catch (e) { }
        }
      }, 10);
    }
  }, [isEditing]);

  const handleTextChange = (e) => {
    setLocalText(e.target.value);
  };

  const commitEdit = useCallback((nextTarget) => {
    // Hoppa över om fokus/klick hamnar i kommentar-sidomenyn eller färgvalet
    if (nextTarget && (
      nextTarget.closest?.('[data-comment-sidebar]') ||
      nextTarget.closest?.('[data-comment-color-picker]')
    )) {
      return;
    }
    setIsEditing(false);
    setIsHovering(false); // Stäng också hover när redigering avslutas
    if (onUpdate) {
      // Ta bort isNew-flaggan när vi sparar
      const updated = {
        ...commentBox,
        text: localText,
        isNew: false,
        timestamp: new Date().toISOString()
      };
      onUpdate(updated);
    }
    // Anropa callback för att avaktivera comment-verktyget
    if (onEditEnd) {
      onEditEnd();
    }
  }, [commentBox, localText, onUpdate, onEditEnd]);

  const handleBlur = (e) => {
    const nextTarget = e?.relatedTarget || document.activeElement;
    commitEdit(nextTarget);
  };

  const handleKeyDown = (e) => {
    // Låt Enter skapa ny rad; endast Escape avbryter redigering
    if (e.key === 'Escape') {
      setLocalText(commentBox.text || '');
      setIsEditing(false);
    }
  };

  const handleMarkerClick = (e) => {
    // Öppna redigeringsläge när man klickar på markören
    if (!isEditing) {
      e.stopPropagation();
      setIsEditing(true);
      setIsHovering(true); // Behåll hover när man redigerar
      return;
    }
    // Annars låt App.jsx hantera markering
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = (e) => {
    // Kontrollera om musen lämnar både markören och popup:en
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && (
      containerRef.current?.contains(relatedTarget) ||
      popupRef.current?.contains(relatedTarget)
    )) {
      return;
    }
    // Stäng inte hover om redigeringsläge är aktivt
    if (!isEditing) {
      setIsHovering(false);
    }
  };

  // Stäng kommentarsrutan vid klick utanför när redigeringsläge är aktivt
  useEffect(() => {
    if (!isEditing) return;
    const handleDocumentMouseDown = (e) => {
      const target = e.target;
      const insidePopup = popupRef.current?.contains(target);
      const insideMarker = containerRef.current?.contains(target);
      const inSidebar = target.closest?.('[data-comment-sidebar]');
      const inColorPicker = target.closest?.('[data-comment-color-picker]');
      if (insidePopup || insideMarker || inSidebar || inColorPicker) return;
      commitEdit(target);
    };
    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [isEditing, commitEdit]);

  // Uppdatera popup-dimensioner
  const updatePopupDimensions = useCallback(() => {
    if (!popupRef.current) {
      return;
    }
    const { offsetHeight, offsetWidth } = popupRef.current;
    setPopupHeight(offsetHeight);
    setPopupWidth(offsetWidth);
  }, []);

  // Auto-open edit mode when selected (e.g. from sidebar)
  useEffect(() => {
    if (isSelected && !isEditing) {
      if (forceHidePopup) return; // Don't open if explicitly hidden (e.g. drag)
      setIsEditing(true);
      setIsHovering(true);
    }
  }, [isSelected, forceHidePopup]);

  // Uppdatera dimensioner när popup visas eller innehåll ändras
  useEffect(() => {
    if ((isHovering && !isEditing && localText) || isEditing) {
      setTimeout(updatePopupDimensions, 0);
    }
  }, [isHovering, isEditing, localText, updatePopupDimensions]);

  // Beräkna popup-position
  const getPopupPosition = useCallback(() => {
    if (!containerRef.current) {
      return { top: -120, left: 0 };
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    const markerTop = containerRect.top + scrollTop;
    const spacing = 2; // Minska avståndet mellan popup och markör
    const toolbarHeight = 300; // Ökad tröskel för att säkerställa att popup hamnar under ikonen nära toppen
    const estimatedPopupHeight = popupHeight > 0 ? popupHeight : 180; // Uppskattad höjd om inte beräknad ännu
    const shouldMoveBelow = containerRect.top - estimatedPopupHeight - spacing < toolbarHeight;

    const top = shouldMoveBelow
      ? markerSize + spacing
      : -popupHeight - spacing;

    const leftOffset = (markerSize - popupWidth) / 2;
    const viewportWidth = window.innerWidth;
    const containerLeft = containerRect.left;

    const left = clamp(
      leftOffset,
      -containerLeft + 10,
      viewportWidth - containerLeft - popupWidth - 10
    );

    return { top, left, shouldMoveBelow };
  }, [popupHeight, popupWidth, markerSize]);

  const popupPosition = getPopupPosition();
  const isStyleCalculationInProgress = popupWidth === 0 && popupHeight === 0;
  // Visa popup vid hover eller redigering (stängs ändå när kommentaren avmarkeras via effekt)
  const shouldShowPopup = (isHovering || isEditing) && !forceHidePopup;

  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDelete) {
      onDelete(commentBox.id || commentBox);
    }
    // Stäng redigering och hover när man tar bort
    setIsEditing(false);
    setIsHovering(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${rectPx.x}px`,
        top: `${rectPx.y}px`,
        width: `${markerSize}px`,
        height: `${markerSize}px`,
        zIndex: 15
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Sticky Note Marker */}
      <div
        data-comment-marker
        onClick={(e) => {
          // Låt klicket propagera till App.jsx för att aktivera verktyget
          // handleMarkerClick hanterar redigering om kommentaren redan är vald
          if (!isSelected) {
            // Om kommentaren inte är vald, låt klicket propagera för att aktivera verktyget
            return;
          }
          handleMarkerClick(e);
        }}
        onMouseDown={(e) => {
          // Låt ALLTID mousedown propagera till App.jsx för drag-funktionalitet
          // App.jsx behöver uppdatera dragStart med rätt koordinater
          // Drag startar endast om användaren faktiskt flyttar musen
        }}
        style={{
          width: `${markerSize}px`,
          height: `${markerSize}px`,
          backgroundColor: 'transparent', // Ingen bakgrund, bara ikon
          border: 'none',
          borderRadius: '0',
          cursor: isEditing ? 'text' : 'move',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          position: 'relative',
          zIndex: 21,
          pointerEvents: 'auto',
          transform: 'none',
        }}
      >
        {/* Dynamic Icon Rendering */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          style={{
            filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))',
            pointerEvents: 'none'
          }}
        >
          {(() => {
            const iconType = commentBox.icon || 'speech-bubble';
            const baseColor = commentBox.backgroundColor || '#FFF59D';
            const strokeColor = adjustLightness(baseColor, -40); // Darker shade for stroke

            const commonProps = {
              fill: baseColor,
              stroke: strokeColor,
              strokeWidth: "1.5", // Slightly thicker for better visibility
              strokeLinecap: "round",
              strokeLinejoin: "round"
            };

            switch (iconType) {
              case 'chevron-right':
                return <path d="M6 4l12 8-12 8" fill="none" stroke={baseColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }} />;
              // For line-based icons like chevron, we might want a different approach if they are "stickers". 
              // But the user requested shapes that "follow the color". 
              // Let's interpret "follow the color" as the shape itself is that color. 
              // For filled shapes (bubble, circle, star) it makes sense to Fill = color, Stroke = dark.
              // For line shapes (arrow, check, cross), having them as just Stroke = color might be too thin against PDF content.
              // Let's give them a "casing" or make them thick. 
              // Actually, the "thebestpdf.com" icons look like solid dark shapes.
              // But the user said "follow the color".
              // Let's try to make them all "filled" feeling or thick stroke.

              case 'arrow-right':
                return <path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke={baseColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }} />;

              case 'check':
                return <polyline points="20 6 9 17 4 12" fill="none" stroke={baseColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }} />;

              case 'cross':
                return <path d="M18 6L6 18M6 6l12 12" fill="none" stroke={baseColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }} />;

              case 'up-arrow':
                return <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke={baseColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }} />;

              case 'circle':
                return <circle cx="12" cy="12" r="9" fill="none" stroke={baseColor} strokeWidth="4" style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }} />;

              case 'triangle':
                // Warning triangle usually has ! inside, but here we just do the shape
                return <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" {...commonProps} />;

              case 'note':
                return <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...commonProps} />;

              case 'paragraph':
                return <path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13" fill="none" stroke={baseColor} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }} />;

              case 'question':
                return (
                  <g>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" fill="none" stroke={baseColor} strokeWidth="4" strokeLinecap="round" style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }} />
                    <circle cx="12" cy="17" r="1.5" fill={baseColor} stroke="none" style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }} />
                  </g>
                );

              case 'star':
                return <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" {...commonProps} />;

              case 'key':
                return (
                  <path
                    d="M22,18V22H18V19H15V16H12L9.74,13.74C9.19,13.91 8.61,14 8,14A6,6 0 0,1 2,8A6,6 0 0,1 8,2A6,6 0 0,1 14,8C14,8.61 13.91,9.19 13.74,9.74L22,18M7,5A2,2 0 0,0 5,7A2,2 0 0,0 7,9A2,2 0 0,0 9,7A2,2 0 0,0 7,5Z"
                    fill={baseColor}
                    stroke={strokeColor}
                    strokeWidth="1"
                    style={{ filter: `drop-shadow(1px 1px 0px ${strokeColor})` }}
                  />
                );

              case 'speech-bubble':
              default:
                return (
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    {...commonProps}
                  />
                );
            }
          })()}
        </svg>
      </div>

      {/* Popup som visas vid hover eller redigering */}
      {shouldShowPopup && (
        <div
          ref={popupRef}
          data-comment-popup
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseDown={(e) => {
            // Stoppa propagation så att klick på popup inte skapar nya kommentarer
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Stoppa propagation så att klick på popup inte skapar nya kommentarer
            e.stopPropagation();
          }}
          style={{
            position: 'absolute',
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            minWidth: '220px',
            maxWidth: '300px',
            background: createGradient(commentBox.backgroundColor),
            borderRadius: '8px',
            boxShadow: '2px 2px 8px rgba(0,0,0,0.3)',
            zIndex: isEditing ? 20 : 19,
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
            lineHeight: '1.4',
            color: '#333',
            pointerEvents: 'auto',
            padding: '0',
            visibility: isStyleCalculationInProgress ? 'hidden' : 'visible',
            border: 'none',
            overflow: 'hidden'
          }}
        >
          {/* Rubrik med stäng-knapp - post-it stil */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 10px',
            borderBottom: '1px solid rgba(0,0,0,0.1)'
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#333',
              userSelect: 'none'
            }}>
              {t('comments.comment')}
            </span>
            <button
              onClick={handleDelete}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#555',
                padding: '0',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '2px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ×
            </button>
          </div>

          {/* Kommentar-innehåll - post-it stil */}
          <div style={{ padding: '10px' }}>
            {isEditing ? (
              <textarea
                ref={textRef}
                value={localText}
                onChange={handleTextChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder={t('comments.writeComment')}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  maxHeight: '200px',
                  padding: '0',
                  border: 'none',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent', // Transparent för att visa post-it färg
                  color: '#333', // Mörk text
                  lineHeight: '1.5',
                  display: 'block',
                  margin: 0
                }}
              />
            ) : (
              <div style={{
                minHeight: '100px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#333',
                lineHeight: '1.5',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}>
                {localText || <span style={{ color: '#666', fontStyle: 'italic' }}>{t('comments.writeComment')}</span>}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
