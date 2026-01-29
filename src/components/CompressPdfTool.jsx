import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compressPdfBuffer } from '../services/pdfTools';
import { PDFDocument } from 'pdf-lib';

function safeFilename(name) {
  const trimmed = String(name || '').trim() || 'compressed';
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

const PRESETS = {
  less: { scale: 1.1, quality: 0.85 },
  recommended: { scale: 1.0, quality: 0.75 },
  extreme: { scale: 0.7, quality: 0.55 }
};

export default function CompressPdfTool({ initialFiles = [], onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null); // { name, size, buffer }
  const [filename, setFilename] = useState('compressed');
  const [preset, setPreset] = useState('recommended'); // less|recommended|extreme|custom
  const [scale, setScale] = useState(PRESETS.recommended.scale);
  const [quality, setQuality] = useState(PRESETS.recommended.quality);
  const [pageSize, setPageSize] = useState('original'); // original|a4
  const [isRunning, setIsRunning] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [compressPath, setCompressPath] = useState(null); // 'server' | 'client' | null
  const [clientMode, setClientMode] = useState(null); // 'custom' | 'fallback' | null
  const [fallbackReason, setFallbackReason] = useState('');
  const [serverTest, setServerTest] = useState({ state: 'idle', msg: '' }); // idle|running|ok|error

  const compressServerUrl = import.meta.env.VITE_COMPRESS_SERVER_URL || 'http://localhost:8082/compress-pdf';
  const serverRequired = import.meta.env.VITE_COMPRESS_SERVER_REQUIRED === 'true';

  useEffect(() => {
    const first = initialFiles?.[0];
    if (!first?.buffer) return;
    if (file) return;
    setFile({ name: first.name || 'current.pdf', size: first.size || first.buffer.byteLength, buffer: first.buffer });
    const stem = (first.name || 'document').replace(/\.[^.]+$/, '');
    setFilename(`${stem}_compressed`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  const onPick = async (f) => {
    if (!f) return;
    setErrMsg('');
    try {
      const buf = await f.arrayBuffer();
      setFile({ name: f.name || 'input.pdf', size: f.size || buf.byteLength, buffer: buf });
      const stem = (f.name || 'document').replace(/\.[^.]+$/, '');
      setFilename(`${stem}_compressed`);
    } catch (e) {
      setErrMsg((e && e.message) || 'Could not read file');
    }
  };

  const applyPreset = (key) => {
    setPreset(key);
    if (key === 'custom') return;
    const p = PRESETS[key];
    if (p) {
      setScale(p.scale);
      setQuality(p.quality);
    }
  };

  const canRun = !!file?.buffer && !isRunning;

  const presetToServerPreset = (p) => {
    // Keep server presets simple + predictable.
    // Custom (sliders) should use client compressor so sliders actually matter.
    if (p === 'custom') return null;
    if (p === 'less') return 'printer';
    if (p === 'recommended') return 'ebook';
    if (p === 'extreme') return 'screen';
    return 'ebook';
  };

  const testServer = async () => {
    setServerTest({ state: 'running', msg: '' });
    try {
      // Generate a tiny PDF so we can verify /compress-pdf without requiring a local file.
      const doc = await PDFDocument.create();
      doc.addPage([300, 300]);
      const bytes = await doc.save();
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

      const form = new FormData();
      form.append('file', new Blob([buf], { type: 'application/pdf' }), 'test.pdf');
      const url = `${compressServerUrl}?preset=ebook`;
      const resp = await fetch(url, { method: 'POST', body: form });
      if (!resp.ok) {
        const bodyText = await resp.text().catch(() => '');
        const short = bodyText ? bodyText.slice(0, 300) : '';
        throw new Error(`HTTP ${resp.status}${short ? `: ${short}` : ''}`);
      }
      const ct = resp.headers.get('content-type') || '';
      if (!ct.toLowerCase().includes('application/pdf')) {
        throw new Error(`Unexpected content-type: ${ct || '(none)'}`);
      }
      setServerTest({ state: 'ok', msg: t('tools.compress.test.ok', 'OK') });
    } catch (e) {
      const msg = (e && e.message) ? String(e.message) : 'Server test failed';
      setServerTest({ state: 'error', msg });
    }
  };

  const run = async () => {
    setErrMsg('');
    setCompressPath(null);
    setClientMode(null);
    setFallbackReason('');
    setIsRunning(true);
    try {
      // Option A: "Custom" must always use browser compression so sliders actually matter.
      // This should NOT be blocked by VITE_COMPRESS_SERVER_REQUIRED.
      if (preset === 'custom') {
        const blob = await compressPdfBuffer(file.buffer, { scale, quality, pageSize, marginPt: 24 });
        setCompressPath('client');
        setClientMode('custom');
        downloadBlob(blob, `${safeFilename(filename)}.pdf`);
        return;
      }

      // Server-first (Ghostscript/qpdf/etc). In dev we allow fallback; in prod set VITE_COMPRESS_SERVER_REQUIRED=true.
      try {
        const serverPreset = presetToServerPreset(preset);
        if (!serverPreset) throw new Error('custom-settings');
        const form = new FormData();
        form.append('file', new Blob([file.buffer], { type: 'application/pdf' }), 'input.pdf');
        const url = `${compressServerUrl}?preset=${encodeURIComponent(serverPreset)}`;
        const resp = await fetch(url, { method: 'POST', body: form });
        if (!resp.ok) {
          const bodyText = await resp.text().catch(() => '');
          const short = bodyText ? bodyText.slice(0, 300) : '';
          throw new Error(`Server compress failed (${resp.status})${short ? `: ${short}` : ''}`);
        }
        const blob = await resp.blob();
        setCompressPath('server');
        downloadBlob(blob, `${safeFilename(filename)}.pdf`);
        return;
      } catch (e) {
        if (e && e.message === 'custom-settings') {
          // expected: sliders/custom should use client path
          // (handled above)
        } else {
          const msg = (e && e.message) ? String(e.message) : 'Server unavailable';
          setFallbackReason(msg);
        }
        if (serverRequired) throw e;
        console.warn('Compress server unavailable, falling back to client:', e);
      }

      // Fallback: browser compression (uses sliders)
      const blob = await compressPdfBuffer(file.buffer, { scale, quality, pageSize, marginPt: 24 });
      setCompressPath('client');
      setClientMode('fallback');
      downloadBlob(blob, `${safeFilename(filename)}.pdf`);
    } catch (e) {
      setErrMsg((e && e.message) || 'Compress failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
          {t('landingPage.tools.compressPdf', 'Compress PDF')}
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
            {file.name}{' '}
            <span style={{ fontWeight: 500, color: '#666' }}>({Math.round((file.size || 0) / 1024)} KB)</span>
          </div>
        ) : (
          <div style={{ color: '#666' }}>{t('tools.compress.hint', 'Choose a PDF to compress.')}</div>
        )}
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          {preset === 'custom'
            ? t('tools.compress.noteClient', 'Custom uses browser compression (image-based PDF).')
            : t(
                'tools.compress.noteServerFirst',
                'Levels use server compression when available (keeps text). If the server is unavailable, it falls back to browser (image-based PDF).'
              )}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: '#444' }}>
            <span style={{ fontWeight: 800 }}>{t('tools.compress.engineLabel', 'Engine')}:</span>{' '}
            {compressPath === 'server'
              ? t('tools.compress.engine.server', 'Server (PDF)')
              : preset === 'custom' || compressPath === 'client'
                ? t('tools.compress.engine.browser', 'Browser (image-based PDF)')
                : t('tools.compress.engine.auto', 'Auto (Server first)')}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={testServer}
              disabled={isRunning || serverTest.state === 'running'}
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid #ddd',
                background: '#fff',
                cursor: isRunning || serverTest.state === 'running' ? 'not-allowed' : 'pointer',
                fontWeight: 750,
                fontSize: 12,
                opacity: isRunning || serverTest.state === 'running' ? 0.7 : 1
              }}
            >
              {serverTest.state === 'running'
                ? t('tools.compress.test.running', 'Testing…')
                : t('tools.compress.test.button', 'Test server')}
            </button>
          </div>
        </div>
        {serverTest.state === 'ok' ? (
          <div style={{ marginTop: 6, fontSize: 12, color: '#2b6a2b' }}>
            {t('tools.compress.test.ok', 'OK')}
          </div>
        ) : serverTest.state === 'error' ? (
          <div style={{ marginTop: 6, fontSize: 12, color: '#8a1f1f' }}>
            {t('tools.compress.test.error', 'Server test failed')}: {serverTest.msg}
          </div>
        ) : null}
        {compressPath === 'server' ? (
          <div style={{ marginTop: 6, fontSize: 12, color: '#2b6a2b' }}>
            {t('tools.compress.usedServer', 'Compressed by server (better PDF compression).')}
          </div>
        ) : compressPath === 'client' ? (
          <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
            {clientMode === 'custom'
              ? t('tools.compress.usedClientCustom', 'Used browser compression (custom settings).')
              : t('tools.compress.usedClientFallback', 'Server unavailable, using browser fallback compression.')}
            {clientMode !== 'custom' && fallbackReason ? (
              <span style={{ color: '#888' }}> {t('tools.compress.reason', 'Reason')}: {fallbackReason}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>
          {t('downloadModal.filename', 'Filnamn')}
        </label>
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="compressed"
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
        <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 8, color: '#444' }}>
          {t('tools.compress.level.label', 'Compression level')}
        </div>
        <div role="radiogroup" aria-label={t('tools.compress.level.label', 'Compression level')}>
          <LevelOption
            active={preset === 'extreme'}
            disabled={isRunning}
            title={t('tools.compress.level.extreme.title', 'EXTREME COMPRESSION')}
            subtitle={t('tools.compress.level.extreme.subtitle', 'Less quality, high compression')}
            onClick={() => applyPreset('extreme')}
          />
          <LevelOption
            active={preset === 'recommended'}
            disabled={isRunning}
            title={t('tools.compress.level.recommended.title', 'RECOMMENDED COMPRESSION')}
            subtitle={t('tools.compress.level.recommended.subtitle', 'Good quality, good compression')}
            onClick={() => applyPreset('recommended')}
          />
          <LevelOption
            active={preset === 'less'}
            disabled={isRunning}
            title={t('tools.compress.level.less.title', 'LESS COMPRESSION')}
            subtitle={t('tools.compress.level.less.subtitle', 'High quality, less compression')}
            onClick={() => applyPreset('less')}
          />
          <LevelOption
            active={preset === 'custom'}
            disabled={isRunning}
            title={t('tools.compress.level.custom.title', 'CUSTOM')}
            subtitle={t('tools.compress.level.custom.subtitle', 'Use sliders below')}
            onClick={() => applyPreset('custom')}
            subtle
          />
        </div>
      </div>

      {preset === 'custom' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#444', marginBottom: 6 }}>
                {t('tools.compress.scale', 'Resolution')} ({Math.round(scale * 100)}%)
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={scale}
                disabled={isRunning}
                onChange={(e) => {
                  setPreset('custom');
                  setScale(Number(e.target.value));
                }}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#444', marginBottom: 6 }}>
                {t('tools.compress.quality', 'JPEG quality')} ({Math.round(quality * 100)}%)
              </label>
              <input
                type="range"
                min="0.35"
                max="0.95"
                step="0.05"
                value={quality}
                disabled={isRunning}
                onChange={(e) => {
                  setPreset('custom');
                  setQuality(Number(e.target.value));
                }}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>
              {t('tools.compress.pageSize', 'Output page size')}
            </label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value)}
              disabled={isRunning}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #ddd',
                fontSize: 14
              }}
            >
              <option value="original">{t('tools.compress.original', 'Original')}</option>
              <option value="a4">{t('tools.scan.a4', 'A4')}</option>
            </select>
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#666' }}>
          {t('tools.compress.customHint', 'Select CUSTOM to adjust resolution/quality in the browser.')}
        </div>
      )}

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
          onClick={run}
          disabled={!canRun}
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
          {isRunning ? t('loading.exporting', 'Exporting file...') : t('tools.compress.run', 'Compress')}
        </button>
      </div>
    </div>
  );
}

function pill(active) {
  return {
    padding: '8px 12px',
    borderRadius: 999,
    border: `1px solid ${active ? '#E76F51' : '#ddd'}`,
    background: active ? 'rgba(231,111,81,0.10)' : '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    color: '#333'
  };
}

function LevelOption({ title, subtitle, active, onClick, disabled, subtle = false }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active ? 'true' : 'false'}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '12px 12px',
        borderRadius: 12,
        border: active ? '1px solid #4D8AE6' : '1px solid #e8e8e8',
        background: active ? 'rgba(77,138,230,0.08)' : '#f6f6f8',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
        opacity: disabled ? 0.7 : 1
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0.4,
            color: subtle ? '#7a7a7a' : '#d24b4b'
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, color: '#2f2f2f', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      <div
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          border: active ? 'none' : '2px solid #d0d0d0',
          background: active ? '#6bbf7a' : 'transparent',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto'
        }}
      >
        {active ? '✓' : ''}
      </div>
    </button>
  );
}


