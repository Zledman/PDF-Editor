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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: '#d0d0d0', fontSize: '16px', fontWeight: '500' }}>
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
            fontSize: '20px',
            padding: '6px 10px',
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
        <span style={{ color: '#d0d0d0', fontSize: '16px', minWidth: '50px', textAlign: 'center' }}>
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
            fontSize: '20px',
            padding: '6px 10px',
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        {/* Hand icon - user provided design */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 7C21 5.62 19.88 4.5 18.5 4.5C18.33 4.5 18.16 4.5 18 4.55V4C18 2.62 16.88 1.5 15.5 1.5C15.27 1.5 15.04 1.53 14.83 1.59C14.46 .66 13.56 0 12.5 0C11.27 0 10.25 .89 10.04 2.06C9.87 2 9.69 2 9.5 2C8.12 2 7 3.12 7 4.5V10.39C6.66 10.08 6.24 9.85 5.78 9.73L5 9.5C4.18 9.29 3.31 9.61 2.82 10.35C2.44 10.92 2.42 11.66 2.67 12.3L5.23 18.73C6.5 21.91 9.57 24 13 24C17.42 24 21 20.42 21 16V7M19 16C19 19.31 16.31 22 13 22C10.39 22 8.05 20.41 7.09 18L4.5 11.45L5 11.59C5.5 11.71 5.85 12.05 6 12.5L7 15H9V4.5C9 4.22 9.22 4 9.5 4S10 4.22 10 4.5V12H12V2.5C12 2.22 12.22 2 12.5 2S13 2.22 13 2.5V12H15V4C15 3.72 15.22 3.5 15.5 3.5S16 3.72 16 4V12H18V7C18 6.72 18.22 6.5 18.5 6.5S19 6.72 19 7V16Z" />
        </svg>
      </button>
    </div>
  );
}
