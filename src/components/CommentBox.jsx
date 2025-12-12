import { useState, useRef, useEffect } from 'react';
import { rectPtToPx } from '../utils/coordMap';

export default function CommentBox({ 
  commentBox, 
  zoom, 
  onUpdate, 
  onDelete,
  isSelected,
  tool = null
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [localText, setLocalText] = useState(commentBox.text || '');
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const popupRef = useRef(null);

  // Konvertera pt till px för visning
  const rectPx = rectPtToPx(commentBox.rect, zoom);
  
  // Markör-storlek (fast storlek)
  const markerSize = 20; // 20px kvadratisk markör

  useEffect(() => {
    setLocalText(commentBox.text || '');
  }, [commentBox.text]);

  // Fokusera textarea när redigeringsläge aktiveras
  useEffect(() => {
    if (isEditing && textRef.current) {
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
  }, [isEditing]);

  const handleTextChange = (e) => {
    setLocalText(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onUpdate) {
      onUpdate({
        ...commentBox,
        text: localText
      });
    }
    // Ingen custom event längre - App.jsx hanterar verktyg-hantering
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalText(commentBox.text || ''); // Återställ ändringar
      setIsEditing(false);
    }
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setIsEditing(false);
    setIsHovering(false);
  };

  const handleMarkerClick = (e) => {
    // Om kommentaren redan är markerad, öppna redigeringsläge
    if (isSelected && !isEditing) {
      e.stopPropagation();
      setIsEditing(true);
      return;
    }
    // Annars låt App.jsx hantera markering (ingen stopPropagation)
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
      return; // Musen är fortfarande över kommentaren eller popup:en
    }
    // Stäng inte hover om redigeringsläge är aktivt
    if (!isEditing) {
      setIsHovering(false);
    }
  };

  // Beräkna popup-position (ovanför markören som standard)
  const getPopupPosition = () => {
    if (!popupRef.current || !containerRef.current) {
      return { top: -120, left: 0 }; // Fallback position ovanför
    }

    const popup = popupRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Popup ska vara ovanför markören
    const popupHeight = popup.offsetHeight || 100; // Fallback höjd
    const popupWidth = popup.offsetWidth || 200; // Fallback bredd
    
    // Standard position: ovanför markören, centrerad
    // Använd fast negativt värde för att säkerställa att markören är synlig
    let top = -popupHeight - 20; // 20px mellanrum för att säkerställa att markören är synlig
    let left = (markerSize - popupWidth) / 2; // Centrera horisontellt
    
    // Kontrollera om popup går utanför viewport och justera om nödvändigt
    const viewportWidth = window.innerWidth;
    const containerLeft = containerRect.left;
    const containerTop = containerRect.top;
    
    // Om popup går utanför höger kanten, flytta den
    if (containerLeft + rectPx.x + left + popupWidth > viewportWidth - 10) {
      left = viewportWidth - containerLeft - rectPx.x - popupWidth - 10;
    }
    
    // Om popup går utanför vänster kanten, flytta den
    if (containerLeft + rectPx.x + left < 10) {
      left = -rectPx.x + 10;
    }
    
    // Om det inte finns plats ovanför (t.ex. nära toppen av sidan), visa nedanför istället
    if (containerTop + rectPx.y + top < 10) {
      top = markerSize + 20; // Visa nedanför markören med 20px mellanrum
    }
    
    return { top, left };
  };

  const popupPosition = getPopupPosition();

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${rectPx.x}px`,
        top: `${rectPx.y}px`,
        width: `${markerSize}px`,
        height: `${markerSize}px`,
        zIndex: 15 // Kommentarer ska ligga över textrutor
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Markör-ruta - Talbubbla-form */}
      <div
        data-comment-marker
        onClick={handleMarkerClick}
        onMouseDown={(e) => {
          // Om kommentaren redan är markerad, stoppa propagation för att öppna redigering
          if (isSelected && !isEditing) {
            e.stopPropagation();
          }
          // Annars låt klick gå igenom för markering i App.jsx
        }}
        style={{
          width: `${markerSize}px`,
          height: `${markerSize}px`,
          backgroundColor: '#FFD700', // Mörkare gul färg
          border: isSelected ? '2px solid #0066ff' : '2px solid #FFC107', // Blå border när vald, annars mörkare gul
          borderRadius: '3px 3px 3px 0', // Rundade hörn utom nedre vänstra
          cursor: isEditing ? 'text' : 'move',
          boxShadow: isSelected ? '0 0 0 2px #0066ff' : '0 2px 4px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          position: 'relative',
          zIndex: 21, // Högre än popup:en (19) så markören ligger över och är klickbar
          pointerEvents: 'auto', // Säkerställ att markören är klickbar
          marginTop: '2px' // Liten offset för talbubbla-effekten
        }}
      >
        {/* Kommentar-ikon */}
        {!isEditing && (
          <span style={{ 
            fontSize: '10px', 
            color: '#333',
            fontWeight: 'bold',
            userSelect: 'none'
          }}>
            💬
          </span>
        )}
        {/* Triangulär utskjutning nedåt (talbubbla-pekare) */}
        <div style={{
          position: 'absolute',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '0',
          height: '0',
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: `6px solid ${isSelected ? '#0066ff' : '#FFD700'}`,
          zIndex: 22
        }} />
      </div>

      {/* Popup som visas vid hover */}
      {isHovering && !isEditing && localText && (
        <div
          ref={popupRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            minWidth: '200px',
            maxWidth: '300px',
            backgroundColor: '#FFF9C4', // Ljusgul bakgrund
            borderRadius: '8px 8px 4px 4px', // Rundade hörn, särskilt nedtill
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', // Subtila skuggor
            zIndex: 19, // Lägre än markören (21) så markören ligger över
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
            lineHeight: '1.4',
            color: '#333',
            pointerEvents: 'auto', // Tillåt interaktion med popup:en
            padding: '0'
          }}
        >
          {/* Rubrik med stäng-knapp */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            backgroundColor: 'rgba(255,255,255,0.3)',
            borderRadius: '8px 8px 0 0'
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#333',
              userSelect: 'none'
            }}>
              Anteckning
            </span>
            <button
              onClick={handleClose}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#666',
                padding: '0',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '3px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ×
            </button>
          </div>
          {/* Kommentar-text */}
          <div style={{
            padding: '10px 12px',
            fontSize: '14px',
            lineHeight: '1.4',
            color: '#333'
          }}>
            {localText}
          </div>
        </div>
      )}

      {/* Redigeringsläge */}
      {isEditing && (
        <div
          data-comment-editing
          onMouseDown={(e) => {
            e.stopPropagation(); // Stoppa propagation så att klick inte registreras i App.jsx
          }}
          onClick={(e) => {
            e.stopPropagation(); // Stoppa propagation så att klick inte registreras i App.jsx
          }}
          style={{
            position: 'absolute',
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            minWidth: '200px',
            maxWidth: '300px',
            backgroundColor: '#FFF9C4', // Ljusgul bakgrund
            border: '2px solid #0066ff',
            borderRadius: '8px 8px 4px 4px', // Rundade hörn, särskilt nedtill
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', // Subtila skuggor
            zIndex: 20,
            padding: '0'
          }}
        >
          {/* Rubrik med stäng-knapp */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            backgroundColor: 'rgba(255,255,255,0.3)',
            borderRadius: '8px 8px 0 0'
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#333',
              userSelect: 'none'
            }}>
              Anteckning
            </span>
            <button
              onClick={handleClose}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#666',
                padding: '0',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '3px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ×
            </button>
          </div>
          {/* Textarea */}
          <div style={{ padding: '10px 12px' }}>
            <textarea
              ref={textRef}
              value={localText}
              onChange={handleTextChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onMouseDown={(e) => {
                e.stopPropagation(); // Stoppa propagation så att klick inte registreras i App.jsx
              }}
              onClick={(e) => {
                e.stopPropagation(); // Stoppa propagation så att klick inte registreras i App.jsx
              }}
              placeholder="Skriv din kommentar..."
              style={{
                width: '100%',
                minHeight: '80px',
                maxHeight: '200px',
                padding: '8px',
                border: '1px solid rgba(0,0,0,0.2)',
                borderRadius: '3px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
                backgroundColor: '#fff'
              }}
            />
            <div style={{ 
              marginTop: '8px', 
              fontSize: '12px', 
              color: '#666',
              fontStyle: 'italic'
            }}>
              Tryck Enter för att spara, Esc för att avbryta
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

