import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PDFDocument } from 'pdf-lib';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'cropped';
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

export default function CropPdfTool({ initialFiles = [], onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [pdfBytes, setPdfBytes] = useState(null);
    const [pageCount, setPageCount] = useState(0);
    const [filename, setFilename] = useState('cropped');
    const [marginTop, setMarginTop] = useState(0);
    const [marginRight, setMarginRight] = useState(0);
    const [marginBottom, setMarginBottom] = useState(0);
    const [marginLeft, setMarginLeft] = useState(0);
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
            setFilename(`${stem}_cropped`);
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

    const canRun = !!pdfBytes && !isRunning;

    const run = async () => {
        setErrMsg('');
        setSuccessMsg('');
        setIsRunning(true);
        try {
            const doc = await PDFDocument.load(pdfBytes);
            const pages = doc.getPages();

            for (const page of pages) {
                const { width, height } = page.getSize();

                // Calculate new crop box with margins (in points, 1 inch = 72 points)
                const left = Math.max(0, marginLeft);
                const bottom = Math.max(0, marginBottom);
                const right = Math.max(0, width - marginRight);
                const top = Math.max(0, height - marginTop);

                if (right > left && top > bottom) {
                    page.setCropBox(left, bottom, right - left, top - bottom);
                }
            }

            const outBytes = await doc.save();
            const blob = new Blob([outBytes], { type: 'application/pdf' });
            downloadBlob(blob, `${safeFilename(filename)}.pdf`);
            setSuccessMsg(t('tools.edit.cropSuccess', 'PDF cropped successfully!'));
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
                    {t('landingPage.tools.cropPdf', 'Crop PDF')}
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
                    <div style={{ color: '#666' }}>{t('tools.edit.cropHint', 'Select a PDF to crop.')}</div>
                )}
            </div>

            <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 8 }}>{t('tools.edit.margins', 'Margins (points)')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{t('tools.edit.top', 'Top')}</label>
                        <input type="number" value={marginTop} onChange={(e) => setMarginTop(Math.max(0, Number(e.target.value)))} min="0" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{t('tools.edit.right', 'Right')}</label>
                        <input type="number" value={marginRight} onChange={(e) => setMarginRight(Math.max(0, Number(e.target.value)))} min="0" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{t('tools.edit.bottom', 'Bottom')}</label>
                        <input type="number" value={marginBottom} onChange={(e) => setMarginBottom(Math.max(0, Number(e.target.value)))} min="0" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{t('tools.edit.left', 'Left')}</label>
                        <input type="number" value={marginLeft} onChange={(e) => setMarginLeft(Math.max(0, Number(e.target.value)))} min="0" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>{t('tools.edit.marginHint', '72 points = 1 inch. Enter how much to crop from each edge.')}</div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>{t('downloadModal.filename', 'Filename')}</label>
                <input type="text" value={filename} onChange={(e) => setFilename(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }} />
            </div>

            {errMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>{errMsg}</div>}
            {successMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#f2fff4', border: '1px solid #c0e8c6', color: '#1f6a2b' }}>{successMsg}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}>{t('downloadModal.cancel', 'Cancel')}</button>
                <button type="button" onClick={run} disabled={!canRun} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: canRun ? '#A06CD5' : '#bbb', color: '#fff', cursor: canRun ? 'pointer' : 'not-allowed', fontWeight: 800, opacity: canRun ? 1 : 0.7 }}>
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.edit.crop', 'Crop')}
                </button>
            </div>
        </div>
    );
}
