import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parsePageRanges, removePagesFromPdf } from '../services/pdfTools';

function safeFilename(name) {
  const trimmed = String(name || '').trim() || 'removed_pages';
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 180);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function RemovePagesTool({ initialFiles = [], onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null); // { name, size, buffer }
  const [removeText, setRemoveText] = useState('2');
  const [baseName, setBaseName] = useState('removed_pages');
  const [isRunning, setIsRunning] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    const first = initialFiles?.[0];
    if (!first) return;
    setFile((prev) => (prev ? prev : { name: first.name || 'current.pdf', size: first.size || first.buffer?.byteLength || 0, buffer: first.buffer }));
    if (first.name) {
      const stem = first.name.replace(/\.[^.]+$/, '');
      setBaseName((prev) => (prev === 'removed_pages' ? `${stem}_removed` : prev));
    }
  }, [initialFiles]);

  const onPick = async (f) => {
    if (!f) return;
    setErrMsg('');
    try {
      const buf = await f.arrayBuffer();
      setFile({ name: f.name || 'input.pdf', size: f.size || buf.byteLength, buffer: buf });
      const stem = (f.name || 'document').replace(/\.[^.]+$/, '');
      setBaseName(`${stem}_removed`);
    } catch (e) {
      setErrMsg((e && e.message) || 'Could not read file');
    }
  };

  const runRemove = async () => {
    setErrMsg('');
    setIsRunning(true);
    try {
      // Need page count to validate ranges
      const { PDFDocument } = await import('pdf-lib');
      const src = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
      const numPages = src.getPageCount();
      const ranges = parsePageRanges(removeText, numPages);
      if (!ranges.length) throw new Error('No pages selected');

      const outBlob = await removePagesFromPdf(file.buffer, ranges);
      downloadBlob(outBlob, `${safeFilename(baseName)}.pdf`);
    } catch (e) {
      setErrMsg((e && e.message) || 'Remove pages failed');
    } finally {
      setIsRunning(false);
    }
  };

  const canRun = !!file?.buffer && !isRunning;
  let isRangesValid = true;
  if (removeText.trim()) {
    try {
      // validate basic shape; real bounds validated in runRemove after load
      parsePageRanges(removeText, 0);
    } catch {
      isRangesValid = false;
    }
  } else {
    isRangesValid = false;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
          {t('landingPage.tools.removePages', 'Remove pages')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #ddd',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 650
            }}
          >
            {t('landingPage.chooseFile', 'Choose file')}
          </button>
          <button
            type="button"
            onClick={() => setFile(null)}
            disabled={!file || isRunning}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #ddd',
              background: !file || isRunning ? '#f3f3f3' : '#fff',
              cursor: !file || isRunning ? 'not-allowed' : 'pointer',
              fontWeight: 650,
              opacity: !file || isRunning ? 0.6 : 1
            }}
          >
            {t('common.clear', 'Clear')}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
        <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 6, color: '#444' }}>
          {t('tools.input', 'Input')}
        </div>
        {file ? (
          <div style={{ color: '#333', fontWeight: 700 }}>
            {file.name} <span style={{ fontWeight: 500, color: '#666' }}>({Math.round((file.size || 0) / 1024)} KB)</span>
          </div>
        ) : (
          <div style={{ color: '#666' }}>{t('tools.remove.hint', 'Choose a PDF to remove pages from.')}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>
          {t('downloadModal.filename', 'Filnamn')}
        </label>
        <input
          type="text"
          value={baseName}
          onChange={(e) => setBaseName(e.target.value)}
          placeholder="removed_pages"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            fontSize: 14
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#444', marginBottom: 6 }}>
          {t('tools.remove.pages', 'Pages to remove (e.g. 2, 4-6)')}
        </label>
        <input
          type="text"
          value={removeText}
          onChange={(e) => setRemoveText(e.target.value)}
          placeholder="2, 4-6"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            fontSize: 14
          }}
        />
        {!isRangesValid ? (
          <div style={{ marginTop: 8, color: '#b00020', fontSize: 12 }}>
            {t('tools.remove.invalid', 'Invalid pages')}
          </div>
        ) : null}
      </div>

      {errMsg ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>
          {errMsg}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid #ddd',
            background: '#fff',
            cursor: 'pointer',
            fontWeight: 650
          }}
        >
          {t('downloadModal.cancel', 'Avbryt')}
        </button>
        <button
          type="button"
          onClick={runRemove}
          disabled={!canRun || !isRangesValid}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: canRun && isRangesValid ? '#E76F51' : '#bbb',
            color: '#fff',
            cursor: canRun && isRangesValid ? 'pointer' : 'not-allowed',
            fontWeight: 800,
            opacity: canRun && isRangesValid ? 1 : 0.7
          }}
        >
          {isRunning ? t('loading.exporting', 'Exporting file...') : t('tools.remove.run', 'Remove pages')}
        </button>
      </div>
    </div>
  );
}


