import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function LandingPage({ onFileSelect }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      onFileSelect(file);
    } else {
      alert(t('landingPage.selectPdfFile'));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      onFileSelect(file);
    } else {
      alert(t('landingPage.dropPdfFile'));
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1
          style={{
            fontSize: '3.5rem',
            fontWeight: '700',
            margin: '0 0 20px 0',
            background: 'linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          {t('landingPage.title')}
        </h1>
        <p
          style={{
            fontSize: '1.25rem',
            color: '#b0b0b0',
            margin: '0',
            maxWidth: '600px'
          }}
        >
          {t('landingPage.subtitle')}
        </p>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{
          width: '100%',
          maxWidth: '600px',
          minHeight: '400px',
          border: `3px dashed ${isDragging ? '#ff6b35' : '#444'}`,
          borderRadius: '20px',
          backgroundColor: isDragging ? 'rgba(255, 107, 53, 0.1)' : 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 40px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255, 107, 53, 0.1) 1px, transparent 0)',
            backgroundSize: '40px 40px',
            opacity: 0.3
          }}
        />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* Icon */}
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 107, 53, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 30px',
              border: '3px solid #ff6b35',
              transition: 'transform 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ff6b35"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <h2
            style={{
              fontSize: '2rem',
              fontWeight: '600',
              margin: '0 0 15px 0',
              color: '#fff'
            }}
          >
            {t('landingPage.dragDrop')}
          </h2>
          
          <p
            style={{
              fontSize: '1.1rem',
              color: '#888',
              margin: '0 0 30px 0'
            }}
          >
            {t('landingPage.orClick')}
          </p>

          <button
            style={{
              padding: '16px 40px',
              fontSize: '1.1rem',
              fontWeight: '600',
              color: '#fff',
              backgroundColor: '#ff6b35',
              border: 'none',
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(255, 107, 53, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ff8c42';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff6b35';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.4)';
            }}
          >
            Välj fil
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Features */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '30px',
          maxWidth: '900px',
          width: '100%',
          marginTop: '80px'
        }}
      >
        {[
          {
            icon: '✏️',
            title: 'Text',
            description: 'Lägg till och redigera text på din PDF'
          },
          {
            icon: '⬜',
            title: 'Whiteout',
            description: 'Täck över text med vita rektanglar'
          },
          {
            icon: '🔧',
            title: 'Kopiera område',
            description: 'Kopiera och flytta delar av PDF:en'
          }
        ].map((feature, index) => (
          <div
            key={index}
            style={{
              textAlign: 'center',
              padding: '30px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '15px',
              border: '1px solid rgba(255, 107, 53, 0.2)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.borderColor = '#ff6b35';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.2)';
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>
              {feature.icon}
            </div>
            <h3
              style={{
                fontSize: '1.3rem',
                fontWeight: '600',
                margin: '0 0 10px 0',
                color: '#ff6b35'
              }}
            >
              {feature.title}
            </h3>
            <p
              style={{
                fontSize: '0.95rem',
                color: '#b0b0b0',
                margin: '0',
                lineHeight: '1.5'
              }}
            >
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: '60px',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.9rem'
        }}
      >
        <p style={{ margin: '0' }}>
          Stöd för flera sidor • Zoom-funktion • Undo/Redo
        </p>
      </div>
    </div>
  );
}

