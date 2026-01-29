import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function FlagUK() {
    return (
        <svg width="20" height="15" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
            <clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
            <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
            <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4" />
            <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
            <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </svg>
    );
}

function FlagSE() {
    return (
        <svg width="20" height="15" viewBox="0 0 16 10" xmlns="http://www.w3.org/2000/svg">
            <rect width="16" height="10" fill="#006aa7" />
            <rect x="5" width="2" height="10" fill="#fecc00" />
            <rect y="4" width="16" height="2" fill="#fecc00" />
        </svg>
    );
}

export default function LanguageSelector() {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    const languages = [
        { code: 'en', label: 'English', flag: <FlagUK /> },
        { code: 'sv', label: 'Svenska', flag: <FlagSE /> }
    ];

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    return (
        <div className="language-selector" ref={dropdownRef} style={{ position: 'relative', zIndex: 100 }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    backgroundColor: 'var(--bg-card)',
                    border: isOpen ? '1px solid var(--brand-primary)' : '1px solid var(--border-color)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    minWidth: '110px',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => {
                    if (!isOpen) e.currentTarget.style.borderColor = 'var(--border-hover)';
                }}
                onMouseLeave={(e) => {
                    if (!isOpen) e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                        {currentLang.flag}
                    </div>
                    <span>{currentLang.code.toUpperCase()}</span>
                </div>
                <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                    }}
                >
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    backgroundColor: 'var(--bg-menu)',
                    border: '1px solid var(--border-menu)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '4px',
                    zIndex: 9999,
                    minWidth: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                }}>
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => {
                                i18n.changeLanguage(lang.code);
                                setIsOpen(false);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                border: 'none',
                                backgroundColor: i18n.language === lang.code ? 'var(--bg-card-hover)' : 'transparent',
                                color: i18n.language === lang.code ? 'var(--brand-primary)' : 'var(--text-primary)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: i18n.language === lang.code ? '600' : '400',
                                textAlign: 'left',
                                width: '100%',
                                transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                                if (i18n.language !== lang.code) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                            }}
                            onMouseLeave={(e) => {
                                if (i18n.language !== lang.code) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <div style={{ display: 'flex', borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                                {lang.flag}
                            </div>
                            <span>{lang.label}</span>
                            {i18n.language === lang.code && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto' }}>
                                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
