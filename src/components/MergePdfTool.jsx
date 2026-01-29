import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mergePdfBuffers } from '../services/pdfTools';

function bytesToLabel(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function safeFilename(name) {
  const trimmed = String(name || '').trim() || 'merged';
  // basic windows-safe filename
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 180);
}

export default function MergePdfTool({ initialFiles = [], onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [outputName, setOutputName] = useState('merged');
  const [isRunning, setIsRunning] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  // Initialize from props once per open
  useEffect(() => {
    if (!initialFiles?.length) return;
    setFiles((prev) => {
      if (prev.length) return prev;
      return initialFiles.map((f, idx) => ({
        id: `${Date.now()}-${idx}`,
        name: f.name || `file-${idx + 1}.pdf`,
        size: f.size || (f.buffer ? f.buffer.byteLength : 0),
        buffer: f.buffer
      }));
    });
  }, [initialFiles]);

  const canRun = files.length >= 2 && !isRunning;
  const totalSize = useMemo(() => files.reduce((sum, f) => sum + (f.size || 0), 0), [files]);

  const addFilesFromPicker = async (fileList) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    setErrMsg('');

    try {
      const entries = await Promise.all(
        arr.map(async (file, idx) => {
          const buf = await file.arrayBuffer();
          return {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${idx}`,
            name: file.name || `file-${idx + 1}.pdf`,
            size: file.size || buf.byteLength,
            buffer: buf
          };
        })
      );
      setFiles((prev) => [...prev, ...entries]);
    } catch (e) {
      setErrMsg((e && e.message) || 'Could not read file');
    }
  };

  const move = (fromIdx, toIdx) => {
    setFiles((prev) => {
      if (toIdx < 0 || toIdx >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  };

  const removeAt = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const runMerge = async () => {
    setErrMsg('');
    setIsRunning(true);
    try {
      const mergedBlob = await mergePdfBuffers(files.map((f) => f.buffer));
      const url = URL.createObjectURL(mergedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFilename(outputName)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrMsg((e && e.message) || 'Merge failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
          {t('landingPage.tools.mergePdf', 'Merge PDF')}
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
            onClick={() => setFiles([])}
            disabled={!files.length || isRunning}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #ddd',
              background: !files.length || isRunning ? '#f3f3f3' : '#fff',
              cursor: !files.length || isRunning ? 'not-allowed' : 'pointer',
              fontWeight: 650,
              opacity: !files.length || isRunning ? 0.6 : 1
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
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          addFilesFromPicker(e.target.files);
          // allow re-selecting same file
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>
          {t('downloadModal.filename', 'Filnamn')}
        </label>
        <input
          type="text"
          value={outputName}
          onChange={(e) => setOutputName(e.target.value)}
          placeholder="merged"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            fontSize: 14
          }}
        />
        <div style={{ fontSize: 12, color: '#666' }}>{bytesToLabel(totalSize)}</div>
      </div>

      {errMsg ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>
          {errMsg}
        </div>
      ) : null}

      <div style={{ border: '1px solid #e6e6e6', borderRadius: 12, overflow: 'hidden' }}>
        {files.length ? (
          <div style={{ maxHeight: 340, overflow: 'auto' }}>
            {files.map((f, idx) => (
              <div
                key={f.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: 12,
                  borderBottom: idx === files.length - 1 ? 'none' : '1px solid #eee'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idx + 1}. {f.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>{bytesToLabel(f.size)}</div>
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
                    disabled={idx === files.length - 1 || isRunning}
                    onClick={() => move(idx, idx + 1)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #ddd',
                      background: idx === files.length - 1 || isRunning ? '#f3f3f3' : '#fff',
                      cursor: idx === files.length - 1 || isRunning ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      opacity: idx === files.length - 1 || isRunning ? 0.6 : 1
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
          <div style={{ padding: 18, color: '#666' }}>
            {t('tools.merge.hint', 'Add at least 2 PDF files to merge.')}
          </div>
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
          onClick={runMerge}
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
          {isRunning ? t('loading.exporting', 'Exporting file...') : t('tools.merge.run', 'Merge')}
        </button>
      </div>
    </div>
  );
}


