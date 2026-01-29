
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function CropConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    cropRegion
}) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2500, // Higher than everything
            backdropFilter: 'blur(2px)'
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card, #fff)',
                borderRadius: '12px',
                padding: '24px',
                width: '400px',
                maxWidth: '90%',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color, #e0e0e0)'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-primary)' }}>
                    {t('crop.title', 'Beskär PDF')}
                </h3>

                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                    {t('crop.confirmMessage', 'Är du säker på att du vill beskära sidan till det markerade området? Detta kan inte ångras.')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    <button
                        onClick={() => onConfirm('current')}
                        style={{
                            padding: '12px',
                            backgroundColor: '#0066ff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '14px',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        {t('crop.applyToCurrent', 'Endast denna sida')}
                    </button>

                    <button
                        onClick={() => onConfirm('all')}
                        style={{
                            padding: '12px',
                            backgroundColor: '#fff',
                            color: '#0066ff',
                            border: '2px solid #0066ff',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '14px',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        {t('crop.applyToAll', 'Alla sidor')}
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-secondary, #f5f5f5)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                        {t('crop.cancel', 'Avbryt')}
                    </button>
                </div>
            </div>
        </div>
    );
}
