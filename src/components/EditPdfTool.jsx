import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function EditPdfTool({ onClose, onLoadPdf }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);
    const [errMsg, setErrMsg] = useState('');

    const onPick = async (f) => {
        if (!f) return;
        setErrMsg('');
        try {
            const buf = await f.arrayBuffer();
            // Close modal and load PDF into main editor
            if (onLoadPdf) {
                onLoadPdf(buf, f.name);
            }
            onClose?.();
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not read file');
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
                    {t('landingPage.tools.editPdf', 'Edit PDF')}
                </div>
            </div>

            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />

            <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, border: '1px solid #eee', background: '#fafafa', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
                    {t('tools.edit.editHint', 'Select a PDF to open in the full editor where you can add text, whiteout, shapes, and more.')}
                </div>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        padding: '14px 28px',
                        borderRadius: 12,
                        border: 'none',
                        background: '#A06CD5',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 16
                    }}
                >
                    {t('landingPage.chooseFile', 'Choose file')}
                </button>
            </div>

            {errMsg && <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>{errMsg}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 650 }}>{t('downloadModal.cancel', 'Cancel')}</button>
            </div>
        </div>
    );
}
