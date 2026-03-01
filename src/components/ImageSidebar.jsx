import { useTranslation } from 'react-i18next';

export default function ImageSidebar({
    patchBox,
    onUpdate,
    onDelete,
    sidebarWidth = 0
}) {
    const { t } = useTranslation();

    const rotation = patchBox?.rotation || 0;
    const opacity = patchBox?.opacity ?? 100;

    const handleRotateLeft = () => {
        if (onUpdate && patchBox) {
            onUpdate({
                ...patchBox,
                rotation: (rotation - 90) % 360
            });
        }
    };

    const handleRotateRight = () => {
        if (onUpdate && patchBox) {
            onUpdate({
                ...patchBox,
                rotation: (rotation + 90) % 360
            });
        }
    };

    const handleOpacityChange = (e) => {
        const newOpacity = parseInt(e.target.value, 10);
        if (onUpdate && patchBox) {
            onUpdate({
                ...patchBox,
                opacity: newOpacity
            });
        }
    };

    return (
        <div
            data-image-sidebar
            style={{
                position: 'absolute',
                top: 0,
                left: `${sidebarWidth}px`,
                right: '17px',
                zIndex: 50,
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                padding: '12px 20px',
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
                flexWrap: 'wrap',
                animation: 'slideDown 0.3s ease-out',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
        >
            <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

            {/* Rotation Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500' }}>
                    {t('imageSidebar.rotation', 'Rotation')}:
                </span>
                <button
                    onClick={handleRotateLeft}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.borderColor = 'var(--border-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                    title={t('imageSidebar.rotateLeft', 'Rotera vänster')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7v6h6" />
                        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                    </svg>
                </button>
                <button
                    onClick={handleRotateRight}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.borderColor = 'var(--border-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                    title={t('imageSidebar.rotateRight', 'Rotera höger')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 7v6h-6" />
                        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                    </svg>
                </button>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', minWidth: '40px' }}>
                    {rotation}°
                </span>
            </div>

            {/* Opacity Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500' }}>
                    {t('imageSidebar.opacity', 'Opacitet')}:
                </span>
                <input
                    type="range"
                    min="10"
                    max="100"
                    value={opacity}
                    onChange={handleOpacityChange}
                    style={{
                        width: '120px',
                        height: '6px',
                        cursor: 'pointer',
                        accentColor: 'var(--accent-color, #ff6b35)'
                    }}
                    title={t('imageSidebar.opacityTooltip', 'Justera bildens genomskinlighet')}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', minWidth: '40px' }}>
                    {opacity}%
                </span>
            </div>

            {/* Delete Button */}
            {onDelete && (
                <button
                    onClick={() => {
                        if (window.confirm(t('imageSidebar.confirmDelete', 'Vill du ta bort bilden?'))) {
                            onDelete();
                        }
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        backgroundColor: '#c0392b',
                        color: '#fff',
                        border: '1px solid #a93226',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e74c3c';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#c0392b';
                    }}
                    title={t('imageSidebar.delete', 'Ta bort bild')}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    {t('imageSidebar.deleteButton', 'Ta bort')}
                </button>
            )}
        </div>
    );
}
