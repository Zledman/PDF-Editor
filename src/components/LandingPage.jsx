import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LandingTopNav from './LandingTopNav';
import './LandingPage.css';

export default function LandingPage({ onFileSelect, onCreateNew, onOpenTool, enabledTools = [] }) {
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

  return (
    <div className="landingRoot">
      <LandingTopNav enabledTools={enabledTools} onToolSelect={onOpenTool} />

      <main className="landingMain">
        <section className="landingHero">
          <div className="landingHeroLeft">
            <h1 className="landingTitle">
              <span className="landingTitlePdf">PDF</span>
              <span className="landingTitleMoment">Moment</span>
              <span className="landingEarlyAccess">{t('landingPage.earlyAccess')}</span>
            </h1>
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
              key: 'text'
            },
            {
              icon: '⬜',
              key: 'whiteout'
            },
            {
              icon: '🔧',
              key: 'copyArea'
            }
          ].map((feature) => (
            <div className="landingFeatureCard" key={feature.key}>
              <div className="landingFeatureIcon" aria-hidden="true">
                {feature.icon}
              </div>
              <h3 className="landingFeatureTitle">{t(`landingPage.features.${feature.key}.title`)}</h3>
              <p className="landingFeatureDesc">{t(`landingPage.features.${feature.key}.description`)}</p>
            </div>
          ))}
        </section>

        <section className="landingHowItWorks">
          <h2 className="landingSectionTitle">{t('howItWorks.title')}</h2>

          <div className="landingHowItWorksVisual">
            <div className="landingFlowStep">
              <div className="landingFlowIconBg">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            </div>

            <div className="landingFlowArrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>

            <div className="landingFlowStep landingFlowCentral">
              <div className="landingFlowIconBg">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <div className="landingFlowFloatingIcon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="landingFlowArrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>

            <div className="landingFlowStep">
              <div className="landingFlowIconBg isSuccess">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="12" y2="12" />
                  <line x1="15" y1="15" x2="12" y2="12" />
                </svg>
              </div>
            </div>
          </div>

          <div className="landingStepsRow">
            {[1, 2, 3].map((step) => (
              <div className="landingStepItem" key={step}>
                <span className="landingStepNumber">{step}</span>
                <div className="landingStepContent">
                  <h3 className="landingStepTitle">{t(`howItWorks.steps.${step}.title`)}</h3>
                  <p className="landingStepDesc">{t(`howItWorks.steps.${step}.description`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="landingFooter">
          <p>{t('landingPage.footer', 'Stöd för flera sidor • Zoom-funktion • Undo/Redo')}</p>
        </footer>
      </main>
    </div>
  );
}
