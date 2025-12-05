import { useTranslation } from 'react-i18next';

export default function FloatingControlBar({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  zoom, 
  onZoomIn, 
  onZoomOut, 
  panToolActive, 
  onPanToolToggle,
  sidebarWidth = 0
}) {
  const { t } = useTranslation();
  
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: `calc(50vw + ${sidebarWidth}px / 2)`,
        transform: 'translateX(-50%)',
        backgroundColor: '#3a3a3a',
        borderRadius: '25px',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0,0, 0.4)',
        minWidth: '400px',
        justifyContent: 'center'
      }}
    >
      {/* Page Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#d0d0d0', fontSize: '14px', fontWeight: '500' }}>
          {t('floatingControlBar.page')}:
        </span>
        <button
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          style={{
            background: 'transparent',
            border: 'none',
            color: currentPage === 1 ? '#666' : '#d0d0d0',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage > 1) {
              e.currentTarget.style.color = '#fff';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage > 1) {
              e.currentTarget.style.color = '#d0d0d0';
            }
          }}
          title={t('floatingControlBar.previousPage')}
        >
          ^
        </button>
        <span style={{ color: '#d0d0d0', fontSize: '14px', minWidth: '40px', textAlign: 'center' }}>
          {currentPage}/{totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          style={{
            background: 'transparent',
            border: 'none',
            color: currentPage === totalPages ? '#666' : '#d0d0d0',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage < totalPages) {
              e.currentTarget.style.color = '#fff';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage < totalPages) {
              e.currentTarget.style.color = '#d0d0d0';
            }
          }}
          title={t('floatingControlBar.nextPage')}
        >
          v
        </button>
      </div>

      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#d0d0d0',
          cursor: 'pointer',
          fontSize: '18px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s ease',
          borderRadius: '4px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#d0d0d0';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title={t('floatingControlBar.zoomIn')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="11" y1="8" x2="11" y2="14"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </button>

      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#d0d0d0',
          cursor: 'pointer',
          fontSize: '18px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s ease',
          borderRadius: '4px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#d0d0d0';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title={t('floatingControlBar.zoomOut')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </button>

      {/* Pan Tool - Hand Icon */}
      <button
        onClick={onPanToolToggle}
        style={{
          background: panToolActive ? 'rgba(255, 107, 53, 0.2)' : 'transparent',
          border: panToolActive ? '1px solid #ff6b35' : 'none',
          color: panToolActive ? '#ff6b35' : '#d0d0d0',
          cursor: 'pointer',
          fontSize: '18px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          borderRadius: '4px'
        }}
        onMouseEnter={(e) => {
          if (!panToolActive) {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!panToolActive) {
            e.currentTarget.style.color = '#d0d0d0';
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
        title={t('floatingControlBar.panTool')}
      >
        {/* Hand icon - öppen hand som matchar grab cursor */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Öppen hand - minimalistisk outline design med handflata framåt och fem fingrar */}
          {/* Tumme (vänster sida, vinklad utåt och nedåt) */}
          <path d="M5.5 16.5c0-1.2 1-2.2 2.2-2.2h1.3c.5 0 .8.2 1.1.5"></path>
          <path d="M5.5 16.5v2.5"></path>
          {/* Handflata (bred, kurvar nedåt mot botten) */}
          <path d="M7 19c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-4.5"></path>
          {/* Pekfinger (rak, parallell) */}
          <path d="M8.5 13v-5.5c0-1.1-.9-2-2-2"></path>
          <path d="M8.5 13v3.5"></path>
          {/* Långfinger (längst, rak) */}
          <path d="M12 1V0c0-1.1-.9-2-2-2"></path>
          <path d="M12 1v8.5"></path>
          {/* Ringfinger (rak, parallell) */}
          <path d="M15.5 3.5v-3.5c0-1.1-.9-2-2-2"></path>
          <path d="M15.5 3.5v3.5"></path>
          {/* Lillfinger (rak, parallell) */}
          <path d="M19 5.5v-2.5c0-1.1-.9-2-2-2"></path>
          <path d="M19 5.5v2.5"></path>
        </svg>
      </button>
    </div>
  );
}
