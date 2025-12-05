import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function DownloadModal({ isOpen, onClose, onDownload, defaultFilename = 'intyg_164879456' }) {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [filename, setFilename] = useState(defaultFilename);

  if (!isOpen) return null;

  const formats = [
    { id: 'pdf', name: 'PDF', icon: '📄' },
    { id: 'excel', name: 'Excel', icon: '📊' },
    { id: 'png', name: 'PNG', icon: '🖼️' },
    { id: 'jpg', name: 'JPG', icon: '🖼️' },
    { id: 'word', name: 'Word', icon: '📝' },
    { id: 'pptx', name: 'PPTX', icon: '📊' }
  ];

  const handleDownload = () => {
    onDownload(selectedFormat, filename);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '30px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            padding: '0',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f0f0';
            e.currentTarget.style.color = '#000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#666';
          }}
        >
          ×
        </button>

        {/* Header */}
        <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
          {t('downloadModal.title', 'Bra jobbat!')}
        </h2>
        <p style={{ margin: '0 0 25px 0', fontSize: '14px', color: '#666' }}>
          {t('downloadModal.subtitle', 'Välj ett filformat för att ladda ner din fil')}
        </p>

        {/* Format selection */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '25px'
          }}
        >
          {formats.map((format) => (
            <button
              key={format.id}
              onClick={() => setSelectedFormat(format.id)}
              style={{
                padding: '15px',
                border: selectedFormat === format.id ? '2px solid #0066ff' : '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: selectedFormat === format.id ? '#e6f2ff' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.2s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (selectedFormat !== format.id) {
                  e.currentTarget.style.borderColor = '#999';
                  e.currentTarget.style.backgroundColor = '#f9f9f9';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedFormat !== format.id) {
                  e.currentTarget.style.borderColor = '#ddd';
                  e.currentTarget.style.backgroundColor = '#fff';
                }
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: selectedFormat === format.id ? '2px solid #0066ff' : '2px solid #ccc',
                  backgroundColor: selectedFormat === format.id ? '#0066ff' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {selectedFormat === format.id && (
                  <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                )}
              </div>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>{format.icon}</span>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{format.name}</span>
            </button>
          ))}
        </div>

        {/* Filename input */}
        <div style={{ marginBottom: '25px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}
          >
            {t('downloadModal.filename', 'Filnamn')}
          </label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#fff',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9f9f9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff';
            }}
          >
            {t('downloadModal.cancel', 'Avbryt')}
          </button>
          <button
            onClick={handleDownload}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0066ff',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0052cc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0066ff';
            }}
          >
            {t('downloadModal.download', 'Ladda ner')}
          </button>
        </div>
      </div>
    </div>
  );
}

