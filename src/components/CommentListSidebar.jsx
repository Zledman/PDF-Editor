import React from 'react';
import { useTranslation } from 'react-i18next';

export default function CommentListSidebar({ commentBoxes, onSelectComment }) {
    const { t } = useTranslation();

    const comments = commentBoxes
        .map((box, index) => box ? { ...box, id: index } : null)
        .filter(box => box !== null);

    const commentCount = comments.length;

    if (commentCount === 0) {
        return (
            <div style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                marginTop: '40%'
            }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>💬</div>
                <p>{t('sidebar.noComments', 'Inga kommentarer ännu')}</p>
                <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>
                    {t('sidebar.addCommentHint', 'Använd kommentarsverktyget för att lägga till.')}
                </p>
            </div>
        );
    }

    // Format date to YYYY-MM-DD
    const formatDate = (isoString) => {
        if (!isoString) return new Date().toISOString().split('T')[0];
        try {
            return isoString.split('T')[0];
        } catch (e) {
            return new Date().toISOString().split('T')[0];
        }
    };

    // Group comments by page
    const commentsByPage = comments.reduce((acc, comment) => {
        const page = comment.pageIndex + 1;
        if (!acc[page]) acc[page] = [];
        acc[page].push(comment);
        return acc;
    }, {});

    return (
        <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header Count */}
            <div style={{
                padding: '16px 20px',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)'
            }}>
                {commentCount} {commentCount === 1 ? t('sidebar.note', 'anteckning') : t('sidebar.notes', 'anteckningar')}
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {Object.entries(commentsByPage).map(([pageNum, pageComments]) => (
                    <div key={pageNum}>
                        {/* Page Header */}
                        <div style={{
                            backgroundColor: 'var(--bg-tertiary)', // Light gray/blue output
                            padding: '8px 20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            textAlign: 'right', // Aligned to right per screenshot
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            {t('common.page', 'Sida')} {pageNum}
                        </div>

                        {/* Comments List */}
                        {pageComments.map((comment) => (
                            <div
                                key={comment.id}
                                onClick={() => onSelectComment(comment.id)}
                                style={{
                                    padding: '16px 20px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-card)',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'flex-start',
                                    transition: 'background-color 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                                }}
                            >
                                {/* Icon */}
                                <div style={{
                                    paddingTop: '2px', // Align with text top
                                    color: '#6c5ce7' // Purple color from screenshot
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                        <line x1="8" y1="9" x2="16" y2="9" />
                                        <line x1="8" y1="13" x2="13" y2="13" />
                                    </svg>
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        color: 'var(--text-primary)',
                                        fontSize: '14px',
                                        fontWeight: '400',
                                        lineHeight: '1.4',
                                        marginBottom: '4px',
                                        wordBreak: 'break-word'
                                    }}>
                                        {comment.text || t('commentSidebar.empty', 'Ingen text')}
                                    </div>
                                    <div style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: '12px'
                                    }}>
                                        {formatDate(comment.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
