import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'redacted';
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

export default function RedactPdfTool({ initialFiles = [], onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const [file, setFile] = useState(null);
    const [pdfBytes, setPdfBytes] = useState(null);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [pageCount, setPageCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [filename, setFilename] = useState('redacted');
    const [redactions, setRedactions] = useState([]); // { pageIndex, x, y, width, height }
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [scale, setScale] = useState(1);
    const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const first = initialFiles?.[0];
        if (!first?.buffer || file) return;
        loadPdf(first.buffer, first.name);
    }, [initialFiles]);

    const loadPdf = async (buffer, name) => {
        try {
            const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
            setPdfBytes(buffer);
            setPdfDoc(doc);
            setPageCount(doc.numPages);
            setFile({ name: name || 'document.pdf', size: buffer.byteLength });
            const stem = (name || 'document').replace(/\.[^.]+$/, '');
            setFilename(`${stem}_redacted`);
            setCurrentPage(1);
            setRedactions([]);
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not load PDF');
        }
    };

    useEffect(() => {
        if (!pdfDoc) return;
        renderPage(currentPage);
    }, [pdfDoc, currentPage, redactions]);

    const renderPage = async (pageNum) => {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = containerRef.current?.offsetWidth || 500;
        const newScale = Math.min(1.5, containerWidth / viewport.width);
        setScale(newScale);

        const scaledViewport = page.getViewport({ scale: newScale });
        setPageSize({ width: scaledViewport.width, height: scaledViewport.height });

        const canvas = canvasRef.current;
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

        // Draw redaction boxes for current page
        const pageRedactions = redactions.filter(r => r.pageIndex === pageNum - 1);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        for (const r of pageRedactions) {
            ctx.fillRect(r.x * newScale, r.y * newScale, r.width * newScale, r.height * newScale);
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

    const startDrawing = (e) => {
        if (!pdfDoc) return;
        setIsDrawing(true);
        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) / scale;
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) / scale;
        setDrawStart({ x, y });
    };

    const stopDrawing = (e) => {
        if (!isDrawing || !drawStart) return;
        setIsDrawing(false);
        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((e.clientX || e.changedTouches?.[0]?.clientX) - rect.left) / scale;
        const y = ((e.clientY || e.changedTouches?.[0]?.clientY) - rect.top) / scale;

        const newRedaction = {
            pageIndex: currentPage - 1,
            x: Math.min(drawStart.x, x),
            y: Math.min(drawStart.y, y),
            width: Math.abs(x - drawStart.x),
            height: Math.abs(y - drawStart.y)
        };

        if (newRedaction.width > 5 && newRedaction.height > 5) {
            setRedactions([...redactions, newRedaction]);
        }
        setDrawStart(null);
    };

    const clearRedactions = () => {
        setRedactions([]);
    };

    const canRun = !!pdfBytes && redactions.length > 0 && !isRunning;

    const run = async () => {
        setErrMsg('');
        setSuccessMsg('');
        setIsRunning(true);
        try {
            const doc = await PDFDocument.load(pdfBytes);
            const pages = doc.getPages();

            for (const r of redactions) {
                if (r.pageIndex < pages.length) {
                    const page = pages[r.pageIndex];
                    const { height } = page.getSize();
                    // PDF coordinates are from bottom-left, canvas from top-left
                    page.drawRectangle({
                        x: r.x,
                        y: height - r.y - r.height,
                        width: r.width,
                        height: r.height,
                        color: rgb(0, 0, 0),
                    });
                }
            }

            const outBytes = await doc.save();
            const blob = new Blob([outBytes], { type: 'application/pdf' });
            downloadBlob(blob, `${safeFilename(filename)}.pdf`);
            setSuccessMsg(t('tools.security.redactSuccess', 'PDF redacted successfully!'));
        } catch (e) {
            setErrMsg((e && e.message) || t('tools.security.error', 'Operation failed'));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
                    {t('landingPage.tools.redactPdf', 'Redact PDF')}
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}>
                    {t('landingPage.chooseFile', 'Choose file')}
                </button>
            </div>

            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />

            {!pdfDoc && (
                <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
                    <div style={{ color: '#666' }}>{t('tools.security.redactHint', 'Select a PDF and draw rectangles over text to redact.')}</div>
                </div>
            )}

            {pdfDoc && (
                <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: currentPage > 1 ? 'pointer' : 'not-allowed' }}>←</button>
                        <span style={{ fontSize: 13 }}>{t('toolbar.page', 'Page')} {currentPage} / {pageCount}</span>
                        <button type="button" disabled={currentPage >= pageCount} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: currentPage < pageCount ? 'pointer' : 'not-allowed' }}>→</button>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 12, color: '#666' }}>{redactions.length} {t('tools.security.redactionAreas', 'redaction area(s)')}</span>
                        <button type="button" onClick={clearRedactions} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12 }}>{t('common.clear', 'Clear')}</button>
                    </div>

                    <div ref={containerRef} style={{ marginBottom: 12, border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden', background: '#888' }}>
                        <canvas
                            ref={canvasRef}
                            style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
                            onMouseDown={startDrawing}
                            onMouseUp={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchEnd={stopDrawing}
                        />
                    </div>
                </>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>{t('downloadModal.filename', 'Filename')}</label>
                <input type="text" value={filename} onChange={(e) => setFilename(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }} />
            </div>

            {errMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>{errMsg}</div>}
            {successMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#f2fff4', border: '1px solid #c0e8c6', color: '#1f6a2b' }}>{successMsg}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}>{t('downloadModal.cancel', 'Cancel')}</button>
                <button type="button" onClick={run} disabled={!canRun} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: canRun ? '#4D8AE6' : '#bbb', color: '#fff', cursor: canRun ? 'pointer' : 'not-allowed', fontWeight: 800, opacity: canRun ? 1 : 0.7 }}>
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.security.redact', 'Redact')}
                </button>
            </div>
        </div>
    );
}
