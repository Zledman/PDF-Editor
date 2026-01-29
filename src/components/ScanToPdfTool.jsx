import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { imagesToPdf } from '../services/pdfTools';

function safeFilename(name) {
  const trimmed = String(name || '').trim() || 'scan';
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

export default function ScanToPdfTool({ onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [images, setImages] = useState([]); // {id,name,type,buffer,size}
  const [pageSize, setPageSize] = useState('fit'); // 'fit' | 'a4'
  const [filename, setFilename] = useState('scan');
  const [isRunning, setIsRunning] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!images.length) setFilename('scan');
  }, [images.length]);

  const addImagesFromPicker = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErrMsg('');
    try {
      const entries = await Promise.all(
        files.map(async (file, idx) => {
          const buf = await file.arrayBuffer();
          return {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${idx}`,
            name: file.name || `image-${idx + 1}`,
            type: file.type || '',
            size: file.size || buf.byteLength,
            buffer: buf
          };
        })
      );
      setImages((prev) => [...prev, ...entries]);
    } catch (e) {
      setErrMsg((e && e.message) || 'Could not read image');
    }
  };

  const move = (fromIdx, toIdx) => {
    setImages((prev) => {
      if (toIdx < 0 || toIdx >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  };

  const removeAt = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const canRun = images.length > 0 && !isRunning;

  const run = async () => {
    setErrMsg('');
    setIsRunning(true);
    try {
      const blob = await imagesToPdf(
        images.map((img) => ({ name: img.name, type: img.type, buffer: img.buffer })),
        { pageSize, marginPt: 24 }
      );
      downloadBlob(blob, `${safeFilename(filename)}.pdf`);
    } catch (e) {
      setErrMsg((e && e.message) || 'Scan to PDF failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
          {t('landingPage.tools.scanToPdf', 'Scan to PDF')}
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
            {t('tools.scan.addImages', 'Add images')}
          </button>
          <button
            type="button"
            onClick={() => setImages([])}
            disabled={!images.length || isRunning}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #ddd',
              background: !images.length || isRunning ? '#f3f3f3' : '#fff',
              cursor: !images.length || isRunning ? 'not-allowed' : 'pointer',
              fontWeight: 650,
              opacity: !images.length || isRunning ? 0.6 : 1
            }}
          >
            {t('common.clear', 'Clear')}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        // On mobile this opens camera/photo picker; on desktop regular image picker
        style={{ display: 'none' }}
        onChange={(e) => {
          addImagesFromPicker(e.target.files);
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>
          {t('downloadModal.filename', 'Filnamn')}
        </label>
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="scan"
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
          {t('tools.scan.pageSize', 'Page size')}
        </label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            fontSize: 14
          }}
        >
          <option value="fit">{t('tools.scan.fit', 'Fit to image')}</option>
          <option value="a4">{t('tools.scan.a4', 'A4')}</option>
        </select>
      </div>

      {errMsg ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>
          {errMsg}
        </div>
      ) : null}

      <div style={{ border: '1px solid #e6e6e6', borderRadius: 12, overflow: 'hidden' }}>
        {images.length ? (
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {images.map((img, idx) => (
              <div
                key={img.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: 12,
                  borderBottom: idx === images.length - 1 ? 'none' : '1px solid #eee'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idx + 1}. {img.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>{Math.round((img.size || 0) / 1024)} KB</div>
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
                    disabled={idx === images.length - 1 || isRunning}
                    onClick={() => move(idx, idx + 1)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #ddd',
                      background: idx === images.length - 1 || isRunning ? '#f3f3f3' : '#fff',
                      cursor: idx === images.length - 1 || isRunning ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      opacity: idx === images.length - 1 || isRunning ? 0.6 : 1
                    }}
                    title={t('common.moveDown', 'Move down')}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => removeAt(idx)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #ffd0d0',
                      background: isRunning ? '#f3f3f3' : '#fff',
                      color: '#b00020',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      fontWeight: 800,
                      opacity: isRunning ? 0.6 : 1
                    }}
                    title={t('common.remove', 'Remove')}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 18, color: '#666' }}>{t('tools.scan.hint', 'Add images to create a PDF.')}</div>
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
          {isRunning ? t('loading.exporting', 'Exporting file...') : t('tools.scan.run', 'Create PDF')}
        </button>
      </div>
    </div>
  );
}


