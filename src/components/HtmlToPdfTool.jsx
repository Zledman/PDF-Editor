import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'webpage';
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

export default function HtmlToPdfTool({ onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [inputMode, setInputMode] = useState('file'); // 'file' | 'paste'
    const [file, setFile] = useState(null);
    const [htmlContent, setHtmlContent] = useState('');
    const [filename, setFilename] = useState('webpage');
    const [isRunning, setIsRunning] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const serverUrl = import.meta.env.VITE_CONVERT_SERVER_URL?.replace('word-to-pdf', 'html-to-pdf') || 'http://localhost:8082/convert/html-to-pdf';

    const onPick = async (f) => {
        if (!f) return;
        setErrMsg('');
        setSuccessMsg('');
        try {
            const text = await f.text();
            setFile({ name: f.name || 'page.html', size: f.size || text.length, content: text });
            const stem = (f.name || 'webpage').replace(/\.[^.]+$/, '');
            setFilename(stem);
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not read file');
        }
    };

    const canRun = (inputMode === 'file' ? !!file?.content : htmlContent.trim().length > 0) && !isRunning;

    const run = async () => {
        setErrMsg('');
        setSuccessMsg('');
        setIsRunning(true);
        try {
            const content = inputMode === 'file' ? file.content : htmlContent;
            const form = new FormData();
            form.append('file', new Blob([content], { type: 'text/html' }), 'input.html');

            const resp = await fetch(serverUrl, { method: 'POST', body: form });
            if (!resp.ok) {
                const bodyText = await resp.text().catch(() => '');
                throw new Error(`${t('tools.convert.error', 'Conversion failed')} (${resp.status})${bodyText ? `: ${bodyText.slice(0, 300)}` : ''}`);
            }

            const blob = await resp.blob();
            downloadBlob(blob, `${safeFilename(filename)}.pdf`);
            setSuccessMsg(t('tools.convert.success', 'Conversion successful!'));
        } catch (e) {
            setErrMsg((e && e.message) || t('tools.convert.error', 'Conversion failed'));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
                    {t('landingPage.tools.htmlToPdf', 'HTML to PDF')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => setInputMode('file')}
                        style={{ padding: '8px 12px', borderRadius: 8, border: inputMode === 'file' ? '2px solid #F4D35E' : '1px solid #ddd', background: inputMode === 'file' ? '#FFFBEB' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                    >
                        {t('tools.convert.uploadFile', 'Upload file')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setInputMode('paste')}
                        style={{ padding: '8px 12px', borderRadius: 8, border: inputMode === 'paste' ? '2px solid #F4D35E' : '1px solid #ddd', background: inputMode === 'paste' ? '#FFFBEB' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                    >
                        {t('tools.convert.pasteHtml', 'Paste HTML')}
                    </button>
                </div>
            </div>

            {inputMode === 'file' && (
                <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}
                        >
                            {t('landingPage.chooseFile', 'Choose file')}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setFile(null); setSuccessMsg(''); setErrMsg(''); }}
                            disabled={!file || isRunning}
                            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', background: !file || isRunning ? '#f3f3f3' : '#fff', cursor: !file || isRunning ? 'not-allowed' : 'pointer', fontWeight: 650, opacity: !file || isRunning ? 0.6 : 1 }}
                        >
                            {t('common.clear', 'Clear')}
                        </button>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".html,.htm,text/html"
                        style={{ display: 'none' }}
                        onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }}
                    />

                    <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
                        <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 6, color: '#444' }}>
                            {t('tools.input', 'Input')}
                        </div>
                        {file ? (
                            <div style={{ color: '#333', fontWeight: 700 }}>
                                {file.name} <span style={{ fontWeight: 500, color: '#666' }}>({Math.round((file.size || 0) / 1024)} KB)</span>
                            </div>
                        ) : (
                            <div style={{ color: '#666' }}>{t('tools.convert.htmlHint', 'Select an HTML file to convert to PDF.')}</div>
                        )}
                    </div>
                </>
            )}

            {inputMode === 'paste' && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 6, color: '#444' }}>
                        {t('tools.convert.htmlContent', 'HTML Content')}
                    </div>
                    <textarea
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        placeholder="<html><body><h1>Hello World</h1></body></html>"
                        style={{
                            width: '100%',
                            minHeight: 200,
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid #ddd',
                            fontSize: 13,
                            fontFamily: 'monospace',
                            resize: 'vertical'
                        }}
                    />
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>{t('downloadModal.filename', 'Filename')}</label>
                <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="webpage"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }}
                />
            </div>

            {errMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>{errMsg}</div>}
            {successMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#f2fff4', border: '1px solid #c0e8c6', color: '#1f6a2b' }}>{successMsg}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}>
                    {t('downloadModal.cancel', 'Cancel')}
                </button>
                <button
                    type="button"
                    onClick={run}
                    disabled={!canRun}
                    style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: canRun ? '#F4D35E' : '#bbb', color: canRun ? '#333' : '#fff', cursor: canRun ? 'pointer' : 'not-allowed', fontWeight: 800, opacity: canRun ? 1 : 0.7 }}
                >
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.convert.run', 'Convert')}
                </button>
            </div>
        </div>
    );
}
