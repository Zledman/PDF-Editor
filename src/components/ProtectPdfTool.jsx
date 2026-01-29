import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

function safeFilename(name) {
    const trimmed = String(name || '').trim() || 'protected';
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

export default function ProtectPdfTool({ initialFiles = [], onClose }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [userPassword, setUserPassword] = useState('');
    const [ownerPassword, setOwnerPassword] = useState('');
    const [filename, setFilename] = useState('protected');
    const [isRunning, setIsRunning] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const serverUrl = import.meta.env.VITE_CONVERT_SERVER_URL?.replace('word-to-pdf', 'protect-pdf') || 'http://localhost:8082/convert/protect-pdf';

    useEffect(() => {
        const first = initialFiles?.[0];
        if (!first?.buffer || file) return;
        setFile({ name: first.name || 'document.pdf', size: first.size || first.buffer.byteLength, buffer: first.buffer });
        const stem = (first.name || 'document').replace(/\.[^.]+$/, '');
        setFilename(`${stem}_protected`);
    }, [initialFiles]);

    const onPick = async (f) => {
        if (!f) return;
        setErrMsg('');
        setSuccessMsg('');
        try {
            const buf = await f.arrayBuffer();
            setFile({ name: f.name || 'document.pdf', size: f.size || buf.byteLength, buffer: buf });
            const stem = (f.name || 'document').replace(/\.[^.]+$/, '');
            setFilename(`${stem}_protected`);
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not read file');
        }
    };

    const canRun = !!file?.buffer && (userPassword || ownerPassword) && !isRunning;

    const run = async () => {
        setErrMsg('');
        setSuccessMsg('');
        setIsRunning(true);
        try {
            const form = new FormData();
            form.append('file', new Blob([file.buffer], { type: 'application/pdf' }), file.name);
            if (userPassword) form.append('userPassword', userPassword);
            if (ownerPassword) form.append('ownerPassword', ownerPassword);

            const resp = await fetch(serverUrl, { method: 'POST', body: form });
            if (!resp.ok) {
                const bodyText = await resp.text().catch(() => '');
                throw new Error(`${t('tools.security.error', 'Operation failed')} (${resp.status})${bodyText ? `: ${bodyText.slice(0, 300)}` : ''}`);
            }

            const blob = await resp.blob();
            downloadBlob(blob, `${safeFilename(filename)}.pdf`);
            setSuccessMsg(t('tools.security.protectSuccess', 'PDF protected successfully!'));
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
                    {t('landingPage.tools.protectPdf', 'Protect PDF')}
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
                    <div style={{ color: '#666' }}>{t('tools.security.protectHint', 'Select a PDF to protect with a password.')}</div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.security.userPassword', 'User password')}</label>
                    <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder={t('tools.security.openPassword', 'Required to open')} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 650, color: '#444', display: 'block', marginBottom: 6 }}>{t('tools.security.ownerPassword', 'Owner password')}</label>
                    <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder={t('tools.security.editPassword', 'Required to edit')} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
            </div>

            <div style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.5 }}>
                <div style={{ marginBottom: 4 }}><strong>{t('tools.security.userPassword', 'User password')}:</strong> {t('tools.security.userPasswordDesc', 'Required to open the PDF. Leave empty if anyone can open it.')}</div>
                <div><strong>{t('tools.security.ownerPassword', 'Owner password')}:</strong> {t('tools.security.ownerPasswordDesc', 'Required to edit/print. If empty, the user password is used for both.')}</div>
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
                    {isRunning ? t('loading.processing', 'Processing...') : t('tools.security.protect', 'Protect')}
                </button>
            </div>
        </div>
    );
}
