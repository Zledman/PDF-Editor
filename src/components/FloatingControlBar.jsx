import { useTranslation } from 'react-i18next';
import './FloatingControlBar.css';
import {
  ChevronUpIcon, ChevronDownIcon, ZoomInIcon, ZoomOutIcon, PanIcon
} from './EditorToolbarIcons';

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
      className="floatingBar"
      style={{ left: `calc(50vw + ${sidebarWidth}px / 2)` }}
    >
      {/* Page Navigation */}
      <div className="floatingBar__group floatingBar__group--pages">
        <span className="floatingBar__label">{t('floatingControlBar.page')}</span>
        <button
          type="button"
          className="floatingBar__btn floatingBar__btn--chevron"
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          title={t('floatingControlBar.previousPage')}
          aria-label={t('floatingControlBar.previousPage')}
        >
          <ChevronUpIcon />
        </button>
        <span className="floatingBar__count">{currentPage} / {totalPages}</span>
        <button
          type="button"
          className="floatingBar__btn floatingBar__btn--chevron"
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          title={t('floatingControlBar.nextPage')}
          aria-label={t('floatingControlBar.nextPage')}
        >
          <ChevronDownIcon />
        </button>
      </div>

      <div className="floatingBar__divider" />

      {/* Zoom + Pan */}
      <div className="floatingBar__group">
        <button
          type="button"
          className="floatingBar__btn"
          onClick={onZoomIn}
          title={t('floatingControlBar.zoomIn')}
          aria-label={t('floatingControlBar.zoomIn')}
        >
          <ZoomInIcon />
        </button>
        <button
          type="button"
          className="floatingBar__btn"
          onClick={onZoomOut}
          title={t('floatingControlBar.zoomOut')}
          aria-label={t('floatingControlBar.zoomOut')}
        >
          <ZoomOutIcon />
        </button>
        <button
          type="button"
          className={`floatingBar__btn${panToolActive ? ' floatingBar__btn--active' : ''}`}
          onClick={onPanToolToggle}
          title={t('floatingControlBar.panTool')}
          aria-label={t('floatingControlBar.panTool')}
          aria-pressed={panToolActive}
        >
          <PanIcon />
        </button>
      </div>
    </div>
  );
}
