import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './EditorToolbar.css';
import {
    BackIcon, TextIcon, EditTextIcon, OcrIcon, SearchIcon,
    WhiteoutIcon, CommentIcon, CrossIcon, CheckIcon, CopyAreaIcon,
    ImageIcon, HighlightIcon, ShapesIcon, RectangleIcon, CircleIcon,
    LineIcon, ArrowIcon, PanIcon, EraserIcon, DeleteIcon,
    UndoIcon, RedoIcon, PageLayoutIcon, DownloadIcon, LinkIcon, PenIcon, MoreHorizontalIcon, SettingsIcon,
    ZoomInIcon, ZoomOutIcon, CropIcon
} from './EditorToolbarIcons';
// import SettingsPopover from './SettingsPopover'; // Moved to App.jsx for sidebar layout

/**
 * ToolbarButton - Reusable button component with icon and label
 */
function ToolbarButton({
    icon: Icon,
    label,
    tooltip,
    active = false,
    danger = false,
    disabled = false,
    onClick,
    children,
    ...props
}) {
    let className = 'editorToolbar__btn';
    if (active) className += ' editorToolbar__btn--active';
    if (danger) className += ' editorToolbar__btn--danger';

    return (
        <button
            type="button"
            className={className}
            onClick={onClick}
            disabled={disabled}
            title={tooltip || label}
            {...props}
        >
            <span className="editorToolbar__icon">
                {Icon && <Icon />}
                {children}
            </span>
            <span className="editorToolbar__label">{label}</span>
        </button>
    );
}

/**
 * EditorToolbar - Main toolbar component for the PDF editor
 */
export default function EditorToolbar({
    // Navigation
    onBack,
    // Sidebar
    sidebarMode = 'thumbnails',
    setSidebarMode,
    // Tool state
    tool,
    setTool,
    // Zoom
    zoom,
    setZoom,
    onCropStart,
    // Tool-specific handlers
    onOcr,
    onSearch,
    showSearchPanel,
    onSelectImage,
    pendingImageData,
    // Shape settings
    shapeSettings,
    setShapeSettings,
    showShapeTypeDropdown,
    setShowShapeTypeDropdown,
    // Patch mode
    patchMode,
    setPatchMode,
    setSourceRect,
    setSourcePageIndex,
    // Highlight
    setHighlightMode,
    // Selection state
    selectedElement,
    selectedType,
    setSelectedElement,
    setSelectedType,
    hoveredTextBoxIndex,
    setHoveredTextBoxIndex,
    // History
    historyIndex,
    historyLength,
    onUndo,
    onRedo,
    // Delete
    onDelete,
    // Download modal
    onDownload,
    // Page layout
    // Page layout
    onPageLayout,
    showPageLayoutMenu,
    // Settings
    settings,
    onSettingChange,
    showSettingsSidebar,
    onToggleSettings
}) {
    const { t } = useTranslation();

    // Helper to toggle a tool
    const toggleTool = (toolName, options = {}) => {
        if (tool === toolName) {
            setTool(null);
            // Clean up any tool-specific state
            if (options.onDeactivate) options.onDeactivate();
        } else {
            setTool(toolName);
            if (options.onActivate) options.onActivate();
        }
    };

    const [showSidebarMenu, setShowSidebarMenu] = useState(false);
    const sidebarMenuRef = useRef(null);
    const [showMoreToolsMenu, setShowMoreToolsMenu] = useState(false);
    const moreToolsMenuRef = useRef(null);

    // const [showSettingsPopover, setShowSettingsPopover] = useState(false); // Removed local state
    const settingsButtonRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(event.target)) {
                setShowSidebarMenu(false);
            }
            if (moreToolsMenuRef.current && !moreToolsMenuRef.current.contains(event.target)) {
                setShowMoreToolsMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="editorToolbar">

            {/* Sidebar Menu & Text Tools */}
            <div className="editorToolbar__group editorToolbar__group--separated" ref={sidebarMenuRef}>
                <div className="editorToolbar__dropdown">
                    <button
                        className="editorToolbar__btn"
                        onClick={() => setShowSidebarMenu(!showSidebarMenu)}
                        title={t('toolbar.sidebarMenu', 'Sidopanel')}
                        style={{
                            minWidth: '120px',
                            flexDirection: 'row',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: showSidebarMenu ? 'var(--bg-card-hover)' : 'transparent',
                            border: '1px solid transparent',
                            borderColor: showSidebarMenu ? 'var(--border-color)' : 'transparent'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="editorToolbar__icon">
                                {sidebarMode === 'thumbnails' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px', width: '14px', height: '14px' }}><div style={{ background: 'currentColor' }} /><div style={{ background: 'currentColor' }} /><div style={{ background: 'currentColor' }} /><div style={{ background: 'currentColor' }} /></div>}
                                {sidebarMode === 'outline' && <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '14px', height: '14px' }}><div style={{ height: '2px', width: '100%', background: 'currentColor' }} /><div style={{ height: '2px', width: '70%', background: 'currentColor' }} /><div style={{ height: '2px', width: '90%', background: 'currentColor' }} /></div>}
                                {sidebarMode === 'comments' && <div style={{ width: '14px', height: '14px', border: '2px solid currentColor', borderRadius: '4px 4px 0 4px' }} />}
                                {sidebarMode === 'bookmarks' && <div style={{ width: '10px', height: '14px', border: '2px solid currentColor', borderTop: 'none' }} />}
                            </span>
                            <span className="editorToolbar__label" style={{ maxWidth: 'unset' }}>
                                {sidebarMode === 'thumbnails' && t('sidebar.thumbnails', 'Miniatyrbilder')}
                                {sidebarMode === 'outline' && t('sidebar.outline', 'Kontur')}
                                {sidebarMode === 'comments' && t('sidebar.comments', 'Kommentarer')}
                                {sidebarMode === 'bookmarks' && t('sidebar.bookmarks', 'Bokmärken')}
                            </span>
                        </div>
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span>
                    </button>

                    {showSidebarMenu && (
                        <div className="editorToolbar__dropdownMenu" style={{ width: '180px', left: 0 }}>
                            {[
                                { mode: 'thumbnails', label: t('sidebar.thumbnails', 'Miniatyrbilder'), icon: <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px', width: '14px', height: '14px' }}><div style={{ background: 'currentColor' }} /><div style={{ background: 'currentColor' }} /><div style={{ background: 'currentColor' }} /><div style={{ background: 'currentColor' }} /></div> },
                                { mode: 'outline', label: t('sidebar.outline', 'Kontur'), icon: <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '14px', height: '14px' }}><div style={{ height: '2px', width: '100%', background: 'currentColor' }} /><div style={{ height: '2px', width: '70%', background: 'currentColor' }} /><div style={{ height: '2px', width: '90%', background: 'currentColor' }} /></div> },
                                { mode: 'comments', label: t('sidebar.comments', 'Kommentarer'), icon: <div style={{ width: '14px', height: '14px', border: '2px solid currentColor', borderRadius: '4px 4px 0 4px' }} /> },
                                { mode: 'bookmarks', label: t('sidebar.bookmarks', 'Bokmärken'), icon: <div style={{ width: '10px', height: '14px', border: '2px solid currentColor', borderTop: 'none' }} /> }
                            ].map((item) => (
                                <button
                                    key={item.mode}
                                    className={`editorToolbar__dropdownItem ${sidebarMode === item.mode ? 'editorToolbar__dropdownItem--active' : ''}`}
                                    onClick={() => {
                                        setSidebarMode(item.mode);
                                        setShowSidebarMenu(false);
                                    }}
                                >
                                    <div className="editorToolbar__icon" style={{ width: '20px' }}>{item.icon}</div>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Text editing tools */}
            <div className="editorToolbar__group">
                <ToolbarButton
                    icon={TextIcon}
                    label={t('toolbar.addText')}
                    tooltip={t('toolbar.tooltips.addText', 'Klicka på PDF:en för att lägga till text')}
                    active={tool === 'text'}
                    onClick={() => toggleTool('text')}
                />
                <ToolbarButton
                    icon={EditTextIcon}
                    label={t('toolbar.editText', 'Redigera text')}
                    tooltip={t('toolbar.tooltips.editText', 'Klicka på en textbox för att redigera den')}
                    active={tool === 'edit-text'}
                    onClick={() => toggleTool('edit-text', {
                        onActivate: () => {
                            setSelectedElement(null);
                            setSelectedType(null);
                        },
                        onDeactivate: () => setHoveredTextBoxIndex?.(null)
                    })}
                />
                <ToolbarButton
                    icon={OcrIcon}
                    label={t('toolbar.ocr', 'OCR')}
                    tooltip={t('toolbar.tooltips.ocr', 'Kör OCR för att göra skannad text redigerbar')}
                    onClick={onOcr}
                />
            </div>

            {/* Search */}
            <div className="editorToolbar__group">
                <ToolbarButton
                    icon={SearchIcon}
                    label={t('toolbar.search', 'Sök')}
                    tooltip={t('toolbar.tooltips.search', 'Sök efter text i PDF:en (Ctrl+F)')}
                    active={showSearchPanel}
                    onClick={onSearch}
                />
            </div>

            {/* Annotation tools */}
            <div className="editorToolbar__group">
                <ToolbarButton
                    icon={WhiteoutIcon}
                    label={t('toolbar.whiteout')}
                    tooltip={t('toolbar.tooltips.whiteout', 'Täck över innehåll med en vit ruta')}
                    active={tool === 'whiteout'}
                    onClick={() => toggleTool('whiteout', {
                        onDeactivate: () => {
                            if (selectedType === 'whiteout') {
                                setSelectedElement(null);
                                setSelectedType(null);
                            }
                        }
                    })}
                />
                <ToolbarButton
                    icon={CommentIcon}
                    label={t('toolbar.comment', 'Kommentar')}
                    tooltip={t('toolbar.tooltips.comment', 'Lägg till en kommentar på PDF:en')}
                    active={tool === 'comment'}
                    onClick={() => toggleTool('comment', {
                        onDeactivate: () => {
                            if (selectedType === 'comment') {
                                setSelectedElement(null);
                                setSelectedType(null);
                            }
                        }
                    })}
                />
                <ToolbarButton
                    icon={LinkIcon}
                    label={t('toolbar.link', 'Länkar')}
                    tooltip={t('toolbar.tooltips.link', 'Skapa klickbara länkar')}
                    active={tool === 'link'}
                    onClick={() => toggleTool('link', {
                        onDeactivate: () => {
                            if (selectedType === 'link') {
                                setSelectedElement(null);
                                setSelectedType(null);
                            }
                        }
                    })}
                />
            </div>

            {/* Check/Cross marks */}
            <div className="editorToolbar__group">
                <ToolbarButton
                    icon={CrossIcon}
                    label={t('toolbar.cross')}
                    tooltip={t('toolbar.tooltips.cross', 'Placera ett kryss (X) på PDF:en')}
                    active={tool === 'shape-cross'}
                    onClick={() => {
                        if (tool === 'shape-cross') {
                            setTool(null);
                        } else {
                            setShapeSettings({ ...shapeSettings, type: 'cross' });
                            setTool('shape-cross');
                        }
                    }}
                />
                <ToolbarButton
                    icon={CheckIcon}
                    label={t('toolbar.check')}
                    tooltip={t('toolbar.tooltips.check', 'Placera en bock (✓) på PDF:en')}
                    active={tool === 'shape-check'}
                    onClick={() => {
                        if (tool === 'shape-check') {
                            setTool(null);
                        } else {
                            setShapeSettings({ ...shapeSettings, type: 'check' });
                            setTool('shape-check');
                        }
                    }}
                />
            </div>

            {/* Copy area & Image */}
            <div className="editorToolbar__group">
                <ToolbarButton
                    icon={CopyAreaIcon}
                    label={patchMode === 'select' ? t('toolbar.copyArea') : t('toolbar.place')}
                    tooltip={t('toolbar.tooltips.copyArea', 'Kopiera och klistra in ett område från PDF:en')}
                    active={tool === 'patch'}
                    onClick={() => toggleTool('patch', {
                        onActivate: () => {
                            setPatchMode('select');
                            setSourceRect(null);
                            setSourcePageIndex(null);
                        },
                        onDeactivate: () => {
                            setPatchMode('select');
                            setSourceRect(null);
                            setSourcePageIndex(null);
                            if (selectedType === 'patch') {
                                setSelectedElement(null);
                                setSelectedType(null);
                            }
                        }
                    })}
                />
                <ToolbarButton
                    icon={ImageIcon}
                    label={t('toolbar.image', 'Bild')}
                    tooltip={pendingImageData
                        ? t('toolbar.tooltips.imageReady', 'Dra för att placera bilden')
                        : t('toolbar.tooltips.image', 'Välj en bild (PNG/JPG) och placera på sidan')}
                    active={tool === 'image'}
                    onClick={() => {
                        if (tool === 'image') {
                            setTool(null);
                        } else {
                            onSelectImage?.();
                        }
                    }}
                />
            </div>

            {/* Highlight */}
            <div className="editorToolbar__group">
                <ToolbarButton
                    icon={HighlightIcon}
                    label={t('toolbar.highlightRect', 'Highlight')}
                    tooltip={t('toolbar.tooltips.highlight', 'Markera text med färg')}
                    active={tool === 'highlight'}
                    onClick={() => {
                        const next = tool === 'highlight' ? null : 'highlight';
                        setTool(next);
                        if (next) setHighlightMode('rect');
                    }}
                />
                <ToolbarButton
                    icon={PenIcon}
                    label={t('toolbar.pen', 'Penna')}
                    tooltip={t('toolbar.tooltips.pen', 'Rita fritt på PDF:en')}
                    active={tool === 'pen'}
                    onClick={() => toggleTool('pen')}
                />
            </div>

            {/* Shapes dropdown */}
            <div className="editorToolbar__group">
                <div className="editorToolbar__dropdown" data-shape-type-dropdown>
                    <ToolbarButton
                        icon={ShapesIcon}
                        label={t('toolbar.shapes')}
                        tooltip={t('toolbar.tooltips.shapes', 'Rita former som rektanglar, cirklar, linjer och pilar')}
                        active={tool && tool.startsWith('shape') && !['shape-cross', 'shape-check'].includes(tool)}
                        onClick={() => {
                            console.log('Shape button clicked, current tool:', tool);
                            const isShapeTool = tool && tool.startsWith('shape') && !['shape-cross', 'shape-check'].includes(tool);
                            console.log('isShapeTool:', isShapeTool);
                            if (isShapeTool) {
                                setShowShapeTypeDropdown(!showShapeTypeDropdown);
                            } else {
                                // Om cross/check är aktivt, eller shapeSettings.type är cross/check, använd rectangle som standard
                                const targetType = ['cross', 'check'].includes(shapeSettings.type) ? 'rectangle' : shapeSettings.type;
                                console.log('Setting tool to shape-', targetType);
                                setSelectedElement(null);
                                setSelectedType(null);
                                setShapeSettings({ ...shapeSettings, type: targetType });
                                setTool(`shape-${targetType}`);
                                setShowShapeTypeDropdown(true);
                            }
                        }}
                    />
                    {tool && tool.startsWith('shape') && !['shape-cross', 'shape-check'].includes(tool) && showShapeTypeDropdown && (
                        <div className="editorToolbar__dropdownMenu">
                            {[
                                { type: 'rectangle', Icon: RectangleIcon },
                                { type: 'circle', Icon: CircleIcon },
                                { type: 'line', Icon: LineIcon },
                                { type: 'arrow', Icon: ArrowIcon }
                            ].map(({ type, Icon }) => (
                                <button
                                    key={type}
                                    type="button"
                                    className={`editorToolbar__dropdownItem ${shapeSettings.type === type ? 'editorToolbar__dropdownItem--active' : ''}`}
                                    onClick={() => {
                                        setShapeSettings({ ...shapeSettings, type });
                                        setTool(`shape-${type}`);
                                        setShowShapeTypeDropdown(false);
                                    }}
                                >
                                    <Icon />
                                    <span>{t(`toolbar.${type}`)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Pan & Eraser */}
            <div className="editorToolbar__group">
                <ToolbarButton
                    icon={PanIcon}
                    label={t('toolbar.pan')}
                    tooltip={t('toolbar.tooltips.pan', 'Dra för att flytta PDF:en')}
                    active={tool === 'pan'}
                    onClick={() => toggleTool('pan')}
                />
                <ToolbarButton
                    icon={EraserIcon}
                    label={t('toolbar.eraser', 'Eraser')}
                    tooltip={t('toolbar.tooltips.eraser', 'Radera element genom att klicka på dem')}
                    active={tool === 'eraser'}
                    onClick={() => toggleTool('eraser')}
                />
            </div>

            {/* More Tools Dropdown */}
            <div className="editorToolbar__group" ref={moreToolsMenuRef}>
                <div className="editorToolbar__dropdown">
                    <ToolbarButton
                        icon={MoreHorizontalIcon}
                        label={t('toolbar.moreTools', 'Fler verktyg')}
                        tooltip={t('toolbar.tooltips.moreTools', 'Visa fler verktyg')}
                        active={showMoreToolsMenu}
                        onClick={() => setShowMoreToolsMenu(!showMoreToolsMenu)}
                    />
                    {showMoreToolsMenu && (
                        <div className="editorToolbar__dropdownMenu" style={{ minWidth: '160px' }}>
                            {[
                                {
                                    id: 'zoomIn',
                                    label: t('toolbar.zoomIn', 'Zooma in'),
                                    icon: <ZoomInIcon />,
                                    onClick: () => {
                                        if (setZoom) setZoom(prev => Math.min(prev + 0.25, 5.0));
                                    }
                                },
                                {
                                    id: 'zoomOut',
                                    label: t('toolbar.zoomOut', 'Zooma ut'),
                                    icon: <ZoomOutIcon />,
                                    onClick: () => {
                                        if (setZoom) setZoom(prev => Math.max(prev - 0.25, 0.5));
                                    }
                                },
                                { id: 'separator-zoom', type: 'separator' },
                                {
                                    id: 'crop',
                                    label: t('toolbar.crop', 'Beskär PDF'),
                                    icon: <CropIcon />,
                                    onClick: () => onCropStart?.()
                                },
                                { id: 'separator-1', type: 'separator' },
                                { id: 'measure', label: t('toolbar.measure', 'Mätverktyg'), icon: '📏' },
                                { id: 'stamp', label: t('toolbar.stamp', 'Stämpel'), icon: '💮' },
                                { id: 'notes', label: t('toolbar.notes', 'Anteckningar'), icon: '📝' }
                            ].map((item) => (
                                item.type === 'separator' ? (
                                    <div key={item.id} style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                                ) : (
                                    <button
                                        key={item.id}
                                        className="editorToolbar__dropdownItem"
                                        onClick={() => {
                                            if (item.onClick) {
                                                item.onClick();
                                            } else {
                                                console.log(`Tool ${item.id} selected`);
                                            }
                                            // Don't close for zoom actions to allow repeated clicks? 
                                            // Actually user wanted it in the menu, usually menu closes. 
                                            // But for zoom it's annoying if it closes.
                                            // Let's keep the menu open for zoom?
                                            // If I want to keep it open, I shouldn't set showMoreToolsMenu(false).
                                            if (item.id !== 'zoomIn' && item.id !== 'zoomOut') {
                                                setShowMoreToolsMenu(false);
                                            }
                                        }}
                                    >
                                        <span className="editorToolbar__icon" style={{ width: '20px' }}>
                                            {typeof item.icon === 'string' ? item.icon : item.icon}
                                        </span>
                                        <span>{item.label}</span>
                                        {item.id === 'zoomIn' || item.id === 'zoomOut' ? (
                                            <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.5 }}>
                                                {item.id === 'zoomIn' ? '+' : '-'}
                                            </span>
                                        ) : null}
                                    </button>
                                )
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete selected */}
            {selectedElement !== null && (
                <div className="editorToolbar__group">
                    <ToolbarButton
                        icon={DeleteIcon}
                        label={t('toolbar.delete')}
                        tooltip={t('toolbar.tooltips.delete', 'Ta bort markerat element')}
                        danger
                        onClick={onDelete}
                    />
                </div>
            )}

            {/* Undo/Redo */}
            <div className="editorToolbar__group">
                <ToolbarButton
                    icon={UndoIcon}
                    label={t('toolbar.undo')}
                    tooltip={t('tooltips.undo', 'Ångra senaste åtgärden (Ctrl+Z)')}
                    disabled={historyIndex <= 0}
                    onClick={onUndo}
                />
                <ToolbarButton
                    icon={RedoIcon}
                    label={t('toolbar.redo')}
                    tooltip={t('tooltips.redo', 'Gör om senaste ångrade åtgärden (Ctrl+Y)')}
                    disabled={historyIndex >= historyLength - 1}
                    onClick={onRedo}
                />
            </div>

            {/* Right-aligned tools */}
            <div className="editorToolbar__group editorToolbar__group--right">
                <ToolbarButton
                    icon={PageLayoutIcon}
                    label={t('toolbar.pageLayout', 'Sidlayout')}
                    tooltip={t('toolbar.tooltips.pageLayout', 'Ändra hur PDF:en visas')}
                    active={showPageLayoutMenu}
                    onClick={onPageLayout}
                    data-page-layout-toggle="true"
                />

                <div ref={settingsButtonRef}>
                    <ToolbarButton
                        icon={SettingsIcon}
                        label={t('toolbar.settings', 'Settings')}
                        tooltip={t('toolbar.tooltips.settings', 'Inställningar')}
                        active={showSettingsSidebar}
                        onClick={onToggleSettings}
                    />
                </div>

            </div>
        </div>
    );
}
