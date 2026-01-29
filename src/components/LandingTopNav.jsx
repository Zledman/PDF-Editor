import { useTranslation } from 'react-i18next';
import './LandingTopNav.css';
import { ToolIcon } from './ToolIcons';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from './ThemeToggle';

import LanguageSelector from './LanguageSelector';

export default function LandingTopNav({ enabledTools = [], onToolSelect = null }) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const comingSoon = t('landingPage.comingSoon', 'Kommer snart');
  const enabledSet = new Set(enabledTools || []);

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
    { key: 'translatePdf', label: t('landingPage.nav.translatePdf'), disabled: false, isBeta: true },
    { key: 'pricing', label: t('landingPage.nav.pricing'), disabled: false }
  ];

  return (
    <header className="landingNav">
      <div className="landingNavInner">
        <div className="landingNavLeft">
          <div className="landingBrand" aria-label="PDFMoment">
            <span className="landingBrandMark" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 8V6a2 2 0 0 1 2-2h2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 4h2a2 2 0 0 1 2 2v2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v2a2 2 0 0 0 2 2h2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 20h2a2 2 0 0 0 2-2v-2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                <circle cx="12" cy="12" r="3" fill="white" />
                <path d="M12 19c-4 0-7-3-7-7s3-7 7-7 7 3 7 7-3 7-7 7z" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
              </svg>
            </span>
            <span className="landingBrandText">
              <span className="landingBrandPdf">PDF</span>
              <span className="landingBrandMoment">Moment</span>
            </span>
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
                        (() => {
                          const isEnabled = enabledSet.has(tool.key);
                          const tooltipDesc = t(`landingPage.tools.tooltips.${tool.key}`, '');
                          const title = isEnabled ? tooltipDesc || tool.label : comingSoon;
                          const ariaDisabled = isEnabled ? 'false' : 'true';
                          const className = `landingToolItem ${isEnabled ? 'isEnabled' : 'isDisabled'}`;
                          return (
                            <button
                              key={tool.key}
                              type="button"
                              className={className}
                              title={title}
                              aria-disabled={ariaDisabled}
                              onClick={(e) => {
                                if (!isEnabled) {
                                  e.preventDefault();
                                  return;
                                }
                                e.preventDefault();
                                onToolSelect?.(tool.key);
                              }}
                            >
                              <ToolIcon toolKey={tool.key} color={tool.color} />
                              <span className="landingToolLabel">{tool.label}</span>
                            </button>
                          );
                        })()
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
                  if (item.key === 'translatePdf' || item.key === 'pricing') {
                    e.preventDefault();
                    onToolSelect?.(item.key);
                    return;
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {item.label}
                {item.isBeta && <span className="landingNavBeta">Beta</span>}
              </button>
            );
          })}
        </nav>

        <div className="landingNavRight">
          <LanguageSelector />
          <ThemeToggle />

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


