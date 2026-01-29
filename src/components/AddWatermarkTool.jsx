import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'watermarked';
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

export default function AddWatermarkTool({ initialFiles = [], onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [pdfBytes, setPdfBytes] = useState(null);
    const [pageCount, setPageCount] = useState(0);
    const [filename, setFilename] = useState('watermarked');
    const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
    const [fontSize, setFontSize] = useState(48);
    const [opacity, setOpacity] = useState(0.3);
    const [rotation, setRotation] = useState(45);
    const [position, setPosition] = useState('center');
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
            setFilename(`${stem}_watermarked`);
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

    const canRun = !!pdfBytes && !!watermarkText.trim() && !isRunning;

    const run = async () => {
        setErrMsg('');
        setSuccessMsg('');
        setIsRunning(true);
        try {
            const doc = await PDFDocument.load(pdfBytes);
            const pages = doc.getPages();
            const font = await doc.embedFont(StandardFonts.HelveticaBold);

            for (const page of pages) {
                const { width, height } = page.getSize();
                const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
                const textHeight = fontSize;

                let x, y;
                if (position === 'center') {
                    x = (width - textWidth) / 2;
                    y = (height - textHeight) / 2;
                } else if (position === 'top-left') {
                    x = 40;
                    y = height - 60;
                } else if (position === 'top-right') {
                    x = width - textWidth - 40;
                    y = height - 60;
                } else if (position === 'bottom-left') {
                    x = 40;
                    y = 40;
                } else {
                    x = width - textWidth - 40;
                    y = 40;
                }

                page.drawText(watermarkText, {
                    x,
                    y,
                    size: fontSize,
                    font,
                    color: rgb(0.5, 0.5, 0.5),
                    opacity: opacity,
                    rotate: degrees(rotation),
                });
            }

            const outBytes = await doc.save();
            const blob = new Blob([outBytes], { type: 'application/pdf' });
            downloadBlob(blob, `${safeFilename(filename)}.pdf`);
            setSuccessMsg(t('tools.edit.watermarkSuccess', 'Watermark added!'));
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
                    {t('landingPage.tools.addWatermark', 'Add watermark')}
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
                    <div style={{ color: '#666' }}>{t('tools.edit.watermarkHint', 'Select a PDF to add a watermark.')}</div>
                )}
            </div>

            <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.edit.watermarkText', 'Watermark text')}</label>
                <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} placeholder="CONFIDENTIAL" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.edit.position', 'Position')}</label>
                    <select value={position} onChange={(e) => setPosition(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }}>
                        <option value="center">{t('tools.edit.center', 'Center')}</option>
                        <option value="top-left">{t('tools.edit.topLeft', 'Top left')}</option>
                        <option value="top-right">{t('tools.edit.topRight', 'Top right')}</option>
                        <option value="bottom-left">{t('tools.edit.bottomLeft', 'Bottom left')}</option>
                        <option value="bottom-right">{t('tools.edit.bottomRight', 'Bottom right')}</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.edit.rotation', 'Rotation')} (°)</label>
                    <input type="number" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('textSidebar.size', 'Font size')}</label>
                    <input type="number" value={fontSize} onChange={(e) => setFontSize(Math.max(12, Math.min(200, Number(e.target.value))))} min="12" max="200" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('toolbar.opacity', 'Opacity')}</label>
                    <input type="range" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} min="0.1" max="1" step="0.1" style={{ width: '100%' }} />
                    <div style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>{Math.round(opacity * 100)}%</div>
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
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.edit.addWatermark', 'Add watermark')}
                </button>
            </div>
        </div>
    );
}
