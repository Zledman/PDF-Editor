import React from 'react';
import { useTranslation } from 'react-i18next';

export default function SettingsPopover({
    isOpen,
    onClose,
    targetRef,
    settings,
    onSettingChange,
    isSidebar = false
}) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    if (isSidebar) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-secondary)',
                borderLeft: '1px solid var(--border-color)',
                color: 'var(--text-primary)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t('settings.title', 'Settings')}
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '4px',
                            lineHeight: 1,
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ×
                    </button>
                </div>
                <div style={{ padding: '0 20px', flex: 1, overflowY: 'auto' }}>
                    <SettingsContent
                        t={t}
                        settings={settings}
                        onSettingChange={onSettingChange}
                    />
                </div>
            </div>
        );
    }

    // Positioned mode (popover)
    // ... (Keep existing or update if needed, but primary focus is sidebar now)

    // Calculate position relative to targetRef
    const getPosition = () => {
        if (!targetRef?.current) return { top: 60, right: 16 };
        // Assuming toolbar height is around 50-60px and we want it flush bottom
        // Instead of targetRef.bottom + 8, we can try to find the toolbar container or just use a fixed offset relative to button.
        // The user wants it "directly under the bottom edge of the toolbar", not sidebar.
        // We'll estimate toolbar bottom or try to calculate it.
        // Since toolbar is fixed height usually, let's use a safe offset.
        // rect.bottom is usually correct for "under the button".
        // To push it down to "under the toolbar", we might need to know if button is smaller than toolbar.
        // Let's assume standard toolbar is ~60px.
        const rect = targetRef.current.getBoundingClientRect();
        const toolbarBottom = 60; // Estimated or standard height
        const top = Math.max(rect.bottom, toolbarBottom) + 4;

        return {
            top: top,
            right: window.innerWidth - rect.right
        };
    };

    const position = getPosition();

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1000
            }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: 'absolute',
                    top: position.top,
                    right: position.right,
                    width: '320px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    border: '1px solid #e0e0e0',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '32px 24px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid #f0f0f0'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#333' }}>
                            {t('settings.title', 'Settings')}
                        </h3>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '20px',
                                cursor: 'pointer',
                                color: '#666',
                                padding: '0',
                                lineHeight: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '24px',
                                height: '24px',
                                borderRadius: '4px'
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '0 20px', overflowY: 'auto' }}>
                        <SettingsContent t={t} settings={settings} onSettingChange={onSettingChange} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function SettingsContent({ t, settings, onSettingChange }) {
    return (
        <>
            {/* Spell Check */}
            <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>🔤</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t('settings.spellCheck', 'Spell check')}</span>
                    </div>
                    <ToggleSwitch
                        checked={settings.spellCheckEnabled}
                        onChange={(checked) => onSettingChange('spellCheckEnabled', checked)}
                    />
                </div>
                <p style={{ margin: '0 0 0 30px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {t('settings.spellCheckDesc', 'Highlight typos in fillable fields.')}
                </p>
            </div>

            {/* Smart Guides */}
            <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>🧲</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t('settings.smartGuides', 'Smart guides')}</span>
                    </div>
                    <ToggleSwitch
                        checked={settings.smartGuidesEnabled}
                        onChange={(checked) => onSettingChange('smartGuidesEnabled', checked)}
                    />
                </div>
                <p style={{ margin: '0 0 0 30px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {t('settings.smartGuidesDesc', 'Show guides to align text, fillable fields, and images.')}
                </p>
            </div>

            {/* Navigation Toolbar */}
            <div style={{ padding: '20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>🧭</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t('settings.navToolbar', 'Navigation toolbar')}</span>
                    </div>
                    <ToggleSwitch
                        checked={settings.navigationToolbarEnabled}
                        onChange={(checked) => onSettingChange('navigationToolbarEnabled', checked)}
                    />
                </div>
                <p style={{ margin: '0 0 0 30px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {t('settings.navToolbarDesc', 'Adjust document size, zoom in or out, and switch pages.')}
                </p>
            </div>
        </>
    );
}

function ToggleSwitch({ checked, onChange }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: checked ? '#5cb85c' : '#ccc',
                position: 'relative',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                padding: 0
            }}
        >
            <div
                style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: checked ? '22px' : '2px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }}
            />
        </button>
    );
}
