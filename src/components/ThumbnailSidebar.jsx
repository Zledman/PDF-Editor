import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

export default function ThumbnailSidebar({ pdfDoc, currentPage, onPageSelect, zoom = 1.0, sidebarWidth: externalWidth, onWidthChange }) {
  const [thumbnails, setThumbnails] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(externalWidth || 200); // Startbredd i pixels
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
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
            // Explicitly pass page rotation to ensure correct orientation
            const rotation = page.rotate || 0;
            const viewport = page.getViewport({ scale: 0.5, rotation }); // Mindre scale för miniatyrer
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
              height: viewport.height,
              rotation: rotation
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
        top: 0,
        left: 0,
        bottom: 0,
        width: `${sidebarWidth}px`,
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'row',
        transition: isResizing ? 'none' : 'width 0.2s ease',
        zIndex: 5
      }}
    >
      {/* Scrollable thumbnail area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${thumbnailPadding}px`,
          paddingTop: `${thumbnailPadding + 10}px`,
          paddingRight: '4px' // Leave space for resize handle
        }}
      >
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
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0
              }}
            >
              {/* Image Container */}
              <div
                style={{
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                  cursor: 'pointer',
                  // Orange border for active state
                  border: isActive ? '3px solid #ff6b35' : '1px solid #e0e0e0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                  boxShadow: isActive ? '0 2px 8px rgba(255, 107, 53, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    // Hover color
                    e.currentTarget.style.borderColor = '#ffb088';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = '#e0e0e0';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
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
              </div>

              {/* Page number below image */}
              <div
                style={{
                  marginTop: '6px',
                  color: '#fff',
                  backgroundColor: isActive ? '#ff6b35' : '#757575',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: isActive ? '600' : '400',
                  pointerEvents: 'none',
                  minWidth: '20px',
                  textAlign: 'center'
                }}
              >
                {thumbnail.pageNum}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resize handle - now a sibling, always full height */}
      <div
        data-resize-handle="sidebar"
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHandleHovered(true)}
        onMouseLeave={() => setIsHandleHovered(false)}
        style={{
          width: '16px', // Wider hit area
          backgroundColor: isHandleHovered || isResizing ? 'rgba(0,0,0,0.05)' : 'transparent',
          cursor: 'col-resize',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderLeft: '1px solid #e0e0e0', // Visual separator
          transition: 'background-color 0.2s ease',
          position: 'relative'
        }}
      >
        {/* The visual Grip / Flärp */}
        <div
          style={{
            width: '4px',
            height: '32px',
            borderRadius: '2px',
            backgroundColor: isHandleHovered || isResizing ? '#ff6b35' : '#bbb', // Neutral grey -> Orange on interaction
            transition: 'background-color 0.2s ease',
            boxShadow: isHandleHovered || isResizing ? '0 0 4px rgba(255, 107, 53, 0.4)' : 'none'
          }}
        />
      </div>
    </div>
  );
}

