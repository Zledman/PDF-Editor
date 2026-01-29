import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PDFDocument, degrees } from 'pdf-lib';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'rotated';
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

export default function RotatePdfTool({ initialFiles = [], onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [pdfBytes, setPdfBytes] = useState(null);
    const [pageCount, setPageCount] = useState(0);
    const [filename, setFilename] = useState('rotated');
    const [rotation, setRotation] = useState(90);
    const [applyTo, setApplyTo] = useState('all'); // 'all' or 'custom'
    const [customPages, setCustomPages] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        const first = initialFiles?.[0];
        if (!first?.buffer || file) return;
        loadPdf(first.buffer, first.name);
    }, [initialFiles]);

    const loadPdf = async (buffer, name) => {
        try {
            const doc = await PDFDocument.load(buffer);
            setPdfBytes(buffer);
            setPageCount(doc.getPageCount());
            setFile({ name: name || 'document.pdf', size: buffer.byteLength });
            const stem = (name || 'document').replace(/\.[^.]+$/, '');
            setFilename(`${stem}_rotated`);
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not load PDF');
        }
    };

    const onPick = async (f) => {
        if (!f) return;
        setErrMsg('');
        setSuccessMsg('');
        try {
            const buf = await f.arrayBuffer();
            await loadPdf(buf, f.name);
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not read file');
        }
    };

    const parsePageRange = (str, max) => {
        const pages = new Set();
        const parts = str.split(',');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(s => parseInt(s.trim(), 10));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = Math.max(1, start); i <= Math.min(max, end); i++) {
                        pages.add(i);
                    }
                }
            } else {
                const num = parseInt(trimmed, 10);
                if (!isNaN(num) && num >= 1 && num <= max) {
                    pages.add(num);
                }
            }
        }
        return Array.from(pages).sort((a, b) => a - b);
    };

    const canRun = !!pdfBytes && !isRunning;

    const run = async () => {
        setErrMsg('');
        setSuccessMsg('');
        setIsRunning(true);
        try {
            const doc = await PDFDocument.load(pdfBytes);
            const pages = doc.getPages();

            let pagesToRotate;
            if (applyTo === 'all') {
                pagesToRotate = pages.map((_, i) => i);
            } else {
                const parsed = parsePageRange(customPages, pageCount);
                pagesToRotate = parsed.map(p => p - 1);
            }

            for (const idx of pagesToRotate) {
                if (idx >= 0 && idx < pages.length) {
                    const page = pages[idx];
                    const currentRotation = page.getRotation().angle;
                    page.setRotation(degrees(currentRotation + rotation));
                }
            }

            const outBytes = await doc.save();
            const blob = new Blob([outBytes], { type: 'application/pdf' });
            downloadBlob(blob, `${safeFilename(filename)}.pdf`);
            setSuccessMsg(t('tools.edit.rotateSuccess', 'PDF rotated successfully!'));
        } catch (e) {
            setErrMsg((e && e.message) || t('tools.edit.error', 'Operation failed'));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
                    {t('landingPage.tools.rotatePdf', 'Rotate PDF')}
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}>
                    {t('landingPage.chooseFile', 'Choose file')}
                </button>
            </div>

            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
                <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 6, color: '#444' }}>{t('tools.input', 'Input')}</div>
                {file ? (
                    <div style={{ color: '#333', fontWeight: 700 }}>
                        {file.name} <span style={{ fontWeight: 500, color: '#666' }}>({Math.round((file.size || 0) / 1024)} KB, {pageCount} {t('toolbar.page', 'page')}(s))</span>
                    </div>
                ) : (
                    <div style={{ color: '#666' }}>{t('tools.edit.rotateHint', 'Select a PDF to rotate pages.')}</div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.edit.rotation', 'Rotation')}</label>
                    <select value={rotation} onChange={(e) => setRotation(Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }}>
                        <option value={90}>90° {t('tools.edit.clockwise', 'clockwise')}</option>
                        <option value={180}>180°</option>
                        <option value={270}>270° ({t('tools.edit.counterclockwise', '90° counter-clockwise')})</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.edit.applyTo', 'Apply to')}</label>
                    <select value={applyTo} onChange={(e) => setApplyTo(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }}>
                        <option value="all">{t('tools.edit.allPages', 'All pages')}</option>
                        <option value="custom">{t('tools.edit.customPages', 'Custom pages')}</option>
                    </select>
                </div>
            </div>

            {applyTo === 'custom' && (
                <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.edit.pageRange', 'Page range (e.g. 1,3,5-8)')}</label>
                    <input type="text" value={customPages} onChange={(e) => setCustomPages(e.target.value)} placeholder="1, 3, 5-8" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>{t('downloadModal.filename', 'Filename')}</label>
                <input type="text" value={filename} onChange={(e) => setFilename(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }} />
            </div>

            {errMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>{errMsg}</div>}
            {successMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#f2fff4', border: '1px solid #c0e8c6', color: '#1f6a2b' }}>{successMsg}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}>{t('downloadModal.cancel', 'Cancel')}</button>
                <button type="button" onClick={run} disabled={!canRun} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: canRun ? '#A06CD5' : '#bbb', color: '#fff', cursor: canRun ? 'pointer' : 'not-allowed', fontWeight: 800, opacity: canRun ? 1 : 0.7 }}>
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.edit.rotate', 'Rotate')}
                </button>
            </div>
        </div>
    );
}
