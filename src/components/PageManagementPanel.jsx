import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RotateLeftIcon,
  RotateRightIcon,
  DeleteIcon,
  DuplicateIcon,
  MoveIcon,
  UndoIcon,
  RedoIcon,
  AddPageIcon,
  SelectAllIcon,
  DeselectIcon,
  MoveBeforeIcon,
  MoveAfterIcon,
  ImportIcon,
  MoreHorizontalIcon,
  ZoomInIcon,
  ZoomOutIcon
} from './EditorToolbarIcons';
import ThumbnailGrid from './ThumbnailGrid';

export default function PageManagementPanel({
  pdfDoc,
  numPages,
  initialPage = 1,
  onSave,
  onClose
}) {
  const { t } = useTranslation();

  // Local state for the transactional editing
  // Structure: [{ id: uniqueId, originalPageIndex: number | null (if new), rotation: number, isDeleted: boolean }]

  const [pages, setPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set());

  // History for Undo/Redo
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // externalDocs: Map<docId, { pdfJsDoc, arrayBuffer }>
  const [externalDocs] = useState(new Map());
  const fileInputRef = useRef(null);

  // Zoom & Menu State
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Initialize pages from props
    // originalIndex is 0-based index from the source PDF
    const initialPages = Array.from({ length: numPages }, (_, i) => ({
      id: `page-${i}`,
      originalIndex: i,
      rotation: 0,
      isDeleted: false,
      docId: 'main' // default to main doc
    }));
    setPages(initialPages);
    setHistory([]);
    setFuture([]);
  }, [numPages]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 2.0));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const pushHistory = (newPages) => {
    setHistory(prev => [...prev, pages]);
    setFuture([]); // Clear future on new action
    setPages(newPages);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, history.length - 1);

    setFuture(prev => [pages, ...prev]);
    setPages(previous);
    setHistory(newHistory);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory(prev => [...prev, pages]);
    setPages(next);
    setFuture(newFuture);
  };

  const handleToggleSelection = (pageId) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allIds = pages.filter(p => !p.isDeleted).map(p => p.id);
    setSelectedPages(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedPages(new Set());
  };

  const handleAddPage = () => {
    const newPage = {
      id: `new-${Date.now()}`,
      originalIndex: null, // Indicates blank/new page
      rotation: 0,
      isDeleted: false,
      docId: 'main'
    };

    const newPages = [...pages, newPage];
    pushHistory(newPages);
  };

  // Actions
  const handleRotate = (angle) => {
    if (selectedPages.size === 0) return;

    const newPages = pages.map(p => {
      if (selectedPages.has(p.id)) {
        return { ...p, rotation: (p.rotation + angle) % 360 };
      }
      return p;
    });
    pushHistory(newPages);
  };

  const handleDelete = () => {
    if (selectedPages.size === 0) return;

    const newPages = pages.map(p => {
      if (selectedPages.has(p.id)) {
        return { ...p, isDeleted: true };
      }
      return p;
    });
    // Clear selection after delete
    setSelectedPages(new Set());
    pushHistory(newPages);
  };

  const handleDuplicate = () => {
    if (selectedPages.size === 0) return;

    const newPages = [...pages];
    // Insert duplicates after their originals
    const result = [];
    pages.forEach(p => {
      result.push(p);
      if (selectedPages.has(p.id) && !p.isDeleted) {
        const newId = `dup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        result.push({
          ...p,
          id: newId,
          // originalIndex keeps pointing to source content
          // rotation is copied
          isDeleted: false,
          docId: p.docId || 'main'
        });
      }
    });

    pushHistory(result);
  };

  const moveSelected = (direction) => {
    if (selectedPages.size === 0) return;

    const newPages = [...pages];
    const selectedIndices = newPages
      .map((p, i) => (selectedPages.has(p.id) && !p.isDeleted ? i : -1))
      .filter(i => i !== -1)
      .sort((a, b) => direction === -1 ? a - b : b - a);

    if (selectedIndices.length === 0) return;

    let moved = false;

    for (const index of selectedIndices) {
      const targetIndex = index + direction;
      if (targetIndex >= 0 && targetIndex < newPages.length) {
        // Swap
        [newPages[index], newPages[targetIndex]] = [newPages[targetIndex], newPages[index]];
        moved = true;
      }
    }

    if (moved) pushHistory(newPages);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert(t('errors.invalidFileType', 'Ogiltig filtyp. Vänligen välj en PDF.'));
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Load with pdfjs
      // Använd importerad pdfjsLib, men se till att worker är satt
      // Vi kan anta att main App.jsx har satt worker om den är global, annars kanske vi måste sätta den här eller importera en konfigurerad instans.
      // Här importerar vi dock inte 'pdfjs-dist' direkt i denna filen. Vi behöver kanske göra det.

      // Hack: we assume window.pdfjsLib might be available or we can dynamically import.
      // Better: Import it at the top. But let's assume standard import for now.

      // We need to dynamically import pdfjsLib to avoid build issues if it's not in this module scope
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const importedDoc = await loadingTask.promise;

      const docId = `doc-${Date.now()}`;
      externalDocs.set(docId, {
        pdfJsDoc: importedDoc,
        arrayBuffer: arrayBuffer
      });

      // Create pages for imported doc
      const newPages = [];
      for (let i = 0; i < importedDoc.numPages; i++) {
        newPages.push({
          id: `${docId}-page-${i}`,
          originalIndex: i, // 0-based
          rotation: 0,
          isDeleted: false,
          docId: docId
        });
      }

      // Append to end
      pushHistory([...pages, ...newPages]);

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      console.error("Import failed", err);
      alert(t('errors.importFailed', 'Import misslyckades'));
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="application/pdf"
        onChange={handleFileChange}
      />
      <div style={{
        width: '90%',
        height: '90%',
        backgroundColor: '#f5f5f7',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}
      >
        {/* Top Toolbar */}
        <div style={{
          height: '60px',
          backgroundColor: '#fff',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          flexShrink: 0
        }}>
          {/* Left Group: Add Pages */}
          <div style={{ display: 'flex', gap: '5px', marginRight: '20px' }}>
            <ToolbarButton label={t('pageManagement.addPage', 'Ny sida')} Icon={AddPageIcon} onClick={handleAddPage} />
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0', margin: '0 10px' }}></div>

          {/* Center Group: Actions */}
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '4px' }}>
            <ToolbarButton label={t('pageManagement.delete', 'Radera sidor')} Icon={DeleteIcon} onClick={handleDelete} />
            <ToolbarButton label={t('pageManagement.duplicate', 'Duplicera')} Icon={DuplicateIcon} onClick={handleDuplicate} />
            <ToolbarButton label={t('pageManagement.rotateLeft', 'Rotera vänster')} Icon={RotateLeftIcon} onClick={() => handleRotate(-90)} />
            <ToolbarButton label={t('pageManagement.rotateRight', 'Rotera höger')} Icon={RotateRightIcon} onClick={() => handleRotate(90)} />
            <ToolbarButton label={t('pageManagement.move', 'Flytta')} Icon={MoveIcon} onClick={() => console.log('Move Dialog?')} />

            <ToolbarButton label={t('pageManagement.moveBefore', 'Flytta före')} Icon={MoveBeforeIcon} onClick={() => moveSelected(-1)} />
            <ToolbarButton label={t('pageManagement.moveAfter', 'Flytta efter')} Icon={MoveAfterIcon} onClick={() => moveSelected(1)} />
            <ToolbarButton label={t('pageManagement.importDocument', 'Importera dokument')} Icon={ImportIcon} onClick={handleImportClick} />
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0', margin: '0 10px', flexShrink: 0 }}></div>

          {/* Right Group: Undo/Redo & Selection */}
          <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto', flexShrink: 0 }}>
            <ToolbarButton label={t('toolbar.undo', 'Ångra')} Icon={UndoIcon} onClick={handleUndo} disabled={history.length === 0} />
            <ToolbarButton label={t('toolbar.redo', 'Gör om')} Icon={RedoIcon} onClick={handleRedo} disabled={future.length === 0} />
            <div style={{ width: '1px', height: '20px', backgroundColor: '#e0e0e0', margin: '0 10px' }}></div>
            <ToolbarButton label={t('pageManagement.selectAll', 'Markera allt')} Icon={SelectAllIcon} onClick={handleSelectAll} />
            <ToolbarButton label={t('pageManagement.deselectAll', 'Markera inga')} Icon={DeselectIcon} onClick={handleDeselectAll} />

            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  backgroundColor: showMenu ? '#e0e0e0' : 'transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#555',
                  transition: 'background-color 0.1s'
                }}
                onMouseEnter={(e) => !showMenu && (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                onMouseLeave={(e) => !showMenu && (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ width: 20, height: 20 }}><MoreHorizontalIcon /></div>
              </button>

              {showMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '5px',
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  border: '1px solid #e0e0e0',
                  minWidth: '150px',
                  zIndex: 10001,
                  overflow: 'hidden',
                  padding: '4px 0'
                }}>
                  <button
                    onClick={() => { handleZoomOut(); setShowMenu(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '8px 16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#333',
                      fontSize: '14px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ width: 16, height: 16 }}><ZoomOutIcon /></div>
                    <span>Zoom Out</span>
                  </button>
                  <button
                    onClick={() => { handleZoomIn(); setShowMenu(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '8px 16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#333',
                      fontSize: '14px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ width: 16, height: 16 }}><ZoomInIcon /></div>
                    <span>Zoom In</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area (Grid) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'flex-start'
        }}>
          <ThumbnailGrid
            pdfDoc={pdfDoc}
            pages={pages}
            selectedPages={selectedPages}
            onToggleSelection={handleToggleSelection}
            externalDocs={externalDocs}
            scale={zoomLevel}
          />
        </div>

        {/* Bottom Bar */}
        <div style={{
          height: '60px',
          backgroundColor: '#fff',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          boxShadow: '0 -1px 3px rgba(0,0,0,0.05)',
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #e0e0e0',
              backgroundColor: '#f8f9fa',
              color: '#333',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {t('pageManagement.cancel', 'Avbryt')}
          </button>

          <button
            onClick={() => onSave && onSave(pages, externalDocs)}
            style={{
              padding: '8px 24px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#5d5df2',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {t('pageManagement.save', 'Spara')}
          </button>
        </div>
      </div>
    </div >
  );
}

function ToolbarButton({ label, Icon, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        border: 'none',
        backgroundColor: 'transparent',
        color: disabled ? '#ccc' : '#555',
        fontSize: '13px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: '4px',
        transition: 'background-color 0.1s',
        whiteSpace: 'nowrap'
      }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.backgroundColor = '#f0f0f0')}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {Icon && <div style={{ width: 18, height: 18 }}><Icon /></div>}
      <span>{label}</span>
    </button>
  );
}
