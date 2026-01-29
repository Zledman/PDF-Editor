import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';

export default function ComparePdfTool({ onClose }) {
    const { t } = useTranslation();
    const fileInputRef1 = useRef(null);
    const fileInputRef2 = useRef(null);
    const canvasRef1 = useRef(null);
    const canvasRef2 = useRef(null);

    const [file1, setFile1] = useState(null);
    const [file2, setFile2] = useState(null);
    const [pdfDoc1, setPdfDoc1] = useState(null);
    const [pdfDoc2, setPdfDoc2] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [maxPages, setMaxPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [errMsg, setErrMsg] = useState('');

    const loadPdf = async (buffer, name, which) => {
        try {
            const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
            if (which === 1) {
                setPdfDoc1(doc);
                setFile1({ name, size: buffer.byteLength, pages: doc.numPages });
            } else {
                setPdfDoc2(doc);
                setFile2({ name, size: buffer.byteLength, pages: doc.numPages });
            }
            return doc;
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not load PDF');
            return null;
        }
    };

    const onPick = async (f, which) => {
        if (!f) return;
        setErrMsg('');
        setIsLoading(true);
        try {
            const buf = await f.arrayBuffer();
            await loadPdf(buf, f.name, which);
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not read file');
        } finally {
            setIsLoading(false);
        }
    };

    // Render pages when both are loaded
    const renderPages = async (pageNum) => {
        if (!pdfDoc1 || !pdfDoc2) return;

        const maxP = Math.max(pdfDoc1.numPages, pdfDoc2.numPages);
        setMaxPages(maxP);
        const safePageNum = Math.min(pageNum, maxP);

        // Render PDF 1
        if (safePageNum <= pdfDoc1.numPages) {
            const page1 = await pdfDoc1.getPage(safePageNum);
            const viewport1 = page1.getViewport({ scale: 1 });
            const scale1 = Math.min(300 / viewport1.width, 400 / viewport1.height);
            const scaledViewport1 = page1.getViewport({ scale: scale1 });
            const canvas1 = canvasRef1.current;
            canvas1.width = scaledViewport1.width;
            canvas1.height = scaledViewport1.height;
            await page1.render({ canvasContext: canvas1.getContext('2d'), viewport: scaledViewport1 }).promise;
        } else {
            const canvas1 = canvasRef1.current;
            const ctx = canvas1.getContext('2d');
            canvas1.width = 300;
            canvas1.height = 400;
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, 300, 400);
            ctx.fillStyle = '#888';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t('tools.security.noPage', 'No page'), 150, 200);
        }

        // Render PDF 2
        if (safePageNum <= pdfDoc2.numPages) {
            const page2 = await pdfDoc2.getPage(safePageNum);
            const viewport2 = page2.getViewport({ scale: 1 });
            const scale2 = Math.min(300 / viewport2.width, 400 / viewport2.height);
            const scaledViewport2 = page2.getViewport({ scale: scale2 });
            const canvas2 = canvasRef2.current;
            canvas2.width = scaledViewport2.width;
            canvas2.height = scaledViewport2.height;
            await page2.render({ canvasContext: canvas2.getContext('2d'), viewport: scaledViewport2 }).promise;
        } else {
            const canvas2 = canvasRef2.current;
            const ctx = canvas2.getContext('2d');
            canvas2.width = 300;
            canvas2.height = 400;
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, 300, 400);
            ctx.fillStyle = '#888';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t('tools.security.noPage', 'No page'), 150, 200);
        }
    };

    // Re-render when both docs are loaded or page changes
    useState(() => {
        if (pdfDoc1 && pdfDoc2) {
            renderPages(currentPage);
        }
    }, [pdfDoc1, pdfDoc2, currentPage]);

    const bothLoaded = !!pdfDoc1 && !!pdfDoc2;

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
                    {t('landingPage.tools.comparePdf', 'Compare PDF')}
                </div>
            </div>

            <input ref={fileInputRef1} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => { onPick(e.target.files?.[0], 1); e.target.value = ''; }} />
            <input ref={fileInputRef2} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => { onPick(e.target.files?.[0], 2); e.target.value = ''; }} />

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 750, color: '#444' }}>{t('tools.security.document1', 'Document 1')}</div>
                        <button type="button" onClick={() => fileInputRef1.current?.click()} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            {file1 ? t('common.change', 'Change') : t('landingPage.chooseFile', 'Choose file')}
                        </button>
                    </div>
                    {file1 ? (
                        <div style={{ fontSize: 12, color: '#666' }}>{file1.name} ({file1.pages} p.)</div>
                    ) : (
                        <div style={{ fontSize: 12, color: '#999' }}>{t('tools.security.selectFirst', 'Select first PDF')}</div>
                    )}
                </div>
                <div style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 750, color: '#444' }}>{t('tools.security.document2', 'Document 2')}</div>
                        <button type="button" onClick={() => fileInputRef2.current?.click()} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            {file2 ? t('common.change', 'Change') : t('landingPage.chooseFile', 'Choose file')}
                        </button>
                    </div>
                    {file2 ? (
                        <div style={{ fontSize: 12, color: '#666' }}>{file2.name} ({file2.pages} p.)</div>
                    ) : (
                        <div style={{ fontSize: 12, color: '#999' }}>{t('tools.security.selectSecond', 'Select second PDF')}</div>
                    )}
                </div>
            </div>

            {bothLoaded && (
                <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <button type="button" disabled={currentPage <= 1} onClick={() => { setCurrentPage(p => p - 1); renderPages(currentPage - 1); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: currentPage > 1 ? 'pointer' : 'not-allowed' }}>←</button>
                        <span style={{ fontSize: 13 }}>{t('toolbar.page', 'Page')} {currentPage} / {maxPages}</span>
                        <button type="button" disabled={currentPage >= maxPages} onClick={() => { setCurrentPage(p => p + 1); renderPages(currentPage + 1); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: currentPage < maxPages ? 'pointer' : 'not-allowed' }}>→</button>
                    </div>

                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 12 }}>
                        <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                            <canvas ref={canvasRef1} style={{ display: 'block', maxWidth: 300 }} />
                        </div>
                        <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                            <canvas ref={canvasRef2} style={{ display: 'block', maxWidth: 300 }} />
                        </div>
                    </div>
                </>
            )}

            {!bothLoaded && (
                <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 14 }}>
                    {t('tools.security.compareHint', 'Select two PDF files to compare them side by side.')}
                </div>
            )}

            {errMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>{errMsg}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}>{t('pageManagement.close', 'Close')}</button>
            </div>
        </div>
    );
}
