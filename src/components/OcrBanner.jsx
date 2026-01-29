import { useTranslation } from 'react-i18next';
import './OcrBanner.css';

export default function OcrBanner({ onMakeEditable, onDismiss }) {
    const { t } = useTranslation();

    return (
        <div className="ocrBanner">
            <div className="ocrBannerContent">
                <span className="ocrBannerIcon">⚠️</span>
                <span className="ocrBannerText">
                    {t('ocrBanner.message', 'Your document contains unrecognized text. Would you like to apply OCR to make it editable?')}
                </span>
                <button className="ocrBannerButton" onClick={onMakeEditable}>
                    {t('ocrBanner.button', 'Make editable')}
                </button>
            </div>
            <button className="ocrBannerClose" onClick={onDismiss} aria-label="Close">
                ×
            </button>
        </div>
    );
}
