import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

export default function ThumbnailSidebar({ pdfDoc, currentPage, onPageSelect, zoom = 1.0, sidebarWidth: externalWidth, onWidthChange }) {
  const [thumbnails, setThumbnails] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(externalWidth || 200); // Startbredd i pixels
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const sidebarRef = useRef(null);
  const minWidth = 150;
  const maxWidth = 400;

  // Synka med extern width om den ändras (men inte om vi just ändrat den internt)
  const isInternalChange = useRef(false);
  useEffect(() => {
    if (externalWidth !== undefined && externalWidth !== sidebarWidth && !isInternalChange.current) {
      setSidebarWidth(externalWidth);
    }
    isInternalChange.current = false;
  }, [externalWidth, sidebarWidth]);

  // Notifiera parent om width-ändringar (men inte vid initial render eller när externalWidth ändras)
  const isInitialMount = useRef(true);
  const prevSidebarWidth = useRef(sidebarWidth);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevSidebarWidth.current = sidebarWidth;
      return;
    }
    // Bara notifiera om width faktiskt ändrats (och inte bara synkats från external)
    if (onWidthChange && sidebarWidth !== prevSidebarWidth.current && sidebarWidth !== externalWidth) {
      onWidthChange(sidebarWidth);
    }
    prevSidebarWidth.current = sidebarWidth;
  }, [sidebarWidth, onWidthChange, externalWidth]);

  // Rendera miniatyrer för alla sidor
  useEffect(() => {
    if (!pdfDoc) {
      setThumbnails([]);
      return;
    }

    const loadThumbnails = async () => {
      const thumbnailPromises = [];
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        thumbnailPromises.push(
          pdfDoc.getPage(pageNum).then(async (page) => {
            const viewport = page.getViewport({ scale: 0.5 }); // Mindre scale för miniatyrer
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;

            return {
              pageNum,
              dataUrl: canvas.toDataURL('image/png'),
              width: viewport.width,
              height: viewport.height
            };
          })
        );
      }

      const loadedThumbnails = await Promise.all(thumbnailPromises);
      setThumbnails(loadedThumbnails);
    };

    loadThumbnails();
  }, [pdfDoc]);

  const handleMouseDown = (e) => {
    if (e.target.dataset.resizeHandle === 'sidebar' || e.currentTarget.dataset.resizeHandle === 'sidebar') {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeStartX(e.clientX);
      setResizeStartWidth(sidebarWidth);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const diff = e.clientX - resizeStartX;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartWidth + diff));
        isInternalChange.current = true;
        setSidebarWidth(newWidth);
        if (onWidthChange) {
          onWidthChange(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStartX, resizeStartWidth, onWidthChange, minWidth, maxWidth]);

  if (!pdfDoc) {
    return null;
  }

  // Beräkna thumbnail-storlek baserat på sidebar-bredd
  // När sidebar blir större, blir miniatyrerna större (tills max-storlek)
  // När sidebar blir ännu större, visas fler miniatyrer bredvid varandra
  const thumbnailPadding = 20; // Ökad padding för mer utrymme
  const scrollbarWidth = 20;
  const availableWidth = sidebarWidth - thumbnailPadding * 2 - scrollbarWidth;
  const baseThumbnailWidth = 150; // Basstorlek för miniatyrer
  const maxThumbnailWidth = 250; // Max storlek per miniatyr
  const thumbnailWidth = Math.min(maxThumbnailWidth, Math.max(baseThumbnailWidth, availableWidth * 0.8)); // Lite mindre för att ge mer padding

  return (
    <div
      ref={sidebarRef}
      style={{
        position: 'absolute',
        top: 0, // Börja från toppen av parent container (som redan är under toolbar)
        left: 0,
        bottom: 0,
        width: `${sidebarWidth}px`,
        backgroundColor: '#2a2a2a',
        borderRight: '1px solid #444',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: `${thumbnailPadding}px`,
        paddingTop: `${thumbnailPadding + 10}px`, // Extra padding överst
        transition: isResizing ? 'none' : 'width 0.2s ease',
        zIndex: 5
      }}
    >
      {/* Resize handle */}
      <div
        data-resize-handle="sidebar"
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          backgroundColor: '#555',
          cursor: 'col-resize',
          zIndex: 100,
          transition: 'background-color 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#ff6b35';
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            e.currentTarget.style.backgroundColor = '#555';
          }
        }}
      />

      {/* Thumbnails */}
      {thumbnails.map((thumbnail) => {
        const aspectRatio = thumbnail.height / thumbnail.width;
        const displayWidth = thumbnailWidth;
        const displayHeight = displayWidth * aspectRatio;
        const isActive = thumbnail.pageNum === currentPage;

        return (
          <div
            key={thumbnail.pageNum}
            onClick={() => onPageSelect(thumbnail.pageNum)}
            style={{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              marginBottom: '15px',
              marginLeft: '10px', // Extra utrymme vänster
              marginRight: '10px', // Extra utrymme höger
              cursor: 'pointer',
              border: isActive ? '3px solid #ff6b35' : '2px solid #555',
              borderRadius: '4px',
              overflow: 'hidden',
              backgroundColor: '#fff',
              boxShadow: isActive 
                ? '0 4px 12px rgba(255, 107, 53, 0.4)' 
                : '0 2px 4px rgba(0,0,0,0.2)',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = '#888';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = '#555';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            <img
              src={thumbnail.dataUrl}
              alt={`Sida ${thumbnail.pageNum}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
            />
            {/* Sidnummer */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: isActive ? 'rgba(255, 107, 53, 0.9)' : 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                textAlign: 'center',
                padding: '4px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {thumbnail.pageNum}
            </div>
          </div>
        );
      })}
    </div>
  );
}

