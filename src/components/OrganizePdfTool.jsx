import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reorderPdfPages } from '../services/pdfTools';

function safeFilename(name) {
  const trimmed = String(name || '').trim() || 'organized';
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

export default function OrganizePdfTool({ initialFiles = [], onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null); // { name, size, buffer }
  const [numPages, setNumPages] = useState(0);
  const [order, setOrder] = useState([]); // 1-based pages in desired order
  const [baseName, setBaseName] = useState('organized');
  const [isRunning, setIsRunning] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const initFromBuffer = async (buf, name, size) => {
    const { PDFDocument } = await import('pdf-lib');
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const count = src.getPageCount();
    setNumPages(count);
    setOrder(Array.from({ length: count }, (_, i) => i + 1));
    setFile({ name: name || 'input.pdf', size: size || buf.byteLength, buffer: buf });

    const stem = (name || 'organized').replace(/\.[^.]+$/, '');
    setBaseName(`${stem}_organized`);
  };

  useEffect(() => {
    const first = initialFiles?.[0];
    if (!first?.buffer) return;
    if (file) return;
    initFromBuffer(first.buffer, first.name || 'current.pdf', first.size || first.buffer.byteLength).catch((e) => {
      setErrMsg((e && e.message) || 'Could not load PDF');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  const onPick = async (f) => {
    if (!f) return;
    setErrMsg('');
    try {
      const buf = await f.arrayBuffer();
      await initFromBuffer(buf, f.name || 'input.pdf', f.size || buf.byteLength);
    } catch (e) {
      setErrMsg((e && e.message) || 'Could not read file');
    }
  };

  const move = (fromIdx, toIdx) => {
    setOrder((prev) => {
      if (toIdx < 0 || toIdx >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  };

  const resetOrder = () => setOrder(Array.from({ length: numPages }, (_, i) => i + 1));

  const canRun = !!file?.buffer && numPages > 0 && order.length === numPages && !isRunning;
  const isDirty = useMemo(() => order.some((p, idx) => p !== idx + 1), [order]);

  const runOrganize = async () => {
    setErrMsg('');
    setIsRunning(true);
    try {
      const outBlob = await reorderPdfPages(file.buffer, order);
      downloadBlob(outBlob, `${safeFilename(baseName)}.pdf`);
    } catch (e) {
      setErrMsg((e && e.message) || 'Organize failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
          {t('landingPage.tools.organizePdf', 'Organize PDF')}
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
            onClick={() => {
              setFile(null);
              setNumPages(0);
              setOrder([]);
            }}
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
            <span style={{ fontWeight: 500, color: '#666' }}>
              ({numPages} {t('toolbar.page', 'Page').toLowerCase()}
              {numPages === 1 ? '' : 's'})
            </span>
          </div>
        ) : (
          <div style={{ color: '#666' }}>{t('tools.organize.hint', 'Choose a PDF to reorder pages.')}</div>
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
          placeholder="organized"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            fontSize: 14
          }}
        />
        <button
          type="button"
          onClick={resetOrder}
          disabled={!file || !isDirty || isRunning}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            background: !file || !isDirty || isRunning ? '#f3f3f3' : '#fff',
            cursor: !file || !isDirty || isRunning ? 'not-allowed' : 'pointer',
            fontWeight: 650,
            opacity: !file || !isDirty || isRunning ? 0.6 : 1
          }}
          title={t('common.reset', 'Reset')}
        >
          {t('common.reset', 'Reset')}
        </button>
      </div>

      {errMsg ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>
          {errMsg}
        </div>
      ) : null}

      <div style={{ border: '1px solid #e6e6e6', borderRadius: 12, overflow: 'hidden' }}>
        {file ? (
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {order.map((pageNum, idx) => (
              <div
                key={`${pageNum}-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: 12,
                  borderBottom: idx === order.length - 1 ? 'none' : '1px solid #eee'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#333' }}>
                    {idx + 1}. {t('toolbar.page', 'Page')} {pageNum}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {t('tools.organize.position', 'Position')}: {idx + 1}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={idx === 0 || isRunning}
                    onClick={() => move(idx, idx - 1)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #ddd',
                      background: idx === 0 || isRunning ? '#f3f3f3' : '#fff',
                      cursor: idx === 0 || isRunning ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      opacity: idx === 0 || isRunning ? 0.6 : 1
                    }}
                    title={t('common.moveUp', 'Move up')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={idx === order.length - 1 || isRunning}
                    onClick={() => move(idx, idx + 1)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #ddd',
                      background: idx === order.length - 1 || isRunning ? '#f3f3f3' : '#fff',
                      cursor: idx === order.length - 1 || isRunning ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      opacity: idx === order.length - 1 || isRunning ? 0.6 : 1
                    }}
                    title={t('common.moveDown', 'Move down')}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 18, color: '#666' }}>{t('tools.organize.noFile', 'No PDF selected')}</div>
        )}
      </div>

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
          onClick={runOrganize}
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
          {isRunning ? t('loading.exporting', 'Exporting file...') : t('tools.organize.run', 'Organize')}
        </button>
      </div>
    </div>
  );
}


