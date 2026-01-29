import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'numbered';
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

export default function AddPageNumbersTool({ initialFiles = [], onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [pdfBytes, setPdfBytes] = useState(null);
    const [pageCount, setPageCount] = useState(0);
    const [filename, setFilename] = useState('numbered');
    const [position, setPosition] = useState('bottom-center');
    const [format, setFormat] = useState('page-x');
    const [fontSize, setFontSize] = useState(12);
    const [startNumber, setStartNumber] = useState(1);
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
            setFilename(`${stem}_numbered`);
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
            const font = await doc.embedFont(StandardFonts.Helvetica);
            const totalPages = pages.length;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                const pageNum = startNumber + i;

                let text;
                if (format === 'page-x') {
                    text = `${pageNum}`;
                } else if (format === 'page-x-of-y') {
                    text = `${pageNum} / ${startNumber + totalPages - 1}`;
                } else if (format === 'page-word') {
                    text = `Page ${pageNum}`;
                } else {
                    text = `Page ${pageNum} of ${startNumber + totalPages - 1}`;
                }

                const textWidth = font.widthOfTextAtSize(text, fontSize);
                let x, y;

                if (position === 'bottom-center') {
                    x = (width - textWidth) / 2;
                    y = 30;
                } else if (position === 'bottom-left') {
                    x = 40;
                    y = 30;
                } else if (position === 'bottom-right') {
                    x = width - textWidth - 40;
                    y = 30;
                } else if (position === 'top-center') {
                    x = (width - textWidth) / 2;
                    y = height - 30;
                } else if (position === 'top-left') {
                    x = 40;
                    y = height - 30;
                } else {
                    x = width - textWidth - 40;
                    y = height - 30;
                }

                page.drawText(text, {
                    x,
                    y,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });
            }

            const outBytes = await doc.save();
            const blob = new Blob([outBytes], { type: 'application/pdf' });
            downloadBlob(blob, `${safeFilename(filename)}.pdf`);
            setSuccessMsg(t('tools.edit.pageNumbersSuccess', 'Page numbers added!'));
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
                    {t('landingPage.tools.addPageNumbers', 'Add page numbers')}
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
                    <div style={{ color: '#666' }}>{t('tools.edit.pageNumbersHint', 'Select a PDF to add page numbers.')}</div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.edit.position', 'Position')}</label>
                    <select value={position} onChange={(e) => setPosition(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }}>
                        <option value="bottom-center">{t('tools.edit.bottomCenter', 'Bottom center')}</option>
                        <option value="bottom-left">{t('tools.edit.bottomLeft', 'Bottom left')}</option>
                        <option value="bottom-right">{t('tools.edit.bottomRight', 'Bottom right')}</option>
                        <option value="top-center">{t('tools.edit.topCenter', 'Top center')}</option>
                        <option value="top-left">{t('tools.edit.topLeft', 'Top left')}</option>
                        <option value="top-right">{t('tools.edit.topRight', 'Top right')}</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.edit.format', 'Format')}</label>
                    <select value={format} onChange={(e) => setFormat(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }}>
                        <option value="page-x">1, 2, 3...</option>
                        <option value="page-x-of-y">1 / 5, 2 / 5...</option>
                        <option value="page-word">Page 1, Page 2...</option>
                        <option value="page-word-of">Page 1 of 5...</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('textSidebar.size', 'Font size')}</label>
                    <input type="number" value={fontSize} onChange={(e) => setFontSize(Math.max(6, Math.min(48, Number(e.target.value))))} min="6" max="48" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.edit.startNumber', 'Start at')}</label>
                    <input type="number" value={startNumber} onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value)))} min="1" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
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
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.edit.addNumbers', 'Add numbers')}
                </button>
            </div>
        </div>
    );
}
