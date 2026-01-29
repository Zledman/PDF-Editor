import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parsePageRanges, splitPdfByRanges } from '../services/pdfTools';

function safeFilename(name) {
  const trimmed = String(name || '').trim() || 'split';
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

export default function SplitPdfTool({ initialFiles = [], onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null); // { name, size, buffer }
  const [mode, setMode] = useState('pages'); // 'pages' | 'ranges'
  const [rangeText, setRangeText] = useState('1-1');
  const [baseName, setBaseName] = useState('split');
  const [isRunning, setIsRunning] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    const first = initialFiles?.[0];
    if (!first) return;
    setFile((prev) => (prev ? prev : { name: first.name || 'current.pdf', size: first.size || first.buffer?.byteLength || 0, buffer: first.buffer }));
    if (first.name) {
      const stem = first.name.replace(/\.[^.]+$/, '');
      setBaseName((prev) => (prev === 'split' ? stem : prev));
    }
  }, [initialFiles]);

  const canRun = !!file?.buffer && !isRunning;

  const parsedRanges = useMemo(() => {
    if (mode !== 'ranges') return null;
    try {
      return parsePageRanges(rangeText, 0);
    } catch {
      return null;
    }
  }, [mode, rangeText]);

  const onPick = async (f) => {
    if (!f) return;
    setErrMsg('');
    try {
      const buf = await f.arrayBuffer();
      setFile({ name: f.name || 'input.pdf', size: f.size || buf.byteLength, buffer: buf });
      const stem = (f.name || 'split').replace(/\.[^.]+$/, '');
      setBaseName(stem);
    } catch (e) {
      setErrMsg((e && e.message) || 'Could not read file');
    }
  };

  const runSplit = async () => {
    setErrMsg('');
    setIsRunning(true);
    try {
      // Load once to get page count
      const { PDFDocument } = await import('pdf-lib');
      const src = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
      const numPages = src.getPageCount();

      if (mode === 'pages') {
        // 1 PDF per page
        const ranges = Array.from({ length: numPages }, (_, i) => ({ start: i + 1, end: i + 1 }));
        const blobs = await splitPdfByRanges(file.buffer, ranges);
        blobs.forEach((b, i) => downloadBlob(b, `${safeFilename(baseName)}_${i + 1}.pdf`));
      } else {
        const ranges = parsePageRanges(rangeText, numPages);
        if (!ranges.length) throw new Error('No ranges provided');
        const blobs = await splitPdfByRanges(file.buffer, ranges);
        blobs.forEach((b, i) => {
          const r = ranges[i];
          const suffix = r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`;
          downloadBlob(b, `${safeFilename(baseName)}_${suffix}.pdf`);
        });
      }
    } catch (e) {
      setErrMsg((e && e.message) || 'Split failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
          {t('landingPage.tools.splitPdf', 'Split PDF')}
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
          <div style={{ color: '#666' }}>{t('tools.split.hint', 'Choose a PDF to split.')}</div>
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
          placeholder="split"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            fontSize: 14
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>
          {t('tools.split.mode', 'Mode')}
        </label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            fontSize: 14
          }}
        >
          <option value="pages">{t('tools.split.perPage', 'One PDF per page')}</option>
          <option value="ranges">{t('tools.split.byRanges', 'Split by ranges')}</option>
        </select>
      </div>

      {mode === 'ranges' ? (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#444', marginBottom: 6 }}>
            {t('tools.split.ranges', 'Ranges (e.g. 1-3, 5, 7-9)')}
          </label>
          <input
            type="text"
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            placeholder="1-3, 5"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #ddd',
              fontSize: 14
            }}
          />
          {rangeText.trim() && !parsedRanges ? (
            <div style={{ marginTop: 8, color: '#b00020', fontSize: 12 }}>
              {t('tools.split.invalidRanges', 'Invalid ranges')}
            </div>
          ) : null}
        </div>
      ) : null}

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
          onClick={runSplit}
          disabled={!canRun || (mode === 'ranges' && rangeText.trim() && !parsedRanges)}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: canRun ? '#E76F51' : '#bbb',
            color: '#fff',
            cursor: canRun ? 'pointer' : 'not-allowed',
            fontWeight: 800,
            opacity: canRun ? 1 : 0.7
          }}
        >
          {isRunning ? t('loading.exporting', 'Exporting file...') : t('tools.split.run', 'Split')}
        </button>
      </div>
    </div>
  );
}


