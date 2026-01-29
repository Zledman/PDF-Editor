import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './MobileWarningBanner.css';

const STORAGE_KEY = 'pdf-editor-mobile-warning-dismissed';

export default function MobileWarningBanner() {
    const { t } = useTranslation();
    const [isDismissed, setIsDismissed] = useState(true); // Start hidden to avoid flash

    useEffect(() => {
        // Check localStorage on mount
        const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
        setIsDismissed(dismissed);
    }, []);

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem(STORAGE_KEY, 'true');
    };

    if (isDismissed) {
        return null;
    }

    return (
        <div className="mobileWarningBanner">
            <div className="mobileWarningBanner__content">
                <svg className="mobileWarningBanner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12" y2="18" />
                </svg>
                <div className="mobileWarningBanner__text">
                    <strong>{t('mobileWarning.title')}</strong>
                    <span>{t('mobileWarning.message')}</span>
                </div>
            </div>
            <button
                className="mobileWarningBanner__dismiss"
                onClick={handleDismiss}
                aria-label={t('mobileWarning.dismiss')}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );
}
