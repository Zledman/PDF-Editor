import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function PageManagementPanel({ 
  pdfDoc, 
  numPages, 
  currentPage,
  onRotatePage,
  onDeletePage,
  onAddPage,
  onDuplicatePages,
  onMovePages,
  onClose 
}) {
  const { t } = useTranslation();
  const [selectedPages, setSelectedPages] = useState(new Set([currentPage]));
  const [rotationAngle, setRotationAngle] = useState(90);

  const handlePageSelect = (pageNum) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedPages(new Set(Array.from({ length: numPages }, (_, i) => i + 1)));
  };

  const handleDeselectAll = () => {
    setSelectedPages(new Set());
  };

  const handleRotate = () => {
    if (selectedPages.size === 0) {
      return;
    }
    onRotatePage(Array.from(selectedPages), rotationAngle);
    setSelectedPages(new Set());
  };

  const handleDelete = () => {
    if (selectedPages.size === 0) {
      return;
    }
    if (window.confirm(t('pageManagement.confirmDelete', { count: selectedPages.size }, `Vill du verkligen ta bort ${selectedPages.size} sida/sidor?`))) {
      onDeletePage(Array.from(selectedPages));
      setSelectedPages(new Set());
    }
  };

  const handleAddBlankPage = () => {
    onAddPage('blank');
  };

  const handleAddPageFromFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        onAddPage('fromFile', file);
      }
    };
    input.click();
  };

  const handleDuplicate = () => {
    if (selectedPages.size === 0) return;
    onDuplicatePages?.(Array.from(selectedPages));
    setSelectedPages(new Set());
  };

  const handleMoveUp = () => {
    if (selectedPages.size === 0) return;
    onMovePages?.(Array.from(selectedPages), 'up');
  };

  const handleMoveDown = () => {
    if (selectedPages.size === 0) return;
    onMovePages?.(Array.from(selectedPages), 'down');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#2a2a2a',
        border: '2px solid #ff6b35',
        borderRadius: '12px',
        padding: '25px',
        zIndex: 10000,
        minWidth: '500px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#fff', margin: 0, fontSize: '1.5rem' }}>
          {t('pageManagement.title', 'Sidhantering')}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={t('pageManagement.close', 'Stäng')}
        >
          ×
        </button>
      </div>

      {/* Sidval */}
      <div style={{ marginBottom: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>
            {t('pageManagement.selectPages', 'Välj sidor')} ({selectedPages.size} {t('pageManagement.selected', 'valda')})
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSelectAll}
              style={{
                padding: '6px 12px',
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {t('pageManagement.selectAll', 'Välj alla')}
            </button>
            <button
              onClick={handleDeselectAll}
              style={{
                padding: '6px 12px',
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {t('pageManagement.deselectAll', 'Avmarkera alla')}
            </button>
          </div>
        </div>
        
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: '10px',
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '10px',
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            border: '1px solid #444'
          }}
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => handlePageSelect(pageNum)}
              style={{
                padding: '12px',
                backgroundColor: selectedPages.has(pageNum) ? '#ff6b35' : '#333',
                color: '#fff',
                border: selectedPages.has(pageNum) ? '2px solid #ff6b35' : '1px solid #555',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: selectedPages.has(pageNum) ? '600' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              {t('pageManagement.page', 'Sida')} {pageNum}
            </button>
          ))}
        </div>
      </div>

      {/* Rotera sidor */}
      <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
        <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.1rem' }}>
          {t('pageManagement.rotatePages', 'Rotera sidor')}
        </h3>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ color: '#fff', fontSize: '0.9rem' }}>
              {t('pageManagement.angle', 'Vinkel')}:
            </label>
            <select
              id="rotation-angle"
              name="rotation-angle"
              value={rotationAngle}
              onChange={(e) => setRotationAngle(parseInt(e.target.value))}
              style={{
                padding: '6px 10px',
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </div>
          <button
            onClick={handleRotate}
            disabled={selectedPages.size === 0}
            style={{
              padding: '8px 20px',
              backgroundColor: selectedPages.size > 0 ? '#ff6b35' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedPages.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              fontWeight: '600',
              opacity: selectedPages.size > 0 ? 1 : 0.5
            }}
          >
            {t('pageManagement.rotate', 'Rotera')}
          </button>
        </div>
      </div>

      {/* Ta bort sidor */}
      <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
        <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.1rem' }}>
          {t('pageManagement.deletePages', 'Ta bort sidor')}
        </h3>
        <button
          onClick={handleDelete}
          disabled={selectedPages.size === 0 || numPages === 1}
          style={{
            padding: '8px 20px',
            backgroundColor: (selectedPages.size > 0 && numPages > 1) ? '#dc3545' : '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: (selectedPages.size > 0 && numPages > 1) ? 'pointer' : 'not-allowed',
            fontSize: '0.9rem',
            fontWeight: '600',
            opacity: (selectedPages.size > 0 && numPages > 1) ? 1 : 0.5
          }}
        >
          {t('pageManagement.delete', 'Ta bort')} {selectedPages.size > 0 ? `(${selectedPages.size})` : ''}
        </button>
        {numPages === 1 && (
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '10px 0 0 0' }}>
            {t('pageManagement.cannotDeleteLast', 'Kan inte ta bort sista sidan')}
          </p>
        )}
      </div>

      {/* Lägg till sidor */}
      <div style={{ padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
        <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.1rem' }}>
          {t('pageManagement.addPages', 'Lägg till sidor')}
        </h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleAddBlankPage}
            style={{
              padding: '8px 20px',
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            {t('pageManagement.addBlankPage', 'Lägg till tom sida')}
          </button>
          <button
            onClick={handleAddPageFromFile}
            style={{
              padding: '8px 20px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            {t('pageManagement.addFromFile', 'Lägg till från fil')}
          </button>
        </div>
      </div>

      {/* Ordna om / duplicera */}
      <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
        <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.1rem' }}>
          {t('pageManagement.organize', 'Ordna sidor')}
        </h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleDuplicate}
            disabled={selectedPages.size === 0}
            style={{
              padding: '8px 20px',
              backgroundColor: selectedPages.size > 0 ? '#17a2b8' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedPages.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              fontWeight: '600',
              opacity: selectedPages.size > 0 ? 1 : 0.5
            }}
          >
            {t('pageManagement.duplicate', 'Duplicera')}
          </button>

          <button
            onClick={handleMoveUp}
            disabled={selectedPages.size === 0}
            style={{
              padding: '8px 20px',
              backgroundColor: selectedPages.size > 0 ? '#6c757d' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedPages.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              fontWeight: '600',
              opacity: selectedPages.size > 0 ? 1 : 0.5
            }}
          >
            {t('pageManagement.moveUp', 'Flytta upp')}
          </button>

          <button
            onClick={handleMoveDown}
            disabled={selectedPages.size === 0}
            style={{
              padding: '8px 20px',
              backgroundColor: selectedPages.size > 0 ? '#6c757d' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedPages.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              fontWeight: '600',
              opacity: selectedPages.size > 0 ? 1 : 0.5
            }}
          >
            {t('pageManagement.moveDown', 'Flytta ner')}
          </button>
        </div>
      </div>
    </div>
  );
}

