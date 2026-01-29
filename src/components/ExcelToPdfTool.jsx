import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'spreadsheet';
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

export default function ExcelToPdfTool({ initialFiles = [], onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [filename, setFilename] = useState('spreadsheet');
    const [isRunning, setIsRunning] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const serverUrl = import.meta.env.VITE_CONVERT_SERVER_URL?.replace('word-to-pdf', 'excel-to-pdf') || 'http://localhost:8082/convert/excel-to-pdf';

    useEffect(() => {
        const first = initialFiles?.[0];
        if (!first?.buffer || file) return;
        setFile({ name: first.name || 'spreadsheet.xlsx', size: first.size || first.buffer.byteLength, buffer: first.buffer });
        const stem = (first.name || 'spreadsheet').replace(/\.[^.]+$/, '');
        setFilename(stem);
    }, [initialFiles]);

    const onPick = async (f) => {
        if (!f) return;
        setErrMsg('');
        setSuccessMsg('');
        try {
            const buf = await f.arrayBuffer();
            setFile({ name: f.name || 'spreadsheet.xlsx', size: f.size || buf.byteLength, buffer: buf });
            const stem = (f.name || 'spreadsheet').replace(/\.[^.]+$/, '');
            setFilename(stem);
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not read file');
        }
    };

    const canRun = !!file?.buffer && !isRunning;

    const run = async () => {
        setErrMsg('');
        setSuccessMsg('');
        setIsRunning(true);
        try {
            const form = new FormData();
            form.append('file', new Blob([file.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), file.name);

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
                    {t('landingPage.tools.excelToPdf', 'EXCEL to PDF')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
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
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                    <div style={{ color: '#666' }}>{t('tools.convert.excelHint', 'Select an Excel file (.xls, .xlsx) to convert to PDF.')}</div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>{t('downloadModal.filename', 'Filename')}</label>
                <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="spreadsheet"
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
                    style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: canRun ? '#2A9D8F' : '#bbb', color: '#fff', cursor: canRun ? 'pointer' : 'not-allowed', fontWeight: 800, opacity: canRun ? 1 : 0.7 }}
                >
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.convert.run', 'Convert')}
                </button>
            </div>
        </div>
    );
}
