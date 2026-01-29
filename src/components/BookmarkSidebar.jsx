import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function BookmarkSidebar({
    bookmarks = [],
    currentPage,
    onAddBookmark,
    onRemoveBookmark,
    onUpdateBookmark,
    onSelectBookmark
}) {
    const { t } = useTranslation();
    const listRef = useRef(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const inputRef = useRef(null);

    // Auto-scroll to bottom of list when new bookmark is added
    useEffect(() => {
        if (listRef.current && bookmarks.length > 0) {
            const lastItem = listRef.current.lastElementChild;
            if (lastItem) {
                lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [bookmarks.length]);

    // Focus input when adding
    useEffect(() => {
        if (isAdding && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isAdding]);

    const handleStartAdd = () => {
        setNewTitle(`${t('common.page', 'Sida')} ${currentPage}`);
        setIsAdding(true);
    };

    const handleCancelAdd = () => {
        setIsAdding(false);
        setNewTitle('');
    };

    const handleSaveAdd = () => {
        onAddBookmark(newTitle);
        setIsAdding(false);
        setNewTitle('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSaveAdd();
        } else if (e.key === 'Escape') {
            handleCancelAdd();
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return '';
        try {
            return isoString.split('T')[0];
        } catch (e) {
            return '';
        }
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header / Add Button */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                flexShrink: 0
            }}>
                {!isAdding ? (
                    <button
                        onClick={handleStartAdd}
                        style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                            e.currentTarget.style.borderColor = 'var(--border-hover)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>+</span>
                        {t('bookmarks.add', 'Lägg till bokmärke')}
                    </button>
                ) : (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('bookmarks.namePlaceholder', 'Namn på bokmärke')}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid var(--primary-color)',
                                borderRadius: '4px',
                                fontSize: '13px',
                                outline: 'none',
                                boxShadow: '0 0 0 2px rgba(74, 144, 226, 0.2)'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleSaveAdd}
                                style={{
                                    flex: 1,
                                    padding: '6px',
                                    backgroundColor: '#4A90E2',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('common.save', 'Spara')}
                            </button>
                            <button
                                onClick={handleCancelAdd}
                                style={{
                                    flex: 1,
                                    padding: '6px',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('common.cancel', 'Avbryt')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bookmarks List */}
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0'
                }}
            >
                {bookmarks.length === 0 ? (
                    <div style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: '14px',
                        opacity: 0.7
                    }}>
                        <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔖</div>
                        <p>{t('bookmarks.empty', 'Inga bokmärken än')}</p>
                        <p style={{ fontSize: '12px', marginTop: '10px' }}>
                            {t('bookmarks.emptyHint', 'Spara viktiga sidor för att hitta dem snabbt.')}
                        </p>
                    </div>
                ) : (
                    bookmarks.map((bookmark) => {
                        const isCurrentPage = bookmark.pageIndex === (currentPage - 1);

                        return (
                            <div
                                key={bookmark.id}
                                onClick={() => onSelectBookmark && onSelectBookmark(bookmark.pageIndex)}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    backgroundColor: isCurrentPage ? 'rgba(74, 144, 226, 0.08)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s ease',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isCurrentPage) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    if (!isCurrentPage) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                {/* Icon */}
                                <div style={{ color: isCurrentPage ? '#4A90E2' : 'var(--text-secondary)' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isCurrentPage ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        color: 'var(--text-primary)',
                                        fontSize: '13px',
                                        fontWeight: isCurrentPage ? '600' : '500',
                                        marginBottom: '2px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {bookmark.title}
                                    </div>
                                    <div style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: '11px'
                                    }}>
                                        {formatDate(bookmark.timestamp)}
                                    </div>
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onRemoveBookmark) onRemoveBookmark(bookmark.id);
                                    }}
                                    title={t('common.delete', 'Ta bort')}
                                    style={{
                                        padding: '6px',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        opacity: 0.6,
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = 1;
                                        e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
                                        e.currentTarget.style.color = '#ff4444';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = 0.6;
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
