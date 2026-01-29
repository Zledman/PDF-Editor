import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'unlocked';
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

export default function UnlockPdfTool({ initialFiles = [], onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [password, setPassword] = useState('');
    const [filename, setFilename] = useState('unlocked');
    const [isRunning, setIsRunning] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const serverUrl = import.meta.env.VITE_CONVERT_SERVER_URL?.replace('word-to-pdf', 'unlock-pdf') || 'http://localhost:8082/convert/unlock-pdf';

    useEffect(() => {
        const first = initialFiles?.[0];
        if (!first?.buffer || file) return;
        setFile({ name: first.name || 'document.pdf', size: first.size || first.buffer.byteLength, buffer: first.buffer });
        const stem = (first.name || 'document').replace(/\.[^.]+$/, '');
        setFilename(`${stem}_unlocked`);
    }, [initialFiles]);

    const onPick = async (f) => {
        if (!f) return;
        setErrMsg('');
        setSuccessMsg('');
        try {
            const buf = await f.arrayBuffer();
            setFile({ name: f.name || 'document.pdf', size: f.size || buf.byteLength, buffer: buf });
            const stem = (f.name || 'document').replace(/\.[^.]+$/, '');
            setFilename(`${stem}_unlocked`);
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
            form.append('file', new Blob([file.buffer], { type: 'application/pdf' }), file.name);
            form.append('password', password);

            const resp = await fetch(serverUrl, { method: 'POST', body: form });
            if (!resp.ok) {
                const bodyText = await resp.text().catch(() => '');
                throw new Error(`${t('tools.security.error', 'Operation failed')} (${resp.status})${bodyText ? `: ${bodyText.slice(0, 300)}` : ''}`);
            }

            const blob = await resp.blob();
            downloadBlob(blob, `${safeFilename(filename)}.pdf`);
            setSuccessMsg(t('tools.security.unlockSuccess', 'PDF unlocked successfully!'));
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
                    {t('landingPage.tools.unlockPdf', 'Unlock PDF')}
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
                        {file.name} <span style={{ fontWeight: 500, color: '#666' }}>({Math.round((file.size || 0) / 1024)} KB)</span>
                    </div>
                ) : (
                    <div style={{ color: '#666' }}>{t('tools.security.unlockHint', 'Select a password-protected PDF to unlock.')}</div>
                )}
            </div>

            <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.security.password', 'Password')}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('tools.security.enterPassword', 'Enter PDF password')} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>{t('downloadModal.filename', 'Filename')}</label>
                <input type="text" value={filename} onChange={(e) => setFilename(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14 }} />
            </div>

            {errMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>{errMsg}</div>}
            {successMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#f2fff4', border: '1px solid #c0e8c6', color: '#1f6a2b' }}>{successMsg}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}>{t('downloadModal.cancel', 'Cancel')}</button>
                <button type="button" onClick={run} disabled={!canRun} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: canRun ? '#4D8AE6' : '#bbb', color: '#fff', cursor: canRun ? 'pointer' : 'not-allowed', fontWeight: 800, opacity: canRun ? 1 : 0.7 }}>
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.security.unlock', 'Unlock')}
                </button>
            </div>
        </div>
    );
}
