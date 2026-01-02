import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LandingTopNav from './LandingTopNav';
import './LandingPage.css';

export default function LandingPage({ onFileSelect, onCreateNew }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const uploadCardRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
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

    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      onFileSelect(file);
    } else {
      alert(t('landingPage.dropPdfFile'));
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const scrollToUpload = () => {
    uploadCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="landingRoot">
      <LandingTopNav />

      <main className="landingMain">
        <section className="landingHero">
          <div className="landingHeroLeft">
            <h1 className="landingTitle">{t('landingPage.title')}</h1>
            <p className="landingSubtitle">{t('landingPage.subtitle')}</p>

            <div className="landingHeroCtas">
              <button
                type="button"
                className="landingBtn landingBtnPrimary"
                onClick={() => {
                  // Upload-kortet ligger i hero; öppna filväljaren direkt.
                  window.setTimeout(() => handleClick(), 0);
                }}
              >
                {t('landingPage.getStarted')}
              </button>

              <button
                type="button"
                className="landingBtn landingBtnSecondary"
                onClick={() => {
                  scrollToUpload();
                }}
              >
                {t('landingPage.openUploader')}
              </button>
            </div>
          </div>

          {/* Upload-kortet ligger i hero (höger kolumn) */}
          <div className="landingHeroRight" ref={uploadCardRef}>
            <div
              className={`landingUploadCard landingUploadCardInHero ${isDragging ? 'isDragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick();
                }
              }}
            >
              <div className="landingUploadPattern" aria-hidden="true" />

              <div className="landingUploadContent">
                <div className="landingUploadIcon" aria-hidden="true">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <h2 className="landingUploadTitle">{t('landingPage.dragDrop')}</h2>
                <p className="landingUploadSub">{t('landingPage.orClick')}</p>

                <div className="landingUploadActions">
                  <button
                    type="button"
                    className="landingBtn landingBtnPrimary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClick();
                    }}
                  >
                    {t('landingPage.chooseFile', 'Välj fil')}
                  </button>

                  <button
                    type="button"
                    className="landingBtn landingBtnGhost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateNew?.();
                    }}
                    title={t('landingPage.createNewHint', 'Skapa ett tomt dokument och börja från grunden')}
                  >
                    {t('landingPage.createNew', 'Skapa ny PDF')}
                  </button>
                </div>
              </div>

              <input
                id="pdf-file-input"
                name="pdf-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </section>

        <section className="landingFeatures">
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
            <div className="landingFeatureCard" key={index}>
              <div className="landingFeatureIcon" aria-hidden="true">
                {feature.icon}
              </div>
              <h3 className="landingFeatureTitle">{feature.title}</h3>
              <p className="landingFeatureDesc">{feature.description}</p>
            </div>
          ))}
        </section>

        <footer className="landingFooter">
          <p>{t('landingPage.footer', 'Stöd för flera sidor • Zoom-funktion • Undo/Redo')}</p>
        </footer>
      </main>
    </div>
  );
}
