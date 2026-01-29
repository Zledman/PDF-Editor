import React from 'react';

function BaseIcon({ color, children }) {
  return (
    <svg className="landingToolIconSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill={color} />
      <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {children}
      </g>
    </svg>
  );
}

function convertInIcon(p) {
  return (
    <BaseIcon {...p}>
      <path d="M8 7h7l3 3v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <path d="M15 7v3h3" />
      <path d="M12 9v6" />
      <path d="M9.5 12.5L12 15l2.5-2.5" />
    </BaseIcon>
  );
}

function convertOutIcon(p) {
  return (
    <BaseIcon {...p}>
      <path d="M8 7h7l3 3v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <path d="M15 7v3h3" />
      <path d="M12 15V9" />
      <path d="M9.5 11.5L12 9l2.5 2.5" />
    </BaseIcon>
  );
}

const glyphs = {
  // ORGANIZE
  mergePdf: (p) => (
    <BaseIcon {...p}>
      <path d="M8 8h6l2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
      <path d="M10 12h6" />
      <path d="M13 10v4" />
    </BaseIcon>
  ),
  splitPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M8 7h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <path d="M12 8v12" />
      <path d="M10 11l-2-2" />
      <path d="M14 13l2 2" />
    </BaseIcon>
  ),
  removePages: (p) => (
    <BaseIcon {...p}>
      <path d="M9 8h8" />
      <path d="M10 8l1-2h4l1 2" />
      <path d="M10 10v8" />
      <path d="M14 10v8" />
    </BaseIcon>
  ),
  extractPages: (p) => (
    <BaseIcon {...p}>
      <path d="M8 7h7l3 3v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <path d="M15 7v3h3" />
      <path d="M12 12v6" />
      <path d="M9.5 15.5L12 18l2.5-2.5" />
    </BaseIcon>
  ),
  organizePdf: (p) => (
    <BaseIcon {...p}>
      <path d="M8 9h8" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </BaseIcon>
  ),
  scanToPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M8 8h8" />
      <path d="M7 11h10" />
      <path d="M8 16h8" />
      <path d="M7 14h10" />
    </BaseIcon>
  ),

  // OPTIMIZE
  compressPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M9 10l-2 2 2 2" />
      <path d="M15 10l2 2-2 2" />
      <path d="M10 12h4" />
      <path d="M8 7h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
    </BaseIcon>
  ),
  repairPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M14 9l2 2-6 6H8v-2l6-6z" />
      <path d="M13 10l2 2" />
    </BaseIcon>
  ),
  ocrPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M8 10h8" />
      <path d="M8 14h6" />
      <path d="M7 8h10v10H7z" />
    </BaseIcon>
  ),

  // CONVERT TO (in)
  jpgToPdf: convertInIcon,
  wordToPdf: convertInIcon,
  powerpointToPdf: convertInIcon,
  excelToPdf: convertInIcon,
  htmlToPdf: convertInIcon,

  // CONVERT FROM (out)
  pdfToJpg: convertOutIcon,
  pdfToWord: convertOutIcon,
  pdfToPowerpoint: convertOutIcon,
  pdfToExcel: convertOutIcon,
  pdfToPdfA: convertOutIcon,

  // EDIT
  rotatePdf: (p) => (
    <BaseIcon {...p}>
      <path d="M16 9a5 5 0 1 0 1.5 3.5" />
      <path d="M17.5 8.5V11H15" />
    </BaseIcon>
  ),
  addPageNumbers: (p) => (
    <BaseIcon {...p}>
      <path d="M8 9h8" />
      <path d="M8 13h5" />
      <path d="M8 17h8" />
      <path d="M16.5 12.5h2" />
      <path d="M17.5 11.5v3" />
    </BaseIcon>
  ),
  addWatermark: (p) => (
    <BaseIcon {...p}>
      <path d="M12 7s4 4 4 7a4 4 0 1 1-8 0c0-3 4-7 4-7z" />
    </BaseIcon>
  ),
  cropPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M8 6v12a2 2 0 0 0 2 2h8" />
      <path d="M6 8h12a2 2 0 0 1 2 2v8" />
    </BaseIcon>
  ),
  editPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M14 8l2 2-7 7H7v-2l7-7z" />
      <path d="M13 9l2 2" />
    </BaseIcon>
  ),

  // SECURITY
  unlockPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M9 11V9a3 3 0 0 1 6 0" />
      <path d="M8 11h8v8H8z" />
    </BaseIcon>
  ),
  protectPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M9 11V9a3 3 0 0 1 6 0v2" />
      <path d="M8 11h8v8H8z" />
      <path d="M12 15v2" />
    </BaseIcon>
  ),
  signPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M7 17c2-2 4-6 6-6s2 3 4 3 3-2 3-2" />
      <path d="M7 17h10" />
    </BaseIcon>
  ),
  redactPdf: (p) => (
    <BaseIcon {...p}>
      <path d="M7 10h10" />
      <path d="M7 13h10" />
      <path d="M7 16h10" />
    </BaseIcon>
  ),
  comparePdf: (p) => (
    <BaseIcon {...p}>
      <path d="M7 8h6v10H7z" />
      <path d="M11 6h6v10h-6" />
      <path d="M10 12h4" />
      <path d="M12 10l2 2-2 2" />
    </BaseIcon>
  )
};

export function ToolIcon({ toolKey, color }) {
  const Icon = glyphs[toolKey] || glyphs.organizePdf;
  return <Icon color={color} />;
}


