import { useTranslation } from 'react-i18next';
import './UploadProgress.css';

export default function UploadProgress({ progress = 0, message }) {
    const { t } = useTranslation();

    const displayMessage = message || t('upload.uploading', 'Your file is uploading');

    return (
        <div className="uploadProgressOverlay">
            <div className="uploadProgressCard">
                {/* Icon */}
                <div className="uploadProgressIconWrapper">
                    <svg className="uploadProgressIcon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 18V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9 15L12 12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>

                {/* Text */}
                <div className="uploadProgressText">
                    <span>{displayMessage}</span>
                    <span className="uploadProgressPercent">{Math.round(progress)}%</span>
                </div>

                {/* Progress bar */}
                <div className="uploadProgressBarTrack">
                    <div
                        className="uploadProgressBarFill"
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                    <div
                        className="uploadProgressBarDot"
                        style={{ left: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
