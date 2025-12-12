import { useState, useRef, useEffect } from 'react';
import { rectPtToPx, rectPxToPt } from '../utils/coordMap';

export default function PatchBox({ 
  patchBox, 
  zoom, 
  onUpdate, 
  onDelete,
  isSelected,
  pdfPage, // Target page (där patchen ska visas)
  sourcePdfPage, // Source page (där patchen kopieras från)
  pdfPageNum,
  tool = null
}) {
  const [imageData, setImageData] = useState(patchBox.imageData || null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Konvertera pt till px för visning
  const targetRectPx = rectPtToPx(patchBox.targetRect, zoom);

  useEffect(() => {
    if (imageData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const img = new Image();
      img.onload = () => {
        // Använd bildens faktiska dimensioner för canvas för att behålla skärpan
        // Canvas-storleken ska matcha bildens upplösning, inte CSS-storleken
        const imgWidth = img.naturalWidth || img.width;
        const imgHeight = img.naturalHeight || img.height;
        
        // Sätt canvas-storleken till bildens faktiska dimensioner
        canvasRef.current.width = imgWidth;
        canvasRef.current.height = imgHeight;
        
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        // Rita bilden i full upplösning
        ctx.drawImage(img, 0, 0);
      };
      img.src = imageData;
    }
  }, [imageData]);

  // Om patchBox har sourceRect men inte imageData, rendera från PDF
  // Använd sourcePdfPage om den finns, annars fallback till pdfPage (för bakåtkompatibilitet)
  useEffect(() => {
    const pageToUse = sourcePdfPage || pdfPage;
    if (patchBox.sourceRect && !imageData && pageToUse) {
      renderPatchFromPDF(patchBox.sourceRect, patchBox.targetRect, pageToUse);
    }
  }, [patchBox.sourceRect, pdfPage, sourcePdfPage]);

  const renderPatchFromPDF = async (sourceRectPt, targetRectPt, pageToRender = null) => {
    const page = pageToRender || pdfPage;
    if (!page) return;

    try {
      // Använd högre upplösning baserat på zoom för att behålla skärpan
      // Öka scale ytterligare för att säkerställa hög kvalitet även vid zoom
      const renderScale = Math.max(2.0, zoom * 2.0); // Minst 2x, eller zoom * 2 för bättre kvalitet
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Klipp ut sourceRect-området med samma scale
      const sourceRectPx = rectPtToPx(sourceRectPt, renderScale);
      const patchCanvas = document.createElement('canvas');
      patchCanvas.width = sourceRectPx.width;
      patchCanvas.height = sourceRectPx.height;
      const patchCtx = patchCanvas.getContext('2d');

      // Använd imageSmoothingEnabled för bättre kvalitet
      patchCtx.imageSmoothingEnabled = true;
      patchCtx.imageSmoothingQuality = 'high';

      patchCtx.drawImage(
        canvas,
        sourceRectPx.x,
        sourceRectPx.y,
        sourceRectPx.width,
        sourceRectPx.height,
        0,
        0,
        sourceRectPx.width,
        sourceRectPx.height
      );

      // Använd högre kvalitet för PNG-export
      const base64 = patchCanvas.toDataURL('image/png', 1.0);
      setImageData(base64);

      if (onUpdate) {
        onUpdate({
          ...patchBox,
          imageData: base64
        });
      }
    } catch (error) {
      console.error('Fel vid rendering av patch:', error);
    }
  };

  const handleMouseDown = (e) => {
    // Låt patch-verktyget eller selektionslogiken hantera klick när tool === null
    if (tool === 'patch' || tool === null) {
      // Låt patch-verktyget/selektionslogiken hantera klick
      return;
    }
    // För alla andra verktyg (inklusive text), låt klick gå igenom
    // (pointerEvents: 'none' borde redan hantera detta, men detta är en extra säkerhet)
  };
  
  // Cursor: pointer när tool === null, move när vald och verktyget är aktivt, annars default
  let cursorStyle = 'default';
  if (tool === null) {
    cursorStyle = 'pointer';
  } else if (isSelected && tool === 'patch') {
    cursorStyle = 'move';
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${targetRectPx.x}px`,
        top: `${targetRectPx.y}px`,
        width: `${targetRectPx.width}px`,
        height: `${targetRectPx.height}px`,
        border: isSelected && tool === 'patch' ? '2px solid #00ff00' : tool === 'patch' ? '1px dashed rgba(0,255,0,0.5)' : 'none',
        cursor: cursorStyle,
        boxSizing: 'border-box',
        overflow: 'hidden',
        zIndex: 1, // Patch boxes ska ligga under text boxes
        pointerEvents: (tool === null || tool === 'patch') ? 'auto' : 'none' // Tillåt klick när tool === null (för selektion) eller när patch-verktyget är aktivt
      }}
      onMouseDown={(tool === null || tool === 'patch') ? handleMouseDown : undefined}
    >
      {imageData ? (
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            imageRendering: 'crisp-edges', // Förhindra bilineär interpolation
            pointerEvents: tool === 'patch' ? 'auto' : 'none' // Följ samma logik som parent
          }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,255,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: '#666',
          pointerEvents: tool === 'patch' ? 'auto' : 'none' // Följ samma logik som parent
        }}>
          Laddar patch...
        </div>
      )}
    </div>
  );
}

