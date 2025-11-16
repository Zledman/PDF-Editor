import { useState, useRef, useEffect } from 'react';
import { rectPtToPx, rectPxToPt } from '../utils/coordMap';

export default function PatchBox({ 
  patchBox, 
  zoom, 
  onUpdate, 
  onDelete,
  isSelected,
  pdfPage,
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
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
      };
      img.src = imageData;
    }
  }, [imageData]);

  // Om patchBox har sourceRect men inte imageData, rendera från PDF
  useEffect(() => {
    if (patchBox.sourceRect && !imageData && pdfPage) {
      renderPatchFromPDF(patchBox.sourceRect, patchBox.targetRect);
    }
  }, [patchBox.sourceRect, pdfPage]);

  const renderPatchFromPDF = async (sourceRectPt, targetRectPt) => {
    if (!pdfPage) return;

    try {
      const viewport = pdfPage.getViewport({ scale: 2.0 }); // Högre upplösning för bättre kvalitet
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');

      await pdfPage.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Klipp ut sourceRect-området
      const sourceRectPx = rectPtToPx(sourceRectPt, 2.0);
      const patchCanvas = document.createElement('canvas');
      patchCanvas.width = sourceRectPx.width;
      patchCanvas.height = sourceRectPx.height;
      const patchCtx = patchCanvas.getContext('2d');

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

      const base64 = patchCanvas.toDataURL('image/png');
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
    // Stoppa propagation endast om det inte är patch-verktyget som är aktivt
    // (för att tillåta drag när verktyget är aktivt)
    if (tool !== 'patch') {
      e.stopPropagation();
    }
  };

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
        cursor: isSelected && tool === 'patch' ? 'move' : 'default',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
      onMouseDown={handleMouseDown}
    >
      {imageData ? (
        <canvas
          ref={canvasRef}
          width={targetRectPx.width}
          height={targetRectPx.height}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
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
          color: '#666'
        }}>
          Laddar patch...
        </div>
      )}
    </div>
  );
}

