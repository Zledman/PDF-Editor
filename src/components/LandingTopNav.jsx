import { useTranslation } from 'react-i18next';
import './LandingTopNav.css';

export default function LandingTopNav() {
  const { t } = useTranslation();

  const comingSoon = t('landingPage.comingSoon', 'Kommer snart');

  const toolCategories = [
    {
      key: 'organize',
      title: t('landingPage.tools.categories.organize'),
      tools: [
        { key: 'mergePdf', label: t('landingPage.tools.mergePdf'), color: '#E76F51' },
        { key: 'splitPdf', label: t('landingPage.tools.splitPdf'), color: '#E76F51' },
        { key: 'removePages', label: t('landingPage.tools.removePages'), color: '#E76F51' },
        { key: 'extractPages', label: t('landingPage.tools.extractPages'), color: '#E76F51' },
        { key: 'organizePdf', label: t('landingPage.tools.organizePdf'), color: '#E76F51' },
        { key: 'scanToPdf', label: t('landingPage.tools.scanToPdf'), color: '#E76F51' }
      ]
    },
    {
      key: 'optimize',
      title: t('landingPage.tools.categories.optimize'),
      tools: [
        { key: 'compressPdf', label: t('landingPage.tools.compressPdf'), color: '#A7C957' },
        { key: 'repairPdf', label: t('landingPage.tools.repairPdf'), color: '#A7C957' },
        { key: 'ocrPdf', label: t('landingPage.tools.ocrPdf'), color: '#A7C957' }
      ]
    },
    {
      key: 'convertTo',
      title: t('landingPage.tools.categories.convertTo'),
      tools: [
        { key: 'jpgToPdf', label: t('landingPage.tools.jpgToPdf'), color: '#F4D35E' },
        { key: 'wordToPdf', label: t('landingPage.tools.wordToPdf'), color: '#4D8AE6' },
        { key: 'powerpointToPdf', label: t('landingPage.tools.powerpointToPdf'), color: '#E76F51' },
        { key: 'excelToPdf', label: t('landingPage.tools.excelToPdf'), color: '#2A9D8F' },
        { key: 'htmlToPdf', label: t('landingPage.tools.htmlToPdf'), color: '#F4D35E' }
      ]
    },
    {
      key: 'convertFrom',
      title: t('landingPage.tools.categories.convertFrom'),
      tools: [
        { key: 'pdfToJpg', label: t('landingPage.tools.pdfToJpg'), color: '#F4D35E' },
        { key: 'pdfToWord', label: t('landingPage.tools.pdfToWord'), color: '#4D8AE6' },
        { key: 'pdfToPowerpoint', label: t('landingPage.tools.pdfToPowerpoint'), color: '#E76F51' },
        { key: 'pdfToExcel', label: t('landingPage.tools.pdfToExcel'), color: '#2A9D8F' },
        { key: 'pdfToPdfA', label: t('landingPage.tools.pdfToPdfA'), color: '#7B7BEA' }
      ]
    },
    {
      key: 'edit',
      title: t('landingPage.tools.categories.edit'),
      tools: [
        { key: 'rotatePdf', label: t('landingPage.tools.rotatePdf'), color: '#A06CD5' },
        { key: 'addPageNumbers', label: t('landingPage.tools.addPageNumbers'), color: '#A06CD5' },
        { key: 'addWatermark', label: t('landingPage.tools.addWatermark'), color: '#A06CD5' },
        { key: 'cropPdf', label: t('landingPage.tools.cropPdf'), color: '#A06CD5' },
        { key: 'editPdf', label: t('landingPage.tools.editPdf'), color: '#A06CD5' }
      ]
    },
    {
      key: 'security',
      title: t('landingPage.tools.categories.security'),
      tools: [
        { key: 'unlockPdf', label: t('landingPage.tools.unlockPdf'), color: '#4D8AE6' },
        { key: 'protectPdf', label: t('landingPage.tools.protectPdf'), color: '#4D8AE6' },
        { key: 'signPdf', label: t('landingPage.tools.signPdf'), color: '#4D8AE6' },
        { key: 'redactPdf', label: t('landingPage.tools.redactPdf'), color: '#4D8AE6' },
        { key: 'comparePdf', label: t('landingPage.tools.comparePdf'), color: '#4D8AE6' }
      ]
    }
  ];

  const navItems = [
    { key: 'converter', label: t('landingPage.nav.pdfConverter'), disabled: true },
    { key: 'editor', label: t('landingPage.nav.pdfEditor'), disabled: false },
    { key: 'forms', label: t('landingPage.nav.forms'), disabled: true },
    { key: 'translate', label: t('landingPage.nav.translatePdf'), disabled: true }
  ];

  return (
    <header className="landingNav">
      <div className="landingNavInner">
        <div className="landingNavLeft">
          <div className="landingBrand" aria-label="PDF Editor">
            <span className="landingBrandMark" aria-hidden="true">
              P
            </span>
            <span className="landingBrandText">{t('landingPage.title')}</span>
          </div>
        </div>

        <nav className="landingNavCenter" aria-label={t('landingPage.nav.ariaLabel', 'Huvudmeny')}>
          <div className="landingToolsWrap">
            <button
              type="button"
              className="landingNavItem landingNavItemAllTools"
              aria-haspopup="true"
              aria-expanded="false"
              title={comingSoon}
              onClick={(e) => {
                // Menyn öppnas via hover/focus; click gör inget.
                e.preventDefault();
              }}
            >
              {t('landingPage.nav.allPdfTools')}
            </button>

            <div className="landingToolsMenu" role="menu" aria-label={t('landingPage.nav.allPdfTools')}>
              <div className="landingToolsGrid">
                {toolCategories.map((cat) => (
                  <div className="landingToolsCol" key={cat.key}>
                    <div className="landingToolsHeading">{cat.title}</div>
                    <div className="landingToolsList">
                      {cat.tools.map((tool) => (
                        <button
                          key={tool.key}
                          type="button"
                          className="landingToolItem"
                          title={comingSoon}
                          aria-disabled="true"
                          onClick={(e) => {
                            e.preventDefault();
                          }}
                        >
                          <span className="landingToolIcon" aria-hidden="true" style={{ '--toolColor': tool.color }} />
                          <span className="landingToolLabel">{tool.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {navItems.map((item) => {
            const className = `landingNavItem ${item.disabled ? 'isDisabled' : 'isActive'}`;
            const title = item.disabled ? comingSoon : undefined;
            return (
              <button
                key={item.key}
                type="button"
                className={className}
                title={title}
                aria-disabled={item.disabled ? 'true' : 'false'}
                onClick={(e) => {
                  if (item.disabled) {
                    e.preventDefault();
                    return;
                  }
                  // PDF Editor är redan den här sidan; no-op men behåll “active”-känsla.
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="landingNavRight">
          <button
            type="button"
            className="landingLoginBtn"
            title={comingSoon}
            aria-disabled="true"
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            {t('landingPage.nav.login')}
          </button>
        </div>
      </div>
    </header>
  );
}


