import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function LinkSettingsPopover({ linkBox, onUpdate, onDelete, position }) {
    const { t } = useTranslation();
    const [localLink, setLocalLink] = useState(linkBox.value || '');
    const [localType, setLocalType] = useState(linkBox.linkType || 'url');

    useEffect(() => {
        setLocalLink(linkBox.value || '');
        setLocalType(linkBox.linkType || 'url');
    }, [linkBox]);

    const handleSave = (key, value) => {
        onUpdate({ ...linkBox, [key]: value });
    };

    const toggleType = (type) => {
        setLocalType(type);
        handleSave('linkType', type);
        if (type === 'page' && isNaN(Number(localLink))) {
            setLocalLink('1');
            handleSave('value', '1');
        } else if (type === 'url' && !isNaN(Number(localLink))) {
            setLocalLink('');
            handleSave('value', '');
        }
    };

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
                position: 'absolute',
                left: position?.x || 0,
                top: position?.y || 0,
                width: '300px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                zIndex: 1000
            }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px'
            }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {t('link.settings', 'Länkinställningar')}
                </span>
                <button
                    onClick={onDelete}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'background 0.2s',
                        ':hover': { backgroundColor: 'var(--bg-hover)' }
                    }}
                    title={t('common.delete', 'Ta bort')}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>

            {/* Link Type Toggle */}
            <div style={{
                display: 'flex',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid var(--border-color)'
            }}>
                <button
                    onClick={() => toggleType('url')}
                    style={{
                        flex: 1,
                        padding: '6px',
                        border: 'none',
                        backgroundColor: localType === 'url' ? 'var(--brand-primary, #4A90E2)' : 'transparent',
                        color: localType === 'url' ? 'white' : 'var(--text-secondary)',
                        fontSize: '13px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: localType === 'url' ? 500 : 400,
                        transition: 'all 0.2s'
                    }}
                >
                    <span>{t('link.website', 'Webbplats')}</span>
                </button>
                <button
                    onClick={() => toggleType('page')}
                    style={{
                        flex: 1,
                        padding: '6px',
                        border: 'none',
                        backgroundColor: localType === 'page' ? 'var(--brand-primary, #4A90E2)' : 'transparent',
                        color: localType === 'page' ? 'white' : 'var(--text-secondary)',
                        fontSize: '13px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: localType === 'page' ? 500 : 400,
                        transition: 'all 0.2s'
                    }}
                >
                    <span>{t('link.page', 'Sida')}</span>
                </button>
            </div>

            {/* Link Input */}
            <div>
                <input
                    type={localType === 'url' ? 'text' : 'number'}
                    value={localLink}
                    onChange={(e) => {
                        setLocalLink(e.target.value);
                        handleSave('value', e.target.value);
                    }}
                    placeholder={localType === 'url' ? 'www.example.com' : '1'}
                    style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        marginTop: '4px'
                    }}
                    min={localType === 'page' ? 1 : undefined}
                />
            </div>
        </div>
    );
}
