import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
    { key: 'en', label: 'English' },
    { key: 'sv', label: 'Svenska' },
    { key: 'de', label: 'Deutsch' },
    { key: 'fr', label: 'Français' },
    { key: 'es', label: 'Español' },
    { key: 'it', label: 'Italiano' },
    { key: 'nl', label: 'Nederlands' },
    { key: 'pl', label: 'Polski' },
    { key: 'pt', label: 'Português' },
    { key: 'fi', label: 'Suomi' },
    { key: 'da', label: 'Dansk' },
    { key: 'no', label: 'Norsk' }
];

/**
 * TranslatePdfTool - File selection step before opening the side-by-side translation view.
 * After file is selected and user clicks "Translate", it calls onOpenTranslateView with the file buffer.
 */
export default function TranslatePdfTool({ initialFiles, onClose, onStartTranslation }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [targetLang, setTargetLang] = useState('sv');
    const [errMsg, setErrMsg] = useState('');

    useEffect(() => {
        const first = initialFiles?.[0];
        if (!first?.buffer) return;
        if (file) return;
        setFile({ name: first.name || 'current.pdf', size: first.size || first.buffer.byteLength, buffer: first.buffer });
    }, [initialFiles]);

    const onPick = async (f) => {
        if (!f) return;
        setErrMsg('');
        try {
            const buf = await f.arrayBuffer();
            setFile({ name: f.name || 'input.pdf', size: f.size || buf.byteLength, buffer: buf });
        } catch (e) {
            setErrMsg((e && e.message) || 'Could not read file');
        }
    };

    const canRun = !!file?.buffer;

    const handleOpenTranslateView = () => {
        if (!file?.buffer) return;

        // Try prop first, then fallback to global handler
        const handler = onStartTranslation || window.__handleStartTranslation;

        if (typeof handler === 'function') {
            handler({
                pdfBuffer: new Uint8Array(file.buffer),
                fileName: file.name || 'document.pdf',
                targetLang
            });
        } else {
            console.error('Translation handler missing', { prop: !!onStartTranslation, global: !!window.__handleStartTranslation });
            alert('Error: Could not start translation. Please reload the page.');
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ color: '#333', fontWeight: 800, fontSize: 18 }}>
                    {t('landingPage.nav.translatePdf', 'Translate PDF')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #ddd',
                            background: '#fff',
                            cursor: 'pointer',
                            fontWeight: 650
                        }}
                    >
                        {t('landingPage.chooseFile', 'Choose file')}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setFile(null); setErrMsg(''); }}
                        disabled={!file}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #ddd',
                            background: !file ? '#f3f3f3' : '#fff',
                            cursor: !file ? 'not-allowed' : 'pointer',
                            fontWeight: 650,
                            opacity: !file ? 0.6 : 1
                        }}
                    >
                        {t('common.clear', 'Clear')}
                    </button>
                </div>
            </div>

            <input
                id="translate-pdf-file-input"
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                    onPick(e.target.files?.[0]);
                    e.target.value = '';
                }}
            />

            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
                <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 6, color: '#444' }}>
                    {t('tools.input', 'Input')}
                </div>
                {file ? (
                    <div style={{ color: '#333', fontWeight: 700 }}>
                        {file.name}{' '}
                        <span style={{ fontWeight: 500, color: '#666' }}>({Math.round((file.size || 0) / 1024)} KB)</span>
                    </div>
                ) : (
                    <div style={{ color: '#666' }}>{t('tools.translate.hint', 'Select a PDF to translate.')}</div>
                )}
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    {t('tools.translate.description', 'Upload a PDF and translate its text content to another language using AI.')}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 650, color: '#444' }}>
                    {t('tools.translate.targetLanguage', 'Target language')}
                </label>
                <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #ddd',
                        fontSize: 14,
                        cursor: 'pointer'
                    }}
                >
                    {LANGUAGES.map((l) => (
                        <option key={l.key} value={l.key}>{l.label}</option>
                    ))}
                </select>
            </div>

            {errMsg ? (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#fff2f2', border: '1px solid #ffd0d0', color: '#8a1f1f' }}>
                    {errMsg}
                </div>
            ) : null}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: '1px solid #ddd',
                        background: '#fff',
                        cursor: 'pointer',
                        fontWeight: 650
                    }}
                >
                    {t('downloadModal.cancel', 'Cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleOpenTranslateView}
                    disabled={!canRun}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: 'none',
                        background: canRun ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#bbb',
                        color: '#fff',
                        cursor: canRun ? 'pointer' : 'not-allowed',
                        fontWeight: 800,
                        opacity: canRun ? 1 : 0.7
                    }}
                >
                    {t('tools.translate.run', 'Translate')} →
                </button>
            </div>
        </div>
    );
}
