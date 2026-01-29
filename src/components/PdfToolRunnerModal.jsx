import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MergePdfTool from './MergePdfTool';
import SplitPdfTool from './SplitPdfTool';
import RemovePagesTool from './RemovePagesTool';
import ExtractPagesTool from './ExtractPagesTool';
import OrganizePdfTool from './OrganizePdfTool';
import ScanToPdfTool from './ScanToPdfTool';
import CompressPdfTool from './CompressPdfTool';
import RepairPdfTool from './RepairPdfTool';
import OcrPdfTool from './OcrPdfTool';
import JpgToPdfTool from './JpgToPdfTool';
import WordToPdfTool from './WordToPdfTool';
import PowerpointToPdfTool from './PowerpointToPdfTool';
import ExcelToPdfTool from './ExcelToPdfTool';
import HtmlToPdfTool from './HtmlToPdfTool';
import PdfToJpgTool from './PdfToJpgTool';
import PdfToWordTool from './PdfToWordTool';
import PdfToPowerpointTool from './PdfToPowerpointTool';
import PdfToExcelTool from './PdfToExcelTool';
import PdfToPdfATool from './PdfToPdfATool';
import RotatePdfTool from './RotatePdfTool';
import AddPageNumbersTool from './AddPageNumbersTool';
import AddWatermarkTool from './AddWatermarkTool';
import CropPdfTool from './CropPdfTool';
import EditPdfTool from './EditPdfTool';
import UnlockPdfTool from './UnlockPdfTool';
import ProtectPdfTool from './ProtectPdfTool';
import SignPdfTool from './SignPdfTool';
import RedactPdfTool from './RedactPdfTool';
import ComparePdfTool from './ComparePdfTool';
import TranslatePdfTool from './TranslatePdfTool';

const TOOL_META = {
  mergePdf: { titleKey: 'landingPage.tools.mergePdf', fallbackTitle: 'Merge PDF' },
  splitPdf: { titleKey: 'landingPage.tools.splitPdf', fallbackTitle: 'Split PDF' },
  removePages: { titleKey: 'landingPage.tools.removePages', fallbackTitle: 'Remove pages' },
  extractPages: { titleKey: 'landingPage.tools.extractPages', fallbackTitle: 'Extract pages' },
  organizePdf: { titleKey: 'landingPage.tools.organizePdf', fallbackTitle: 'Organize PDF' },
  scanToPdf: { titleKey: 'landingPage.tools.scanToPdf', fallbackTitle: 'Scan to PDF' },
  compressPdf: { titleKey: 'landingPage.tools.compressPdf', fallbackTitle: 'Compress PDF' },
  repairPdf: { titleKey: 'landingPage.tools.repairPdf', fallbackTitle: 'Repair PDF' },
  ocrPdf: { titleKey: 'landingPage.tools.ocrPdf', fallbackTitle: 'OCR PDF' },
  jpgToPdf: { titleKey: 'landingPage.tools.jpgToPdf', fallbackTitle: 'JPG to PDF' },
  wordToPdf: { titleKey: 'landingPage.tools.wordToPdf', fallbackTitle: 'WORD to PDF' },
  powerpointToPdf: { titleKey: 'landingPage.tools.powerpointToPdf', fallbackTitle: 'POWERPOINT to PDF' },
  excelToPdf: { titleKey: 'landingPage.tools.excelToPdf', fallbackTitle: 'EXCEL to PDF' },
  htmlToPdf: { titleKey: 'landingPage.tools.htmlToPdf', fallbackTitle: 'HTML to PDF' },
  pdfToJpg: { titleKey: 'landingPage.tools.pdfToJpg', fallbackTitle: 'PDF to JPG' },
  pdfToWord: { titleKey: 'landingPage.tools.pdfToWord', fallbackTitle: 'PDF to WORD' },
  pdfToPowerpoint: { titleKey: 'landingPage.tools.pdfToPowerpoint', fallbackTitle: 'PDF to POWERPOINT' },
  pdfToExcel: { titleKey: 'landingPage.tools.pdfToExcel', fallbackTitle: 'PDF to EXCEL' },
  pdfToPdfA: { titleKey: 'landingPage.tools.pdfToPdfA', fallbackTitle: 'PDF to PDF/A' },
  rotatePdf: { titleKey: 'landingPage.tools.rotatePdf', fallbackTitle: 'Rotate PDF' },
  addPageNumbers: { titleKey: 'landingPage.tools.addPageNumbers', fallbackTitle: 'Add page numbers' },
  addWatermark: { titleKey: 'landingPage.tools.addWatermark', fallbackTitle: 'Add watermark' },
  cropPdf: { titleKey: 'landingPage.tools.cropPdf', fallbackTitle: 'Crop PDF' },
  editPdf: { titleKey: 'landingPage.tools.editPdf', fallbackTitle: 'Edit PDF' },
  unlockPdf: { titleKey: 'landingPage.tools.unlockPdf', fallbackTitle: 'Unlock PDF' },
  protectPdf: { titleKey: 'landingPage.tools.protectPdf', fallbackTitle: 'Protect PDF' },
  signPdf: { titleKey: 'landingPage.tools.signPdf', fallbackTitle: 'Sign PDF' },
  redactPdf: { titleKey: 'landingPage.tools.redactPdf', fallbackTitle: 'Redact PDF' },
  comparePdf: { titleKey: 'landingPage.tools.comparePdf', fallbackTitle: 'Compare PDF' },
  translatePdf: { titleKey: 'landingPage.nav.translatePdf', fallbackTitle: 'Translate PDF' }
};

export default function PdfToolRunnerModal({ isOpen, toolKey, initialFiles, onClose, onStartTranslation }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !toolKey) return null;

  const meta = TOOL_META[toolKey] || {};
  const title = t(meta.titleKey || 'tools.title', meta.fallbackTitle || 'PDF tool');

  let body = null;
  if (toolKey === 'mergePdf') {
    body = <MergePdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'splitPdf') {
    body = <SplitPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'removePages') {
    body = <RemovePagesTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'extractPages') {
    body = <ExtractPagesTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'organizePdf') {
    body = <OrganizePdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'scanToPdf') {
    body = <ScanToPdfTool onClose={onClose} />;
  } else if (toolKey === 'compressPdf') {
    body = <CompressPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'repairPdf') {
    body = <RepairPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'ocrPdf') {
    body = <OcrPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'jpgToPdf') {
    body = <JpgToPdfTool onClose={onClose} />;
  } else if (toolKey === 'wordToPdf') {
    body = <WordToPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'powerpointToPdf') {
    body = <PowerpointToPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'excelToPdf') {
    body = <ExcelToPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'htmlToPdf') {
    body = <HtmlToPdfTool onClose={onClose} />;
  } else if (toolKey === 'pdfToJpg') {
    body = <PdfToJpgTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'pdfToWord') {
    body = <PdfToWordTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'pdfToPowerpoint') {
    body = <PdfToPowerpointTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'pdfToExcel') {
    body = <PdfToExcelTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'pdfToPdfA') {
    body = <PdfToPdfATool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'rotatePdf') {
    body = <RotatePdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'addPageNumbers') {
    body = <AddPageNumbersTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'addWatermark') {
    body = <AddWatermarkTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'cropPdf') {
    body = <CropPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'editPdf') {
    body = <EditPdfTool onClose={onClose} />;
  } else if (toolKey === 'unlockPdf') {
    body = <UnlockPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'protectPdf') {
    body = <ProtectPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'signPdf') {
    body = <SignPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'redactPdf') {
    body = <RedactPdfTool initialFiles={initialFiles} onClose={onClose} />;
  } else if (toolKey === 'comparePdf') {
    body = <ComparePdfTool onClose={onClose} />;
  } else if (toolKey === 'translatePdf') {
    body = <TranslatePdfTool initialFiles={initialFiles} onClose={onClose} onStartTranslation={onStartTranslation} />;
  } else {
    body = <div style={{ color: '#666' }}>{t('landingPage.comingSoon', 'Coming soon')}</div>;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10050
      }}
      onClick={() => onClose?.()}
    >
      <div
        role="dialog"
        aria-label={title}
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: '48px 18px 18px 18px',
          maxWidth: 720,
          width: 'min(720px, 94vw)',
          boxShadow: '0 14px 60px rgba(0, 0, 0, 0.35)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: '#f0f0f0',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: '#666',
            padding: 0,
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 999,
            zIndex: 10,
            transition: 'background 150ms ease, color 150ms ease'
          }}
          onMouseEnter={(e) => { e.target.style.background = '#e0e0e0'; e.target.style.color = '#333'; }}
          onMouseLeave={(e) => { e.target.style.background = '#f0f0f0'; e.target.style.color = '#666'; }}
          title={t('pageManagement.close', 'Close')}
        >
          ×
        </button>

        {body}
      </div>
    </div>
  );
}


