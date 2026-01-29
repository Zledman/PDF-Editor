import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

function OutlineItem({ item, onJump }) {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = item.items && item.items.length > 0;

    return (
        <div style={{ width: '100%' }}>
            <div
                className="outline-item"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    transition: 'background-color 0.15s ease'
                }}
                onClick={() => onJump(item.dest)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                {/* Expand/Collapse Toggle */}
                <div
                    style={{
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: hasChildren ? 'pointer' : 'default',
                        marginRight: '4px'
                    }}
                    onClick={(e) => {
                        if (hasChildren) {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }
                    }}
                >
                    {hasChildren && (
                        <span style={{
                            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            display: 'inline-block',
                            fontSize: '10px',
                            color: 'var(--text-secondary)'
                        }}>
                            ▶
                        </span>
                    )}
                </div>

                {/* Title */}
                <span
                    style={{
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        flex: 1
                    }}
                    title={item.title}
                >
                    {item.title}
                </span>
            </div>

            {/* Nested Items */}
            {expanded && hasChildren && (
                <div style={{ paddingLeft: '20px' }}>
                    {item.items.map((subItem, index) => (
                        <OutlineItem key={index} item={subItem} onJump={onJump} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OutlineSidebar({ outline, onJumpToDest }) {
    const { t } = useTranslation();

    if (!outline || outline.length === 0) {
        return (
            <div style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                marginTop: '40%'
            }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>📑</div>
                <p>{t('sidebar.noOutline', 'Ingen innehållsförteckning hittades')}</p>
            </div>
        );
    }

    return (
        <div style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            padding: '10px',
            backgroundColor: 'var(--bg-secondary)'
        }}>
            {outline.map((item, index) => (
                <OutlineItem key={index} item={item} onJump={onJumpToDest} />
            ))}
        </div>
    );
}
