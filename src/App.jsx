import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';
import TransparentTextBox from './components/TransparentTextBox';
import WhiteoutBox from './components/WhiteoutBox';
import PatchBox from './components/PatchBox';
import ShapeBox from './components/ShapeBox';
import CommentBox from './components/CommentBox';
import LandingPage from './components/LandingPage';
import ThumbnailSidebar from './components/ThumbnailSidebar';
import FloatingControlBar from './components/FloatingControlBar';
import DownloadModal from './components/DownloadModal';
import PageManagementPanel from './components/PageManagementPanel';
import ToastContainer, { useToast } from './components/ToastNotification';
import LoadingSpinner from './components/LoadingSpinner';
import { exportPDF } from './services/pdfExport';
import { loadPDF } from './services/pdfService';
import { exportAsPDF, exportAsPNG, exportAsJPG, exportAsExcel, exportAsWord, exportAsPPTX } from './services/fileExport';
import { pxToPt, rectPxToPt, rectPtToPx, pointPxToPt, pointPtToPx, isPointNearRectBorder, isPointNearCircleBorder } from './utils/coordMap';
import { MIN_FONT_PT } from './utils/textLayoutConstants';

// Konfigurera PDF.js worker
if (typeof window !== 'undefined') {
  // Använd CDN för PDF.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const { toasts, removeToast, success, error, info, warning } = useToast();
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfData, setPdfData] = useState(null); // Spara original PDF data för export
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfPages, setPdfPages] = useState([]); // Array av alla renderade PDF-sidor
  const [pageViewports, setPageViewports] = useState([]); // Viewports för alla sidor
  // Layout / navigation
  const [pageLayoutMode, setPageLayoutMode] = useState('auto'); // 'single' | 'double' | 'auto'
  const [effectiveLayout, setEffectiveLayout] = useState('single'); // 'single' | 'double' (auto resolves into this)
  const [navMode, setNavMode] = useState('scroll'); // 'scroll' | 'paged'
  const [canScrollCurrentPage, setCanScrollCurrentPage] = useState(false); // for paged mode: show scrollbar only when needed
  const [zoom, setZoom] = useState(1.0);
  const [tool, setTool] = useState(null); // 'text', 'whiteout', 'patch', 'pan', eller null för inget verktyg
  const [patchMode, setPatchMode] = useState('select'); // 'select' eller 'place'
  const [sourceRect, setSourceRect] = useState(null);
  const [sourcePageIndex, setSourcePageIndex] = useState(null); // Vilken sida som är källan för patchen
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Text-inställningar
  const [textSettings, setTextSettings] = useState({
    fontSizePt: 12,
    fontFamily: 'Helvetica',
    color: '#000000',
    fontWeight: 'normal',
    fontStyle: 'normal'
  });
  
  // Lokal state för font size input (tillåter användaren att skriva fritt)
  const [fontSizeInput, setFontSizeInput] = useState('12');
  const fontSizeInputRef = useRef(null);
  
  // Synka fontSizeInput när textSettings.fontSizePt ändras (utom när användaren skriver)
  useEffect(() => {
    // Uppdatera bara om input-fältet inte är fokuserat (för att undvika att störa användaren när de skriver)
    if (fontSizeInputRef.current && document.activeElement !== fontSizeInputRef.current) {
      const currentValue = Math.round(textSettings.fontSizePt);
      setFontSizeInput(String(currentValue));
    }
  }, [textSettings.fontSizePt]);
  
  const [textBoxes, setTextBoxes] = useState([]);
  const [whiteoutBoxes, setWhiteoutBoxes] = useState([]);
  const [patchBoxes, setPatchBoxes] = useState([]);
  const [pendingImageData, setPendingImageData] = useState(null); // data URL för bild som ska placeras
  const [shapeBoxes, setShapeBoxes] = useState([]);
  const [highlightStrokes, setHighlightStrokes] = useState([]); // Frihand-markeringar
  const [commentBoxes, setCommentBoxes] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showWhiteoutColorPalette, setShowWhiteoutColorPalette] = useState(false);
  const [showShapeStrokeColorPalette, setShowShapeStrokeColorPalette] = useState(false);
  const [showShapeFillColorPalette, setShowShapeFillColorPalette] = useState(false);
  const [showShapeTypeDropdown, setShowShapeTypeDropdown] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(200); // Bredd på thumbnail sidebar
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPageManagementPanel, setShowPageManagementPanel] = useState(false);
  
  // Clipboard för kopiera/klistra in
  const [clipboard, setClipboard] = useState(null); // { type: 'text'|'whiteout'|'patch'|'shape', elements: [...], sourcePage: number }
  
  // Whiteout-inställningar
  const [whiteoutColor, setWhiteoutColor] = useState('#FFFFFF');
  
  // Kommentar-inställningar
  const [commentSettings, setCommentSettings] = useState({
    backgroundColor: '#FFEB3B', // Färg för markör och popup-bakgrund
    icon: 'speech-bubble' // Typ av ikon: 'speech-bubble', 'arrow', 'checkmark', 'x', 'star', 'key'
  });
  const [showCommentColorPalette, setShowCommentColorPalette] = useState(false);

  // Highlight-inställningar
  const [highlightSettings, setHighlightSettings] = useState({
    color: '#FFEB3B',
    opacity: 0.35,
    strokeWidth: 12
  });
  const [highlightMode, setHighlightMode] = useState('rect'); // 'rect' | 'freehand'
  const [currentStroke, setCurrentStroke] = useState(null); // För live-frihand
  const [highlightCursor, setHighlightCursor] = useState(null); // { pageNum, x, y }
  const [eraserSettings, setEraserSettings] = useState({
    size: 20
  });
  const [eraserCursor, setEraserCursor] = useState(null); // { pageNum, x, y }
  const [isErasing, setIsErasing] = useState(false);
  const [hasErasedThisDrag, setHasErasedThisDrag] = useState(false);
  const [eraserCursorColor, setEraserCursorColor] = useState('rgba(255,255,255,0.9)');
  const [hoveredTextBoxIndex, setHoveredTextBoxIndex] = useState(null); // För hovring i edit-text-läge
  const [textEditTrigger, setTextEditTrigger] = useState(null); // Triggar redigering av befintlig textruta

  const hexToRgba = (hex, opacity = 1) => {
    if (!hex) return `rgba(255,255,0,${opacity})`;
    const parsed = hex.replace('#', '');
    if (parsed.length !== 6) return `rgba(255,255,0,${opacity})`;
    const r = parseInt(parsed.substring(0, 2), 16);
    const g = parseInt(parsed.substring(2, 4), 16);
    const b = parseInt(parsed.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };
  
  // Form-inställningar
  const [shapeSettings, setShapeSettings] = useState({
    type: 'rectangle', // rectangle, circle, line, arrow, highlight
    strokeColor: '#000000',
    fillColor: 'transparent',
    strokeWidth: 2
  });
  
  // Memoized callback för sidebar width-ändringar
  const handleSidebarWidthChange = useCallback((newWidth) => {
    setSidebarWidth(newWidth);
  }, []);

  // History för undo/redo (måste vara före saveToHistory)
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 50;

  // Refs för att spåra synkronisering och förhindra oändliga loops
  const isResizingRef = useRef(false);
  const isSyncingFromSelectionRef = useRef(false);
  const scrollPositionRef = useRef(0); // Spara scroll-position när tool ändras
  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  const pendingViewerScrollRestoreRef = useRef(null); // { pageNum, offsetInPage, align?: 'keep'|'center' }
  const suppressPageFromScrollRef = useRef(false);

  // Dropdown state (top toolbar)
  const [showPageLayoutMenu, setShowPageLayoutMenu] = useState(false);
  const pageLayoutMenuRef = useRef(null);

  // Spara tillstånd till history (måste vara före useEffect som använder den)
  const saveToHistory = useCallback((newTextBoxes = null, newWhiteoutBoxes = null, newPatchBoxes = null, newShapeBoxes = null, newCommentBoxes = null, newHighlightStrokes = null) => {
    const state = {
      textBoxes: JSON.parse(JSON.stringify(newTextBoxes !== null ? newTextBoxes : textBoxes)),
      whiteoutBoxes: JSON.parse(JSON.stringify(newWhiteoutBoxes !== null ? newWhiteoutBoxes : whiteoutBoxes)),
      patchBoxes: JSON.parse(JSON.stringify(newPatchBoxes !== null ? newPatchBoxes : patchBoxes)),
      shapeBoxes: JSON.parse(JSON.stringify(newShapeBoxes !== null ? newShapeBoxes : shapeBoxes)),
      highlightStrokes: JSON.parse(JSON.stringify(newHighlightStrokes !== null ? newHighlightStrokes : highlightStrokes)),
      commentBoxes: JSON.parse(JSON.stringify(newCommentBoxes !== null ? newCommentBoxes : commentBoxes))
    };
    
    setHistory(prev => {
      // Ta bort alla framtida states om vi är mitt i history
      const newHistory = prev.slice(0, historyIndex + 1);
      // Lägg till ny state
      newHistory.push(state);
      // Begränsa storleken
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => {
      const newIndex = prev + 1;
      return newIndex >= maxHistorySize ? maxHistorySize - 1 : newIndex;
    });
  }, [textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, highlightStrokes, commentBoxes, historyIndex]);

  // Uppdatera textSettings när en textbox är vald (endast när selection eller textBox ändras)
  useEffect(() => {
    // Hoppa över om vi är mitt i en resize-operation eller om vi redan synkar
    if (isResizingRef.current || isSyncingFromSelectionRef.current) return;
    
    if (selectedType === 'text' && selectedElement !== null) {
      const selectedTextBox = textBoxes[selectedElement];
      if (selectedTextBox) {
        // Kontrollera om textSettings faktiskt behöver uppdateras
        // Jämför med nuvarande textSettings för att undvika onödiga updates
        const needsUpdate = 
          Math.round(selectedTextBox.fontSizePt || 12) !== Math.round(textSettings.fontSizePt) ||
          selectedTextBox.fontFamily !== textSettings.fontFamily ||
          selectedTextBox.color !== textSettings.color ||
          selectedTextBox.fontWeight !== textSettings.fontWeight ||
          selectedTextBox.fontStyle !== textSettings.fontStyle;

        if (needsUpdate) {
          isSyncingFromSelectionRef.current = true;
          const newFontSize = Math.round(selectedTextBox.fontSizePt || 12);
          setTextSettings({
            fontSizePt: newFontSize,
            fontFamily: selectedTextBox.fontFamily || 'Helvetica',
            color: selectedTextBox.color || '#000000',
            fontWeight: selectedTextBox.fontWeight || 'normal',
            fontStyle: selectedTextBox.fontStyle || 'normal'
          });
          setFontSizeInput(String(newFontSize)); // Synka input-värdet
          // Återställ flaggan efter state update
          setTimeout(() => {
            isSyncingFromSelectionRef.current = false;
          }, 0);
        }
      }
    }
  }, [selectedElement, selectedType, textBoxes]); // Ta bort textSettings från dependencies - vi synkar bara FRÅN textBox TILL textSettings

  // Uppdatera vald textbox när textSettings ändras (endast från användarinput, inte från selection sync)
  useEffect(() => {
    // Hoppa över om vi är mitt i en resize-operation eller om vi synkar från selection
    if (isResizingRef.current || isSyncingFromSelectionRef.current) return;
    
    if (selectedType === 'text' && selectedElement !== null && textBoxes[selectedElement]) {
      const newBoxes = [...textBoxes];
      const selectedTextBox = newBoxes[selectedElement];
      if (selectedTextBox) {
        // Kontrollera om något faktiskt har ändrats för att undvika oändlig loop
        const hasChanged = 
          Math.round(selectedTextBox.fontSizePt || 12) !== Math.round(textSettings.fontSizePt) ||
          selectedTextBox.fontFamily !== textSettings.fontFamily ||
          selectedTextBox.color !== textSettings.color ||
          selectedTextBox.fontWeight !== textSettings.fontWeight ||
          selectedTextBox.fontStyle !== textSettings.fontStyle;

        if (hasChanged) {
          const sampleRectPx = rectPtToPx(selectedTextBox.originalRect || selectedTextBox.rect, zoom);
          const sampledColor = selectedTextBox.isImported
            ? (sampleRectAverageColor((selectedTextBox.pageIndex ?? (currentPage - 1)) + 1, sampleRectPx) || selectedTextBox.maskColor)
            : selectedTextBox.maskColor;

          newBoxes[selectedElement] = markTextBoxDirty(selectedTextBox, {
            ...selectedTextBox,
            fontSizePt: Math.round(textSettings.fontSizePt),
            fontFamily: textSettings.fontFamily,
            color: textSettings.color,
            fontWeight: textSettings.fontWeight,
            fontStyle: textSettings.fontStyle,
            maskColor: sampledColor
          });
          setTextBoxes(newBoxes);
          // Spara till history när inställningar ändras
          const timer = setTimeout(() => {
            saveToHistory(newBoxes, null, null, null, commentBoxes);
          }, 500); // Debounce för att inte spara för ofta
          return () => clearTimeout(timer);
        }
      }
    }
  }, [textSettings, selectedElement, selectedType, textBoxes, saveToHistory]);

  // Synkning för whiteout-färg - uppdatera whiteoutColor när en whiteout box väljs
  useEffect(() => {
    if (isResizingRef.current) return;
    
    if (selectedType === 'whiteout' && selectedElement !== null) {
      const selectedWhiteoutBox = whiteoutBoxes[selectedElement];
      if (selectedWhiteoutBox) {
        const boxColor = selectedWhiteoutBox.color || '#FFFFFF';
        if (boxColor !== whiteoutColor) {
          setWhiteoutColor(boxColor);
        }
      }
    }
  }, [selectedElement, selectedType, whiteoutBoxes]);

  // Uppdatera vald whiteout box när whiteoutColor ändras
  useEffect(() => {
    if (isResizingRef.current) return;
    
    if (selectedType === 'whiteout' && selectedElement !== null && whiteoutBoxes[selectedElement]) {
      const newBoxes = [...whiteoutBoxes];
      const selectedWhiteoutBox = newBoxes[selectedElement];
      if (selectedWhiteoutBox && selectedWhiteoutBox.color !== whiteoutColor) {
        newBoxes[selectedElement] = {
          ...selectedWhiteoutBox,
          color: whiteoutColor
        };
        setWhiteoutBoxes(newBoxes);
        // Spara till history när färgen ändras
        const timer = setTimeout(() => {
          saveToHistory(null, newBoxes, null, null, commentBoxes);
        }, 500); // Debounce
        return () => clearTimeout(timer);
      }
    }
  }, [whiteoutColor, selectedElement, selectedType, whiteoutBoxes, saveToHistory]);

  // Synkning för shape-inställningar - uppdatera shapeSettings när en shape väljs
  useEffect(() => {
    if (isResizingRef.current || isSyncingFromSelectionRef.current) return;
    
    if (selectedType === 'shape' && selectedElement !== null) {
      const selectedShapeBox = shapeBoxes[selectedElement];
      if (selectedShapeBox) {
        const needsUpdate = 
          selectedShapeBox.type !== shapeSettings.type ||
          (selectedShapeBox.strokeColor || '#000000') !== shapeSettings.strokeColor ||
          (selectedShapeBox.fillColor || 'transparent') !== shapeSettings.fillColor ||
          (selectedShapeBox.strokeWidth || 2) !== shapeSettings.strokeWidth;

        if (needsUpdate) {
          isSyncingFromSelectionRef.current = true;
          setShapeSettings({
            type: selectedShapeBox.type || 'rectangle',
            strokeColor: selectedShapeBox.strokeColor || '#000000',
            fillColor: selectedShapeBox.fillColor || 'transparent',
            strokeWidth: selectedShapeBox.strokeWidth || 2
          });
          setTimeout(() => {
            isSyncingFromSelectionRef.current = false;
          }, 0);
        }
      }
    }
  }, [selectedElement, selectedType, shapeBoxes]);

  // Uppdatera vald shape när shapeSettings ändras
  useEffect(() => {
    if (isResizingRef.current || isSyncingFromSelectionRef.current) return;
    
    if (selectedType === 'shape' && selectedElement !== null && shapeBoxes[selectedElement]) {
      const newBoxes = [...shapeBoxes];
      const selectedShapeBox = newBoxes[selectedElement];
      if (selectedShapeBox) {
        const hasChanged = 
          selectedShapeBox.strokeColor !== shapeSettings.strokeColor ||
          selectedShapeBox.fillColor !== shapeSettings.fillColor ||
          selectedShapeBox.strokeWidth !== shapeSettings.strokeWidth;

        if (hasChanged) {
          newBoxes[selectedElement] = {
            ...selectedShapeBox,
            strokeColor: shapeSettings.strokeColor,
            fillColor: shapeSettings.fillColor,
            strokeWidth: shapeSettings.strokeWidth
          };
          setShapeBoxes(newBoxes);
          // Spara till history när inställningar ändras
          const timer = setTimeout(() => {
            saveToHistory(null, null, null, newBoxes, commentBoxes);
          }, 500); // Debounce
          return () => clearTimeout(timer);
        }
      }
    }
  }, [shapeSettings, selectedElement, selectedType, shapeBoxes, saveToHistory]);

  // Rensa hover/trigger när vi lämnar edit-text-läget
  useEffect(() => {
    if (tool !== 'edit-text') {
      setHoveredTextBoxIndex(null);
      setTextEditTrigger(null);
    }
  }, [tool]);

  // Hjälp: samp­la medelvärde av pixlar i ett rect på en page-canvas (px)
  const sampleRectAverageColor = useCallback((pageNum, rectPx) => {
    const canvas = canvasRefs.current?.[pageNum];
    if (!canvas || !rectPx) return null;
    const ctx = canvas.getContext('2d');
    const x = Math.max(0, Math.floor(rectPx.x));
    const y = Math.max(0, Math.floor(rectPx.y));
    const w = Math.max(1, Math.floor(rectPx.width));
    const h = Math.max(1, Math.floor(rectPx.height));
    const img = ctx.getImageData(x, y, Math.min(w, canvas.width - x), Math.min(h, canvas.height - y));
    const data = img.data;
    let r = 0, g = 0, b = 0, c = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; c++;
    }
    if (!c) return null;
    return `rgba(${Math.round(r / c)}, ${Math.round(g / c)}, ${Math.round(b / c)}, 1)`;
  }, []);

  // Hjälpare: markera textruta som "dirty" om något har ändrats (text/stil/rect/rotation)
  const markTextBoxDirty = useCallback((prev = {}, updated = {}) => {
    const rectChanged = prev.rect && updated.rect
      ? prev.rect.x !== updated.rect.x ||
        prev.rect.y !== updated.rect.y ||
        prev.rect.width !== updated.rect.width ||
        prev.rect.height !== updated.rect.height
      : false;

    const changed = 
      (prev.text || '') !== (updated.text || '') ||
      (prev.fontSizePt || 0) !== (updated.fontSizePt || 0) ||
      (prev.fontFamily || '') !== (updated.fontFamily || '') ||
      (prev.color || '') !== (updated.color || '') ||
      (prev.fontWeight || '') !== (updated.fontWeight || '') ||
      (prev.fontStyle || '') !== (updated.fontStyle || '') ||
      (prev.rotation || 0) !== (updated.rotation || 0) ||
      rectChanged;

    const rectForSample = prev.originalRect || updated.originalRect || updated.rect || prev.rect;
    const maskColor = prev.maskColor || updated.maskColor;

    return {
      ...updated,
      isImported: prev.isImported ?? updated.isImported,
      originalRect: prev.originalRect || updated.originalRect,
      isDirty: changed ? true : (prev.isDirty || updated.isDirty || false),
      maskColor: maskColor,
      rectForSample // passthrough (not stored), could be used upstream if needed
    };
  }, []);

  // Importera befintlig PDF-text till textBoxes (best effort, per text-item)
  const importExistingPdfText = useCallback(async (doc) => {
    if (!doc) return [];

    const imported = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      try {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();

        for (const item of textContent.items) {
          const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const x = transform[4];
          const y = transform[5];
          const fontHeightPx = Math.abs(transform[3]) || Math.abs(item.height || 0) * viewport.scale || 12;
          const widthPx = (item.width || 0) * viewport.scale;
          const heightPx = fontHeightPx || 12;

          if (!item.str || widthPx <= 0 || heightPx <= 0) continue;

          // Justera nedåt lite för att bättre matcha PDF-glyphernas baseline i canvas
          const baselineAdjustPx = heightPx * 0.18;
          const rectPx = {
            x,
            y: y - heightPx + baselineAdjustPx,
            width: widthPx,
            height: heightPx
          };

          const rectPt = rectPxToPt(rectPx, 1); // scale 1 => px≈pt
          const fontSizePt = Math.max(MIN_FONT_PT, Math.round(fontHeightPx));

          imported.push({
            rect: rectPt,
            originalRect: rectPt,
            text: item.str,
            fontSizePt,
            fontFamily: 'Helvetica',
            color: '#000000',
            fontWeight: 'normal',
            fontStyle: 'normal',
            rotation: 0,
            pageIndex: pageNum - 1,
            isImported: true,
            isDirty: false
          });
        }
      } catch (err) {
        console.warn(`Kunde inte importera text från sida ${pageNum}:`, err);
      }
    }

    return imported;
  }, []);
  
  const canvasRefs = useRef({}); // Objekt med pageNum som nyckel och canvas-ref som värde
  const containerRef = useRef(null);
  const pageContainerRefs = useRef({}); // Refs för page containers för scroll-tracking
  const renderTasksRef = useRef({}); // Spara render tasks för att kunna avbryta dem
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [drawingPage, setDrawingPage] = useState(null); // Vilken sida som ritas på
  
  // State för drag och resize
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false); // Spårar om musknappen är nedtryckt
  const [dragStart, setDragStart] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [rotationStart, setRotationStart] = useState(null); // {x, y} för rotation-start
  const [initialRotation, setInitialRotation] = useState(0); // Initial rotation-vinkel
  const [originalRect, setOriginalRect] = useState(null);
  const [originalFontSize, setOriginalFontSize] = useState(null); // Spara original fontstorlek vid resize
  
  // State för endpoint-dragning (linjer/pilar)
  const [isDraggingEndpoint, setIsDraggingEndpoint] = useState(false);
  const [draggingEndpointType, setDraggingEndpointType] = useState(null); // 'start' eller 'end'
  const [originalStartPoint, setOriginalStartPoint] = useState(null);
  const [originalEndPoint, setOriginalEndPoint] = useState(null);
  
  // State för punkt-till-punkt ritning (linjer/pilar)
  const [lineStartPoint, setLineStartPoint] = useState(null); // {x, y} i px
  const [lineEndPoint, setLineEndPoint] = useState(null); // {x, y} i px

  // Ångra (Undo)
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setTextBoxes(JSON.parse(JSON.stringify(state.textBoxes)));
      setWhiteoutBoxes(JSON.parse(JSON.stringify(state.whiteoutBoxes)));
      setPatchBoxes(JSON.parse(JSON.stringify(state.patchBoxes)));
      setShapeBoxes(JSON.parse(JSON.stringify(state.shapeBoxes || [])));
      setHighlightStrokes(JSON.parse(JSON.stringify(state.highlightStrokes || [])));
      setCommentBoxes(JSON.parse(JSON.stringify(state.commentBoxes || [])));
      setHistoryIndex(newIndex);
      setSelectedElement(null);
      setSelectedType(null);
    }
  };

  // Gör om (Redo)
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setTextBoxes(JSON.parse(JSON.stringify(state.textBoxes)));
      setWhiteoutBoxes(JSON.parse(JSON.stringify(state.whiteoutBoxes)));
      setPatchBoxes(JSON.parse(JSON.stringify(state.patchBoxes)));
      setShapeBoxes(JSON.parse(JSON.stringify(state.shapeBoxes || [])));
      setHighlightStrokes(JSON.parse(JSON.stringify(state.highlightStrokes || [])));
      setCommentBoxes(JSON.parse(JSON.stringify(state.commentBoxes || [])));
      setHistoryIndex(newIndex);
      setSelectedElement(null);
      setSelectedType(null);
    }
  };

  // Ladda PDF när komponenten monteras
  useEffect(() => {
    // Exempel: ladda en PDF (användaren kan ladda sin egen)
    // loadPDFFile();
  }, []);

  // Initiera history när PDF laddas
  useEffect(() => {
    if (pdfDoc) {
      const initialState = {
        textBoxes: JSON.parse(JSON.stringify(textBoxes)),
        whiteoutBoxes: JSON.parse(JSON.stringify(whiteoutBoxes)),
        patchBoxes: JSON.parse(JSON.stringify(patchBoxes)),
        shapeBoxes: JSON.parse(JSON.stringify(shapeBoxes)),
        highlightStrokes: JSON.parse(JSON.stringify(highlightStrokes)),
        commentBoxes: JSON.parse(JSON.stringify(commentBoxes))
      };
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  }, [pdfDoc]);

  // HandleDelete funktion - måste vara efter saveToHistory
  const handleDelete = useCallback(() => {
    if (selectedElement === null || !selectedType) return;

    if (selectedType === 'text') {
      const newBoxes = textBoxes.filter((_, i) => i !== selectedElement);
      setTextBoxes(newBoxes);
      saveToHistory(newBoxes, null, null, null, null);
    } else if (selectedType === 'whiteout') {
      const newBoxes = whiteoutBoxes.filter((_, i) => i !== selectedElement);
      setWhiteoutBoxes(newBoxes);
      saveToHistory(null, newBoxes, null, null, null);
    } else if (selectedType === 'patch') {
      const newBoxes = patchBoxes.filter((_, i) => i !== selectedElement);
      setPatchBoxes(newBoxes);
      saveToHistory(null, null, newBoxes, null, null);
    } else if (selectedType === 'shape') {
      const newBoxes = shapeBoxes.filter((_, i) => i !== selectedElement);
      setShapeBoxes(newBoxes);
      saveToHistory(null, null, null, newBoxes, null);
    } else if (selectedType === 'comment') {
      const newBoxes = commentBoxes.filter((_, i) => i !== selectedElement);
      setCommentBoxes(newBoxes);
      saveToHistory(null, null, null, null, newBoxes);
    }

    setSelectedElement(null);
    setSelectedType(null);
  }, [selectedElement, selectedType, textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, commentBoxes, saveToHistory]);

  // Avaktivera comment-verktyget när redigering avslutas
  const handleCommentEditEnd = useCallback(() => {
    // Använd setTimeout för att säkerställa att detta körs efter eventuella klick-händelser
    setTimeout(() => {
      setTool(null);
      setSelectedElement(null);
      setSelectedType(null);
    }, 0);
  }, []);

  // Kopiera valda element
  const handleCopy = useCallback(() => {
    if (selectedElement === null || selectedType === null) {
      return; // Inget valt att kopiera
    }

    let elementsToCopy = [];
    let sourcePage = currentPage - 1;

    if (selectedType === 'text' && textBoxes[selectedElement]) {
      const element = textBoxes[selectedElement];
      // Kopiera elementet med alla dess properties
      elementsToCopy = [JSON.parse(JSON.stringify(element))];
      sourcePage = element.pageIndex !== undefined ? element.pageIndex : currentPage - 1;
    } else if (selectedType === 'whiteout' && whiteoutBoxes[selectedElement]) {
      const element = whiteoutBoxes[selectedElement];
      elementsToCopy = [JSON.parse(JSON.stringify(element))];
      sourcePage = element.pageIndex !== undefined ? element.pageIndex : currentPage - 1;
    } else if (selectedType === 'patch' && patchBoxes[selectedElement]) {
      const element = patchBoxes[selectedElement];
      elementsToCopy = [JSON.parse(JSON.stringify(element))];
      sourcePage = element.pageIndex !== undefined ? element.pageIndex : currentPage - 1;
    } else if (selectedType === 'shape' && shapeBoxes[selectedElement]) {
      const element = shapeBoxes[selectedElement];
      elementsToCopy = [JSON.parse(JSON.stringify(element))];
      sourcePage = element.pageIndex !== undefined ? element.pageIndex : currentPage - 1;
    }

    if (elementsToCopy.length > 0) {
      setClipboard({
        type: selectedType,
        elements: elementsToCopy,
        sourcePage: sourcePage
      });
      info(t('success.copied', 'Element kopierat'));
    }
  }, [selectedElement, selectedType, textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, currentPage, t]);

  // Klistra in element
  const handlePaste = useCallback(() => {
    if (!clipboard || !clipboard.elements || clipboard.elements.length === 0) {
      return; // Inget att klistra in
    }

    const targetPage = currentPage - 1;
    const offsetX = 20; // Offset i pt för att placera kopierade element lite åt höger
    const offsetY = 20; // Offset i pt för att placera kopierade element lite nedåt

    if (clipboard.type === 'text') {
      const newTextBoxes = clipboard.elements.map(element => {
        const newElement = JSON.parse(JSON.stringify(element));
        // Uppdatera position med offset
        newElement.rect = {
          ...newElement.rect,
          x: newElement.rect.x + offsetX,
          y: newElement.rect.y + offsetY
        };
        // Uppdatera pageIndex till nuvarande sida
        newElement.pageIndex = targetPage;
        // Ta bort isNew-flaggan
        delete newElement.isNew;
        delete newElement.isImported;
        newElement.isDirty = true;
        return newElement;
      });
      const updatedTextBoxes = [...textBoxes, ...newTextBoxes];
      setTextBoxes(updatedTextBoxes);
      // Välj det första klistrade elementet
      if (newTextBoxes.length > 0) {
        setSelectedElement(textBoxes.length);
        setSelectedType('text');
      }
      saveToHistory(updatedTextBoxes, null, null, null, commentBoxes);
      success(t('success.pasted', { count: newTextBoxes.length }, `${newTextBoxes.length} element klistrade in`));
    } else if (clipboard.type === 'whiteout') {
      const newWhiteoutBoxes = clipboard.elements.map(element => {
        const newElement = JSON.parse(JSON.stringify(element));
        newElement.rect = {
          ...newElement.rect,
          x: newElement.rect.x + offsetX,
          y: newElement.rect.y + offsetY
        };
        newElement.pageIndex = targetPage;
        return newElement;
      });
      const updatedWhiteoutBoxes = [...whiteoutBoxes, ...newWhiteoutBoxes];
      setWhiteoutBoxes(updatedWhiteoutBoxes);
      if (newWhiteoutBoxes.length > 0) {
        setSelectedElement(whiteoutBoxes.length);
        setSelectedType('whiteout');
      }
      saveToHistory(null, updatedWhiteoutBoxes, null, null, commentBoxes);
      success(t('success.pasted', { count: newWhiteoutBoxes.length }, `${newWhiteoutBoxes.length} element klistrade in`));
    } else if (clipboard.type === 'patch') {
      const newPatchBoxes = clipboard.elements.map(element => {
        const newElement = JSON.parse(JSON.stringify(element));
        // Uppdatera både sourceRect och targetRect med offset
        if (newElement.sourceRect) {
          newElement.sourceRect = {
            ...newElement.sourceRect,
            x: newElement.sourceRect.x + offsetX,
            y: newElement.sourceRect.y + offsetY
          };
        }
        if (newElement.targetRect) {
          newElement.targetRect = {
            ...newElement.targetRect,
            x: newElement.targetRect.x + offsetX,
            y: newElement.targetRect.y + offsetY
          };
        }
        newElement.pageIndex = targetPage;
        // Uppdatera sourcePageIndex om det finns
        if (newElement.sourcePageIndex !== undefined) {
          newElement.sourcePageIndex = clipboard.sourcePage;
        }
        return newElement;
      });
      const updatedPatchBoxes = [...patchBoxes, ...newPatchBoxes];
      setPatchBoxes(updatedPatchBoxes);
      if (newPatchBoxes.length > 0) {
        setSelectedElement(patchBoxes.length);
        setSelectedType('patch');
      }
      saveToHistory(null, null, updatedPatchBoxes, null, commentBoxes);
      success(t('success.pasted', { count: newPatchBoxes.length }, `${newPatchBoxes.length} element klistrade in`));
    } else if (clipboard.type === 'shape') {
      const newShapeBoxes = clipboard.elements.map(element => {
        const newElement = JSON.parse(JSON.stringify(element));
        // För linjer/pilar: uppdatera startPoint och endPoint
        if (element.startPoint && element.endPoint) {
          newElement.startPoint = {
            x: element.startPoint.x + offsetX,
            y: element.startPoint.y + offsetY
          };
          newElement.endPoint = {
            x: element.endPoint.x + offsetX,
            y: element.endPoint.y + offsetY
          };
        } else if (element.rect) {
          // För rektanglar/cirklar: uppdatera rect
          newElement.rect = {
            ...element.rect,
            x: element.rect.x + offsetX,
            y: element.rect.y + offsetY
          };
        }
        newElement.pageIndex = targetPage;
        return newElement;
      });
      const updatedShapeBoxes = [...shapeBoxes, ...newShapeBoxes];
      setShapeBoxes(updatedShapeBoxes);
      if (newShapeBoxes.length > 0) {
        setSelectedElement(shapeBoxes.length);
        setSelectedType('shape');
      }
      saveToHistory(null, null, null, updatedShapeBoxes, commentBoxes);
      success(t('success.pasted', { count: newShapeBoxes.length }, `${newShapeBoxes.length} element klistrade in`));
    }
  }, [clipboard, currentPage, textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, commentBoxes, saveToHistory, t, success]);

  // Duplicera valda element
  const handleDuplicate = useCallback(() => {
    if (selectedElement === null || selectedType === null) {
      return; // Inget valt att duplicera
    }

    // Kopiera elementet direkt (samma logik som handleCopy men utan att använda clipboard state)
    let elementsToCopy = [];
    let sourcePage = currentPage - 1;

    if (selectedType === 'text' && textBoxes[selectedElement]) {
      const element = textBoxes[selectedElement];
      elementsToCopy = [JSON.parse(JSON.stringify(element))];
      sourcePage = element.pageIndex !== undefined ? element.pageIndex : currentPage - 1;
    } else if (selectedType === 'whiteout' && whiteoutBoxes[selectedElement]) {
      const element = whiteoutBoxes[selectedElement];
      elementsToCopy = [JSON.parse(JSON.stringify(element))];
      sourcePage = element.pageIndex !== undefined ? element.pageIndex : currentPage - 1;
    } else if (selectedType === 'patch' && patchBoxes[selectedElement]) {
      const element = patchBoxes[selectedElement];
      elementsToCopy = [JSON.parse(JSON.stringify(element))];
      sourcePage = element.pageIndex !== undefined ? element.pageIndex : currentPage - 1;
    } else if (selectedType === 'shape' && shapeBoxes[selectedElement]) {
      const element = shapeBoxes[selectedElement];
      elementsToCopy = [JSON.parse(JSON.stringify(element))];
      sourcePage = element.pageIndex !== undefined ? element.pageIndex : currentPage - 1;
    }

    if (elementsToCopy.length === 0) {
      return;
    }

    // Klistra in direkt med samma logik som handlePaste
    const targetPage = currentPage - 1;
    const offsetX = 20; // Offset i pt för att placera kopierade element lite åt höger
    const offsetY = 20; // Offset i pt för att placera kopierade element lite nedåt

    const clipboardData = {
      type: selectedType,
      elements: elementsToCopy,
      sourcePage: sourcePage
    };

    if (clipboardData.type === 'text') {
      const newTextBoxes = clipboardData.elements.map(element => {
        const newElement = JSON.parse(JSON.stringify(element));
        newElement.rect = {
          ...newElement.rect,
          x: newElement.rect.x + offsetX,
          y: newElement.rect.y + offsetY
        };
        if (newElement.originalRect) {
          newElement.originalRect = {
            ...newElement.originalRect,
            x: newElement.originalRect.x + offsetX,
            y: newElement.originalRect.y + offsetY
          };
        }
        newElement.pageIndex = targetPage;
        delete newElement.isNew;
        delete newElement.isImported;
        newElement.isDirty = true;
        return newElement;
      });
      const updatedTextBoxes = [...textBoxes, ...newTextBoxes];
      setTextBoxes(updatedTextBoxes);
      if (newTextBoxes.length > 0) {
        setSelectedElement(textBoxes.length);
        setSelectedType('text');
      }
      saveToHistory(updatedTextBoxes, null, null, null, commentBoxes);
      success(t('success.pasted', { count: newTextBoxes.length }, `${newTextBoxes.length} element klistrade in`));
    } else if (clipboardData.type === 'whiteout') {
      const newWhiteoutBoxes = clipboardData.elements.map(element => {
        const newElement = JSON.parse(JSON.stringify(element));
        newElement.rect = {
          ...newElement.rect,
          x: newElement.rect.x + offsetX,
          y: newElement.rect.y + offsetY
        };
        newElement.pageIndex = targetPage;
        return newElement;
      });
      const updatedWhiteoutBoxes = [...whiteoutBoxes, ...newWhiteoutBoxes];
      setWhiteoutBoxes(updatedWhiteoutBoxes);
      if (newWhiteoutBoxes.length > 0) {
        setSelectedElement(whiteoutBoxes.length);
        setSelectedType('whiteout');
      }
      saveToHistory(null, updatedWhiteoutBoxes, null, null, commentBoxes);
      success(t('success.pasted', { count: newWhiteoutBoxes.length }, `${newWhiteoutBoxes.length} element klistrade in`));
    } else if (clipboardData.type === 'patch') {
      const newPatchBoxes = clipboardData.elements.map(element => {
        const newElement = JSON.parse(JSON.stringify(element));
        if (newElement.sourceRect) {
          newElement.sourceRect = {
            ...newElement.sourceRect,
            x: newElement.sourceRect.x + offsetX,
            y: newElement.sourceRect.y + offsetY
          };
        }
        if (newElement.targetRect) {
          newElement.targetRect = {
            ...newElement.targetRect,
            x: newElement.targetRect.x + offsetX,
            y: newElement.targetRect.y + offsetY
          };
        }
        newElement.pageIndex = targetPage;
        if (newElement.sourcePageIndex !== undefined) {
          newElement.sourcePageIndex = clipboardData.sourcePage;
        }
        return newElement;
      });
      const updatedPatchBoxes = [...patchBoxes, ...newPatchBoxes];
      setPatchBoxes(updatedPatchBoxes);
      if (newPatchBoxes.length > 0) {
        setSelectedElement(patchBoxes.length);
        setSelectedType('patch');
      }
      saveToHistory(null, null, updatedPatchBoxes, null, commentBoxes);
      success(t('success.pasted', { count: newPatchBoxes.length }, `${newPatchBoxes.length} element klistrade in`));
    } else if (clipboardData.type === 'shape') {
      const newShapeBoxes = clipboardData.elements.map(element => {
        const newElement = JSON.parse(JSON.stringify(element));
        if (element.startPoint && element.endPoint) {
          newElement.startPoint = {
            x: element.startPoint.x + offsetX,
            y: element.startPoint.y + offsetY
          };
          newElement.endPoint = {
            x: element.endPoint.x + offsetX,
            y: element.endPoint.y + offsetY
          };
        } else if (element.rect) {
          newElement.rect = {
            ...element.rect,
            x: element.rect.x + offsetX,
            y: element.rect.y + offsetY
          };
        }
        newElement.pageIndex = targetPage;
        return newElement;
      });
      const updatedShapeBoxes = [...shapeBoxes, ...newShapeBoxes];
      setShapeBoxes(updatedShapeBoxes);
      if (newShapeBoxes.length > 0) {
        setSelectedElement(shapeBoxes.length);
        setSelectedType('shape');
      }
      saveToHistory(null, null, null, updatedShapeBoxes, commentBoxes);
      success(t('success.pasted', { count: newShapeBoxes.length }, `${newShapeBoxes.length} element klistrade in`));
    }
  }, [selectedElement, selectedType, textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, commentBoxes, currentPage, saveToHistory, t, success]);

  // Stäng färgpaletten när man klickar utanför
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showColorPalette && !e.target.closest('[data-color-picker]')) {
        setShowColorPalette(false);
      }
      if (showWhiteoutColorPalette && !e.target.closest('[data-whiteout-color-picker]')) {
        setShowWhiteoutColorPalette(false);
      }
      if (showShapeStrokeColorPalette && !e.target.closest('[data-shape-stroke-color-picker]')) {
        setShowShapeStrokeColorPalette(false);
      }
      if (showShapeFillColorPalette && !e.target.closest('[data-shape-fill-color-picker]')) {
        setShowShapeFillColorPalette(false);
      }
      if (showShapeTypeDropdown && !e.target.closest('[data-shape-type-dropdown]')) {
        setShowShapeTypeDropdown(false);
      }
      if (showCommentColorPalette && !e.target.closest('[data-comment-color-picker]')) {
        setShowCommentColorPalette(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPalette, showWhiteoutColorPalette, showShapeStrokeColorPalette, showShapeFillColorPalette, showShapeTypeDropdown, showCommentColorPalette]);

  // Stäng shape-type dropdown när shape-verktyget stängs
  useEffect(() => {
    if (!(tool && tool.startsWith('shape'))) {
      setShowShapeTypeDropdown(false);
    }
  }, [tool]);

  // Keyboard shortcuts för undo/redo och delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Delete-tangent för att ta bort valt element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Kontrollera att vi inte är i ett input-fält
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
          return; // Låt input-fält hantera backspace/delete själva
        }
        
        if (selectedElement !== null && selectedType) {
          e.preventDefault();
          // Visa bekräftelsedialog
          const confirmMessage = selectedType === 'text' 
            ? 'Vill du ta bort denna textruta?'
            : selectedType === 'whiteout'
            ? 'Vill du ta bort denna whiteout-ruta?'
            : selectedType === 'shape'
            ? 'Vill du ta bort denna form?'
            : 'Vill du ta bort detta kopierade område?';
          
          if (window.confirm(confirmMessage)) {
            handleDelete();
          }
          return;
        }
      }
      
      // Copy shortcut (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
        // Kontrollera att vi inte är i ett input-fält
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
          return; // Låt input-fält hantera copy själva
        }
        e.preventDefault();
        handleCopy();
        return;
      }
      
      // Paste shortcut (Ctrl+V / Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey) {
        // Kontrollera att vi inte är i ett input-fält
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
          return; // Låt input-fält hantera paste själva
        }
        e.preventDefault();
        handlePaste();
        return;
      }
      
      // Duplicate shortcut (Ctrl+D / Cmd+D)
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.shiftKey) {
        // Kontrollera att vi inte är i ett input-fält
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
          return; // Låt input-fält hantera duplicate själva
        }
        e.preventDefault();
        handleDuplicate();
        return;
      }
      
      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          const state = history[newIndex];
          setTextBoxes(JSON.parse(JSON.stringify(state.textBoxes)));
          setWhiteoutBoxes(JSON.parse(JSON.stringify(state.whiteoutBoxes)));
          setPatchBoxes(JSON.parse(JSON.stringify(state.patchBoxes)));
          setShapeBoxes(JSON.parse(JSON.stringify(state.shapeBoxes || [])));
          setHistoryIndex(newIndex);
          setSelectedElement(null);
          setSelectedType(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          const state = history[newIndex];
          setTextBoxes(JSON.parse(JSON.stringify(state.textBoxes)));
          setWhiteoutBoxes(JSON.parse(JSON.stringify(state.whiteoutBoxes)));
          setPatchBoxes(JSON.parse(JSON.stringify(state.patchBoxes)));
          setShapeBoxes(JSON.parse(JSON.stringify(state.shapeBoxes || [])));
          setHistoryIndex(newIndex);
          setSelectedElement(null);
          setSelectedType(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, selectedElement, selectedType, handleDelete, handleCopy, handlePaste, handleDuplicate]);

  // Behåll scroll-position när tool ändras (för att PDF-canvas inte ska hoppa)
  useEffect(() => {
    // Spara nuvarande scroll-position innan tool ändras
    const currentScrollTop = containerRef.current?.scrollTop || 0;
    scrollPositionRef.current = currentScrollTop;
    
    // Återställ scroll-position efter att tool har ändrats och DOM har uppdaterats
    // Använd requestAnimationFrame för att säkerställa att DOM är uppdaterad
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (containerRef.current && scrollPositionRef.current !== undefined) {
          containerRef.current.scrollTop = scrollPositionRef.current;
        }
      }, 0);
    });
  }, [tool]);

  // Rendera alla PDF-sidor
  useEffect(() => {
    if (!pdfDoc) {
      setPdfPages([]);
      setPageViewports([]);
      // Avbryt alla pågående render-tasks
      Object.values(renderTasksRef.current).forEach(task => {
        if (task && task.cancel) {
          task.cancel();
        }
      });
      renderTasksRef.current = {};
      return;
    }

    let isCancelled = false; // Flagga för att förhindra uppdateringar efter cleanup

    const renderAllPages = async () => {
      const pages = [];
      const viewports = [];

      // Avbryt alla tidigare render-tasks först
      Object.values(renderTasksRef.current).forEach(task => {
        if (task && task.cancel) {
          task.cancel();
        }
      });
      renderTasksRef.current = {};

      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const layoutViewport = page.getViewport({ scale: zoom }); // används för mått/scroll
          const renderViewport = page.getViewport({ scale: zoom * dpr }); // används för skarp canvas
          
          pages.push(page);
          viewports.push(layoutViewport);
          
          // Rendera sidan när canvas är redo
          setTimeout(() => {
            if (isCancelled) return; // Hoppa över om komponenten är unmountad eller cleanup har körts
            
            const canvas = canvasRefs.current[pageNum];
            if (canvas) {
              // Avbryt tidigare render-task för denna sida om den finns
              if (renderTasksRef.current[pageNum] && renderTasksRef.current[pageNum].cancel) {
                renderTasksRef.current[pageNum].cancel();
              }
              
              const context = canvas.getContext('2d');
              canvas.height = renderViewport.height;
              canvas.width = renderViewport.width;
              canvas.style.height = `${layoutViewport.height}px`;
              canvas.style.width = `${layoutViewport.width}px`;
              
              context.clearRect(0, 0, canvas.width, canvas.height);
              
              // Starta ny render-operation och spara task
              const renderTask = page.render({
                canvasContext: context,
                viewport: renderViewport
              });
              
              renderTasksRef.current[pageNum] = renderTask;
              
              renderTask.promise.then(() => {
                if (!isCancelled) {
                  console.log(`Page ${pageNum} rendered`);
                }
                // Ta bort task från ref när den är klar
                if (renderTasksRef.current[pageNum] === renderTask) {
                  delete renderTasksRef.current[pageNum];
                }
              }).catch(err => {
                // Ignorera "cancelled" errors
                if (err.name !== 'RenderingCancelledException' && !isCancelled) {
                  console.error(`Error rendering page ${pageNum}:`, err);
                }
                // Ta bort task från ref även vid fel
                if (renderTasksRef.current[pageNum] === renderTask) {
                  delete renderTasksRef.current[pageNum];
                }
              });
            }
          }, 50 * pageNum); // Liten delay mellan sidor för att undvika blocking
        } catch (error) {
          if (!isCancelled) {
            console.error(`Fel vid laddning av sida ${pageNum}:`, error);
          }
        }
      }

      if (!isCancelled) {
        setPdfPages(pages);
        setPageViewports(viewports);
      }
    };

    renderAllPages();
    
    // Cleanup: avbryt alla render-tasks när komponenten unmountas eller dependencies ändras
    return () => {
      isCancelled = true; // Sätt flaggan när komponenten unmountas
      Object.values(renderTasksRef.current).forEach(task => {
        if (task && task.cancel) {
          task.cancel();
        }
      });
      renderTasksRef.current = {};
    };
  }, [pdfDoc, zoom]);

  // Auto-layout resolution (auto => single/double based on available width)
  useEffect(() => {
    if (pageLayoutMode !== 'auto') {
      setEffectiveLayout(pageLayoutMode);
      return;
    }

    const compute = () => {
      const container = containerRef.current;
      if (!container) return;

      const maxPageW = Math.max(0, ...pageViewports.map(v => v?.width || 0));
      const availableW = (container.clientWidth || 0) - 40; // approx inner padding
      const gap = 20;
      const fitsTwo = maxPageW > 0 && availableW >= (maxPageW * 2 + gap);
      setEffectiveLayout(fitsTwo ? 'double' : 'single');
    };

    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [pageLayoutMode, pageViewports, sidebarWidth, zoom]);

  // In "paged" mode: determine whether the current page actually needs vertical scrolling.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const pageEl = pageContainerRefs.current?.[currentPageRef.current || currentPage];
      if (!pageEl) {
        setCanScrollCurrentPage(false);
        return;
      }
      // Allow a tiny slack for sub-pixel rounding
      setCanScrollCurrentPage(pageEl.offsetHeight > container.clientHeight + 1);
    };

    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [currentPage, zoom, effectiveLayout, navMode, pdfPages.length]);

  // Update currentPage based on scroll position (DOM-based; works for single + double layouts)
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    const container = containerRef.current;
    let rafId = null;

    const update = () => {
      rafId = null;
      // During PDF reload/restore, don't let scroll-position logic override the intended page.
      if (suppressPageFromScrollRef.current || pendingViewerScrollRestoreRef.current) return;
      const centerY = container.scrollTop + container.clientHeight / 2;
      let bestPage = currentPageRef.current || 1;
      let bestDist = Infinity;

      for (let p = 1; p <= pdfDoc.numPages; p++) {
        const el = pageContainerRefs.current[p];
        if (!el) continue;
        const pageCenterY = el.offsetTop + el.offsetHeight / 2;
        const dist = Math.abs(pageCenterY - centerY);
        if (dist < bestDist) {
          bestDist = dist;
          bestPage = p;
        }
      }

      if (bestPage !== currentPageRef.current) {
        setCurrentPage(bestPage);
      }
    };

    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(update);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      container.removeEventListener('scroll', onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [pdfDoc, pdfPages.length, effectiveLayout, zoom]);

  // After PDF reload operations (rotate/delete/add), restore scroll position within the same page (if requested).
  useEffect(() => {
    let cancelled = false;

    const tryRestore = (attempt = 0) => {
      if (cancelled) return;
      const pending = pendingViewerScrollRestoreRef.current;
      if (!pending) return;

      const container = containerRef.current;
      const pageEl = pageContainerRefs.current?.[pending.pageNum];
      const canvasEl = canvasRefs.current?.[pending.pageNum];
      const canvasStyleH = canvasEl?.style?.height ? parseFloat(canvasEl.style.height) : NaN;
      const canvasReady = Number.isFinite(canvasStyleH) && canvasStyleH > 0;

      if (container && pageEl && canvasEl && canvasReady) {
        suppressPageFromScrollRef.current = true;
        const align = pending.align || 'keep';
        let targetTop = pageEl.offsetTop + (pending.offsetInPage || 0);
        if (align === 'center') {
          const containerRect = container.getBoundingClientRect();
          targetTop = pageEl.offsetTop - containerRect.height / 2 + pageEl.offsetHeight / 2;
        }
        container.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' });
        // Ensure currentPage matches the restored page
        if (currentPageRef.current !== pending.pageNum) {
          currentPageRef.current = pending.pageNum;
          setCurrentPage(pending.pageNum);
        }
        pendingViewerScrollRestoreRef.current = null;
        // Release suppression on next frame after scroll settles
        requestAnimationFrame(() => {
          suppressPageFromScrollRef.current = false;
        });
        return;
      }

      // Wait longer: canvases/refs are rendered with staggered timeouts
      if (attempt < 240) requestAnimationFrame(() => tryRestore(attempt + 1));
    };

    tryRestore();
    return () => { cancelled = true; };
  }, [pdfDoc, pdfPages.length, pageViewports.length, zoom, effectiveLayout]);

  // Page transition "paged": allow scrolling within the current page, but prevent scrolling into other pages.
  useEffect(() => {
    if (navMode !== 'paged') return;
    const container = containerRef.current;
    if (!container || !pdfDoc) return;

    const clampToCurrentPage = (nextScrollTop) => {
      const pageNum = currentPageRef.current || 1;
      const pageEl = pageContainerRefs.current?.[pageNum];
      if (!pageEl) return container.scrollTop;

      const pageTop = pageEl.offsetTop;
      const pageBottom = pageTop + pageEl.offsetHeight;
      const containerH = container.clientHeight;

      // Normal: allow viewport to move within the page
      let minScrollTop = pageTop;
      let maxScrollTop = pageBottom - containerH;

      // If page is shorter than viewport: lock to a centered position
      if (maxScrollTop < minScrollTop) {
        const centered = pageTop - (containerH / 2 - pageEl.offsetHeight / 2);
        minScrollTop = centered;
        maxScrollTop = centered;
      }

      return Math.max(minScrollTop, Math.min(maxScrollTop, nextScrollTop));
    };

    // Snap/clamp immediately when entering paged mode
    container.scrollTop = clampToCurrentPage(container.scrollTop);

    const onWheel = (e) => {
      // Allow browser zoom gesture (ctrl+wheel) to pass through
      if (e.ctrlKey) return;
      e.preventDefault();
      const next = clampToCurrentPage(container.scrollTop + e.deltaY);
      if (next !== container.scrollTop) container.scrollTop = next;
    };

    let touchStartY = null;
    const onTouchStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (touchStartY == null || !e.touches || e.touches.length !== 1) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      const deltaY = touchStartY - y;
      touchStartY = y;
      const next = clampToCurrentPage(container.scrollTop + deltaY);
      if (next !== container.scrollTop) container.scrollTop = next;
    };
    const onTouchEnd = () => { touchStartY = null; };

    const onScroll = () => {
      const clamped = clampToCurrentPage(container.scrollTop);
      if (clamped !== container.scrollTop) container.scrollTop = clamped;
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('scroll', onScroll);
    };
  }, [navMode, pdfDoc]);

  // Close page layout dropdown on outside click / Esc
  useEffect(() => {
    if (!showPageLayoutMenu) return;
    const onMouseDown = (e) => {
      if (pageLayoutMenuRef.current && !pageLayoutMenuRef.current.contains(e.target)) {
        setShowPageLayoutMenu(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowPageLayoutMenu(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showPageLayoutMenu]);

  const handleFileUpload = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      error(t('errors.selectPdfFile', 'Vänligen välj en PDF-fil'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('loading.loadingPdf', 'Laddar PDF...'));
    
    try {
      const data = await loadPDF(file);
      // Viktigt: PDF.js kan "detacha" ArrayBuffer när den skickas till worker.
      // Därför: spara en kopia i state, och ge PDF.js en ANNAN kopia.
      const stateBytes = new Uint8Array(data).slice();
      const pdfJsBytes = new Uint8Array(data).slice();
      setPdfData(stateBytes.buffer.slice(0)); // Spara kopia av original PDF data
      setLoadingMessage(t('loading.parsingPdf', 'Analyserar PDF...'));
      const loadingTask = pdfjsLib.getDocument({ data: pdfJsBytes });
      const doc = await loadingTask.promise;
      const importedTextBoxes = await importExistingPdfText(doc);
      setPdfDoc(doc);
      setCurrentPage(1);
      setPdfPages([]);
      setPageViewports([]);
      canvasRefs.current = {};
      pageContainerRefs.current = {};
      setTextBoxes(importedTextBoxes);
      setWhiteoutBoxes([]);
      setPatchBoxes([]);
      setShapeBoxes([]);
      setCommentBoxes([]);
      // History initieras i useEffect när pdfDoc sätts
      success(t('success.pdfLoaded', 'PDF laddad framgångsrikt'));
    } catch (err) {
      console.error('Fel vid laddning av PDF:', err);
      error(t('errors.loadFailed', 'Kunde inte ladda PDF-filen') + ': ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleFileSelect = async (file) => {
    await handleFileUpload(file);
  };

  const handleCreateNewPdf = async () => {
    setIsLoading(true);
    setLoadingMessage(t('loading.creatingPdf', 'Skapar ny PDF...'));

    try {
      // A4 i points (pt): 595.28 x 841.89
      const doc = await PDFDocument.create();
      doc.addPage([595.28, 841.89]);

      const pdfBytes = await doc.save();

      // Viktigt: PDF.js kan "detacha" ArrayBuffer när den skickas till worker.
      // Därför: spara en kopia i state, och ge PDF.js en ANNAN kopia.
      const stateBytes = new Uint8Array(pdfBytes).slice();
      const pdfJsBytes = new Uint8Array(pdfBytes).slice();

      setPdfData(stateBytes.buffer.slice(0));
      setLoadingMessage(t('loading.parsingPdf', 'Analyserar PDF...'));
      const loadingTask = pdfjsLib.getDocument({ data: pdfJsBytes });
      const newDoc = await loadingTask.promise;

      setPdfDoc(newDoc);
      setCurrentPage(1);
      setPdfPages([]);
      setPageViewports([]);
      canvasRefs.current = {};
      pageContainerRefs.current = {};

      // Nollställ alla overlays
      setTextBoxes([]);
      setWhiteoutBoxes([]);
      setPatchBoxes([]);
      setShapeBoxes([]);
      setHighlightStrokes([]);
      setCommentBoxes([]);

      // Reset tool/selection
      setTool(null);
      setSelectedElement(null);
      setSelectedType(null);

      success(t('success.createdPdf', 'Ny PDF skapad'));
    } catch (err) {
      console.error('Fel vid skapande av ny PDF:', err);
      error(t('errors.createPdfFailed', 'Kunde inte skapa ny PDF') + ': ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSelectImageFile = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      setLoadingMessage(t('loading.loadingImage', 'Laddar bild...'));
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error('Kunde inte läsa bildfilen'));
          reader.readAsDataURL(file);
        });

        if (typeof dataUrl !== 'string') {
          throw new Error('Ogiltig bilddata');
        }

        setPendingImageData(dataUrl);
        setTool('image');
        setSelectedElement(null);
        setSelectedType(null);
        success(t('success.imageReady', 'Bild laddad - dra för att placera'));
      } catch (err) {
        console.error('Fel vid laddning av bild:', err);
        error(t('errors.imageLoadFailed', 'Kunde inte ladda bild') + ': ' + err.message);
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    };
    input.click();
  };

  // Hjälpfunktion för att beräkna avstånd från en punkt till en linje
  const pointToLineDistance = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Hjälpfunktion för att hitta vilken sida som klickades på
  const findPageFromMousePosition = (e) => {
    if (!containerRef.current || pageContainerRefs.current.length === 0) return null;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const mouseY = e.clientY - containerRect.top + scrollTop;
    
    // Hitta vilken sida som är på denna Y-position
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const pageContainer = pageContainerRefs.current[pageNum];
      if (!pageContainer) continue;
      
      const pageRect = pageContainer.getBoundingClientRect();
      const pageTop = pageContainer.offsetTop;
      const pageBottom = pageTop + pageRect.height;
      
      if (mouseY >= pageTop && mouseY < pageBottom) {
        return { pageNum, pageContainer };
      }
    }
    
    return null;
  };

  const handleMouseDown = (e) => {
    // Sätt isMouseDown till true för att spåra om musknappen är nedtryckt
    setIsMouseDown(true);
    
    // Om pan-verktyget är aktivt, starta panning
    if (tool === 'pan' && containerRef.current) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: containerRef.current.scrollLeft,
        scrollTop: containerRef.current.scrollTop
      });
      return;
    }

    // Hitta vilken sida som klickades på
    const clickedPage = findPageFromMousePosition(e);
    if (!clickedPage || !canvasRefs.current[clickedPage.pageNum]) {
      // Klick utanför sidorna: avmarkera kommentar och stäng comment-läget
      if (selectedType === 'comment') {
        setSelectedElement(null);
        setSelectedType(null);
        setTool(null);
      }
      return;
    }
    
    const canvasRef = canvasRefs.current[clickedPage.pageNum];

    // Beräkna koordinater relativt till canvas för den klickade sidan
    const canvasRect = canvasRef.getBoundingClientRect();
    
    // Koordinater relativt till canvas
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    
    // Uppdatera currentPage om vi klickade på en annan sida
    if (clickedPage.pageNum !== currentPage) {
      setCurrentPage(clickedPage.pageNum);
    }

    // Highlight frihand: starta direkt och hoppa över selektion
    if (tool === 'highlight' && highlightMode === 'freehand') {
      setIsDrawing(true);
      setDrawingPage(clickedPage.pageNum);
      const startPoint = { x, y };
      const stroke = {
        pageIndex: clickedPage.pageNum - 1,
        color: highlightSettings.color,
        opacity: highlightSettings.opacity,
        strokeWidth: highlightSettings.strokeWidth,
        points: [startPoint]
      };
      setCurrentStroke(stroke);
      return;
    }

    // Eraser: starta radering (frihand)
    if (tool === 'eraser') {
      setIsErasing(true);
      setDrawingPage(clickedPage.pageNum);
      setHasErasedThisDrag(false);
      return;
    }

    // Kontrollera om vi klickade på ett befintligt element
    let clickedElement = null;
    let clickedType = null;

    // Kontrollera textBoxes (endast för aktuell sida)
    // När highlight-verktyget är aktivt ska text inte gå att välja/redigera.
    const allowTextHitTest = tool === null || tool === 'text' || tool === 'edit-text';
    if (allowTextHitTest) {
      const pageTextBoxes = textBoxes.filter(tb => tb.pageIndex === undefined || tb.pageIndex === currentPage - 1);
      for (let i = pageTextBoxes.length - 1; i >= 0; i--) {
        const tb = pageTextBoxes[i];
        const globalIndex = textBoxes.indexOf(tb);
        const tbRect = rectPtToPx(tb.rect, zoom);
        if (x >= tbRect.x && x <= tbRect.x + tbRect.width &&
            y >= tbRect.y && y <= tbRect.y + tbRect.height) {
          clickedElement = globalIndex;
          clickedType = 'text';
          break;
        }
      }
    }

    if (clickedElement === null) {
      // Kontrollera whiteoutBoxes (endast för aktuell sida)
      // Tillåt klick när tool === null (för selektion) eller när tool === 'whiteout' (för redigering)
      // Hoppa över whiteout-box-kontrollen när text-verktyget är aktivt, så att text kan skapas ovanpå whiteout-boxar
      // Men hoppa över om det är en resize-handle
      if ((tool === null || tool === 'whiteout') && tool !== 'text' && !e.target.dataset.resizeHandle) {
        const pageWhiteoutBoxes = whiteoutBoxes.filter(wb => wb.pageIndex === undefined || wb.pageIndex === currentPage - 1);
        for (let i = pageWhiteoutBoxes.length - 1; i >= 0; i--) {
          const wb = pageWhiteoutBoxes[i];
          const globalIndex = whiteoutBoxes.indexOf(wb);
          const wbRect = rectPtToPx(wb.rect, zoom);
          if (x >= wbRect.x && x <= wbRect.x + wbRect.width &&
              y >= wbRect.y && y <= wbRect.y + wbRect.height) {
            clickedElement = globalIndex;
            clickedType = 'whiteout';
            break;
          }
        }
      }
    }

    if (clickedElement === null) {
      // Kontrollera patchBoxes (endast för aktuell sida)
      // Tillåt klick när tool === null (för selektion) eller när tool === 'patch' (för redigering)
      // Hoppa över patch-box-kontrollen när text-verktyget är aktivt, så att text kan skapas ovanpå patch-boxar
      if ((tool === null || tool === 'patch') && tool !== 'text') {
        const pagePatchBoxes = patchBoxes.filter(pb => pb.pageIndex === undefined || pb.pageIndex === currentPage - 1);
        for (let i = pagePatchBoxes.length - 1; i >= 0; i--) {
          const pb = pagePatchBoxes[i];
          const globalIndex = patchBoxes.indexOf(pb);
          const pbRect = rectPtToPx(pb.targetRect, zoom);
          if (x >= pbRect.x && x <= pbRect.x + pbRect.width &&
              y >= pbRect.y && y <= pbRect.y + pbRect.height) {
            clickedElement = globalIndex;
            clickedType = 'patch';
            break;
          }
        }
      }
    }

    if (clickedElement === null) {
      // Kontrollera commentBoxes (endast för aktuell sida)
      // Tillåt klick när tool === null (för selektion) eller när tool === 'comment' (för redigering)
      if ((tool === null || tool === 'comment')) {
        const pageCommentBoxes = commentBoxes.filter(cb => cb.pageIndex === undefined || cb.pageIndex === currentPage - 1);
        for (let i = pageCommentBoxes.length - 1; i >= 0; i--) {
          const cb = pageCommentBoxes[i];
          const globalIndex = commentBoxes.indexOf(cb);
          const cbRect = rectPtToPx(cb.rect, zoom);
          // Markören är 24px stor, kontrollera om klick är inom markören
          if (x >= cbRect.x && x <= cbRect.x + cbRect.width &&
              y >= cbRect.y && y <= cbRect.y + cbRect.height) {
            clickedElement = globalIndex;
            clickedType = 'comment';
            break;
          }
        }
      }
    }

    if (clickedElement === null) {
      // Kontrollera shapeBoxes (endast för aktuell sida)
      // Tillåt klick när tool === null (för selektion) eller när shape-verktyget är aktivt
      // Hoppa över shape-box-kontrollen när text-verktyget är aktivt
      if ((tool === null || (tool && tool.startsWith('shape'))) && tool !== 'text') {
        const pageShapeBoxes = shapeBoxes.filter(sb => sb.pageIndex === undefined || sb.pageIndex === currentPage - 1);
        for (let i = pageShapeBoxes.length - 1; i >= 0; i--) {
          const sb = pageShapeBoxes[i];
          const globalIndex = shapeBoxes.indexOf(sb);
          const isLineOrArrow = (sb.type === 'line' || sb.type === 'arrow') && sb.startPoint && sb.endPoint;
          const isHighlightRect = sb.type === 'highlight';
          
          let hit = false;
          if (isLineOrArrow) {
            // För linjer/pilar: kontrollera om klick är nära linjen (within 5px)
            const startPx = pointPtToPx(sb.startPoint, zoom);
            const endPx = pointPtToPx(sb.endPoint, zoom);
            const distance = pointToLineDistance(x, y, startPx.x, startPx.y, endPx.x, endPx.y);
            if (distance <= 5) {
              hit = true;
            }
          } else {
            // För rektanglar/cirklar: ALLTID kontrollera bara om klick är på ramen/bordern
            // Detta gör att man kan skapa textrutor och andra element inuti formerna
            const sbRect = rectPtToPx(sb.rect, zoom);
            if (isHighlightRect) {
              // Highlight-ytor bör vara klickbara över hela ytan
              if (x >= sbRect.x && x <= sbRect.x + sbRect.width &&
                  y >= sbRect.y && y <= sbRect.y + sbRect.height) {
                hit = true;
              }
            } else if (sb.type === 'circle') {
              // För cirklar: kontrollera om klick är nära omkretsen
              const centerX = sbRect.x + sbRect.width / 2;
              const centerY = sbRect.y + sbRect.height / 2;
              const radius = Math.min(sbRect.width, sbRect.height) / 2;
              hit = isPointNearCircleBorder(x, y, centerX, centerY, radius, 5);
            } else {
              // För rektanglar: kontrollera om klick är nära kanten
              hit = isPointNearRectBorder(x, y, sbRect.x, sbRect.y, sbRect.width, sbRect.height, 5);
            }
          }
          
          if (hit) {
            clickedElement = globalIndex;
            clickedType = 'shape';
            break;
          }
        }
      }
    }

    if (clickedElement !== null) {
      // Om text är vald, aktivera text-verktyget så att sidebar visas
      if (clickedType === 'text') {
        // Spara scroll-position innan vi ändrar tool (för att behålla PDF-canvas position)
        if (containerRef.current) {
          scrollPositionRef.current = containerRef.current.scrollTop;
        }
        if (tool === null) {
          setTool('text');
        } else if (tool !== 'text' && tool !== 'edit-text') {
          setTool('text');
        }
      }
      
      // Om whiteout är vald, aktivera whiteout-verktyget om tool === null
      let whiteoutToolJustActivated = false;
      if (clickedType === 'whiteout') {
        // Spara scroll-position innan vi ändrar tool (för att behålla PDF-canvas position)
        if (containerRef.current) {
          scrollPositionRef.current = containerRef.current.scrollTop;
        }
        if (tool === null) {
          whiteoutToolJustActivated = true;
          setTool('whiteout');
        }
      }
      
      // Om patch är vald, aktivera patch-verktyget om tool === null
      let patchToolJustActivated = false;
      if (clickedType === 'patch') {
        // Spara scroll-position innan vi ändrar tool (för att behålla PDF-canvas position)
        if (containerRef.current) {
          scrollPositionRef.current = containerRef.current.scrollTop;
        }
        if (tool === null) {
          patchToolJustActivated = true;
          setTool('patch');
        }
      }
      
      // Om shape är vald, aktivera motsvarande shape-verktyg så att sidebar visas
      let shapeToolJustActivated = false;
      if (clickedType === 'shape') {
        const sb = shapeBoxes[clickedElement];
        const shapeType = sb.type || 'rectangle';
        const wasShapeToolActive = tool && tool.startsWith('shape');
        // Spara scroll-position innan vi ändrar tool (för att behålla PDF-canvas position)
        if (containerRef.current) {
          scrollPositionRef.current = containerRef.current.scrollTop;
        }
        if (shapeType === 'highlight') {
          setTool('highlight');
          shapeToolJustActivated = true;
        } else if (!wasShapeToolActive) {
          shapeToolJustActivated = true;
          setTool(`shape-${shapeType}`);
        }
      }
      
      // Om comment är vald, aktivera comment-verktyget om tool === null eller om tool inte är 'comment'
      // Verktyget förblir aktivt när man klickar på befintliga kommentarer
      if (clickedType === 'comment' && tool !== 'comment') {
        // Spara scroll-position innan vi ändrar tool
        if (containerRef.current) {
          scrollPositionRef.current = containerRef.current.scrollTop;
        }
        setTool('comment');
      }
      
      setSelectedElement(clickedElement);
      setSelectedType(clickedType);
      
      // Om text är vald och inte i edit-läge, starta drag (men inte om det är en resize-handle)
      if (clickedType === 'text') {
        if (tool === 'edit-text') {
          setTextEditTrigger({ index: clickedElement, nonce: Date.now() });
        } else if (!e.target.dataset.resizeHandle && !e.target.closest('textarea')) {
        const tb = textBoxes[clickedElement];
        const tbRect = rectPtToPx(tb.rect, zoom);
        setIsDragging(true);
        setDragStart({ x, y, startX: tbRect.x, startY: tbRect.y });
        setOriginalRect(tb.rect);
        }
      }
      
      // Om whiteout är vald, starta drag om whiteout-verktyget är aktivt ELLER om vi just aktiverade det
      // (men inte om det är en resize-handle)
      if (clickedType === 'whiteout' && (tool === 'whiteout' || whiteoutToolJustActivated) && !e.target.dataset.resizeHandle) {
        const wb = whiteoutBoxes[clickedElement];
        const wbRect = rectPtToPx(wb.rect, zoom);
        setIsDragging(true);
        setDragStart({ x, y, startX: wbRect.x, startY: wbRect.y });
        setOriginalRect(wb.rect);
      }
      
      // Om patch är vald, starta drag om patch-verktyget är aktivt ELLER om vi just aktiverade det
      if (clickedType === 'patch' && (tool === 'patch' || patchToolJustActivated)) {
        const pb = patchBoxes[clickedElement];
        const pbRect = rectPtToPx(pb.targetRect, zoom);
        setIsDragging(true);
        setDragStart({ x, y, startX: pbRect.x, startY: pbRect.y });
        setOriginalRect(pb.targetRect);
      }
      
      // Om shape är vald, starta drag om shape-verktyget är aktivt ELLER om vi just aktiverade det
      // (men inte om det är en resize-handle eller endpoint-handle)
      if (clickedType === 'shape' && (tool && tool.startsWith('shape') || shapeToolJustActivated) && !e.target.dataset.resizeHandle && !e.target.dataset.endpointHandle) {
        const sb = shapeBoxes[clickedElement];
        const isLineOrArrow = (sb.type === 'line' || sb.type === 'arrow') && sb.startPoint && sb.endPoint;
        if (isLineOrArrow && sb.startPoint && sb.endPoint) {
          // För linjer/pilar: starta dragging av hela linjen/pilen
          setIsDragging(true);
          setOriginalStartPoint(sb.startPoint);
          setOriginalEndPoint(sb.endPoint);
          setDragStart({ x, y });
        } else if (!isLineOrArrow && sb.rect) {
          // För rektanglar/cirklar: rektangel-baserad dragging
          const sbRect = rectPtToPx(sb.rect, zoom);
          setIsDragging(true);
          setDragStart({ x, y, startX: sbRect.x, startY: sbRect.y });
          setOriginalRect(sb.rect);
        }
      }
      
      // Om comment är vald, starta drag (fungerar både med och utan comment-verktyget aktivt)
      // Men inte om användaren klickade på markören för att öppna redigering
      if (clickedType === 'comment') {
        // Kontrollera om klicket var på markören (inte på popup:en)
        const markerElement = e.target.closest('[data-comment-marker]');
        const isClickingOnMarker = !!markerElement;
        const cb = commentBoxes[clickedElement];
        if (!cb) return;
        
        // Beräkna koordinater relativt till kommentarens egen sida för konsistens
        const commentPageNum = (cb.pageIndex !== undefined ? cb.pageIndex : 0) + 1;
        const commentCanvasRef = canvasRefs.current[commentPageNum];
        if (!commentCanvasRef) return;
        
        const commentCanvasRect = commentCanvasRef.getBoundingClientRect();
        const commentX = e.clientX - commentCanvasRect.left;
        const commentY = e.clientY - commentCanvasRect.top;
        const cbRect = rectPtToPx(cb.rect, zoom);
        // Spara exakt offset inom markören för att undvika att markören hoppar vid dragstart
        const markerRect = markerElement?.getBoundingClientRect();
        const offsetX = markerRect ? e.clientX - markerRect.left : commentX - cbRect.x;
        const offsetY = markerRect ? e.clientY - markerRect.top : commentY - cbRect.y;
        
        if (isClickingOnMarker) {
          // Om man klickade på markören, låt CommentBox hantera det (öppna redigering)
          // Men spara position för att kunna starta drag om användaren drar
          // Spara drag-start men starta inte drag ännu
          // Drag startar när användaren faktiskt drar (mousemove)
          setDragStart({ x: commentX, y: commentY, startX: cbRect.x, startY: cbRect.y, offsetX, offsetY });
          setOriginalRect(cb.rect);
          return;
        }
        
        // Om klicket inte var på markören, starta drag direkt
        setIsDragging(true);
        setDragStart({ x: commentX, y: commentY, startX: cbRect.x, startY: cbRect.y, offsetX, offsetY });
        setOriginalRect(cb.rect);
      }
      return;
    }

    // Om patch-läge och select-mode, börja markera sourceRect
    if (tool === 'patch' && patchMode === 'select') {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
      setDrawingPage(clickedPage.pageNum);
      setSourcePageIndex(clickedPage.pageNum - 1); // Spara källsidan
      return;
    }

    // Om patch-läge och place-mode, placera patch
    if (tool === 'patch' && patchMode === 'place' && sourceRect) {
      // sourceRect är i points (pt), konvertera till pixels för att få rätt storlek
      const sourceRectPx = rectPtToPx(sourceRect, zoom);
      // Använd samma storlek som sourceRect hade (i pixels)
      const targetRectPx = { 
        x, 
        y, 
        width: sourceRectPx.width, 
        height: sourceRectPx.height 
      };
      // Konvertera tillbaka till points för targetRect
      const targetRectPt = rectPxToPt(targetRectPx, zoom);
      
      const newPatch = {
        sourceRect: sourceRect,
        sourcePageIndex: sourcePageIndex, // Spara källsidan
        targetRect: targetRectPt,
        pageIndex: clickedPage.pageNum - 1 // Targetsidan
      };
      
      const newPatchBoxes = [...patchBoxes, newPatch];
      setPatchBoxes(newPatchBoxes);
      setPatchMode('select');
      setSourceRect(null);
      setSourcePageIndex(null);
      saveToHistory(null, null, newPatchBoxes, null, commentBoxes);
      return;
    }

    // För comment-verktyget: skapa kommentar direkt vid klick (om vi inte klickade på en befintlig kommentar)
    // Kontrollera också att vi inte klickade på en textarea, popup, kommentars-sidomeny eller kommentar-markör
    const isClickingOnComment = e.target.closest('[data-comment-marker]') || 
                                 e.target.closest('textarea') || 
                                 e.target.closest('[data-comment-editing]') ||
                                 e.target.closest('[data-comment-popup]');
    const isClickingInCommentSidebar = e.target.closest('[data-comment-sidebar]');

    // Om ett kommentarfält är aktivt (fokus), skapa inte en ny kommentar förrän blur hanterat klart
    const activeEl = document.activeElement;
    const isActiveCommentEdit = activeEl && (
      activeEl.closest('[data-comment-popup]') ||
      activeEl.closest('textarea')
    );
    
    if (tool === 'comment' && clickedElement === null && !isClickingOnComment && !isActiveCommentEdit) {
      // Om vi nyss jobbade med en kommentar (vald) eller klickar i sidomenyn: skapa inte ny,
      // avmarkera och stäng verktyget så att nästa klick inte skapar ny kommentar.
      if (selectedType === 'comment' || isClickingInCommentSidebar) {
        if (selectedType === 'comment') {
          setSelectedElement(null);
          setSelectedType(null);
        }
        setTool(null);
        return;
      }
      // Markör-storlek i px (24px för sticky note)
      const markerSizePx = 24;
      
      // Skapa kommentar med markör-storlek (använd pxToPt för korrekt konvertering)
      const rectPx = {
        x: x - markerSizePx / 2, // Centrera markören på klickpunkten
        y: y - markerSizePx / 2,
        width: markerSizePx,
        height: markerSizePx
      };
      const rectPt = rectPxToPt(rectPx, zoom);
      
      // Generera unikt ID för kommentaren
      const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newCommentBox = {
        id: commentId,
        rect: rectPt,
        text: '',
        replies: [],
        pageIndex: currentPage - 1,
        backgroundColor: commentSettings.backgroundColor, // Spara färg
        icon: commentSettings.icon // Spara ikon-typ
      };
      
      const newCommentBoxes = [...commentBoxes, newCommentBox];
      setCommentBoxes(newCommentBoxes);
      const newIndex = commentBoxes.length;
      setSelectedElement(newIndex);
      setSelectedType('comment');
      // Behåll kommentar-verktyget aktivt så användaren kan lägga till fler kommentarer
      saveToHistory(null, null, null, null, newCommentBoxes);
      
      // Öppna redigeringsläge automatiskt för nya kommentarer
      // Detta görs genom att sätta en flagga som CommentBox kan läsa
      setTimeout(() => {
        // Trigger en update så att CommentBox öppnar redigeringsläge
        const updatedBoxes = [...newCommentBoxes];
        updatedBoxes[newIndex] = { ...updatedBoxes[newIndex], isNew: true };
        setCommentBoxes(updatedBoxes);
      }, 50);
      
      return;
    }

    // För text-verktyget: skapa textruta direkt vid klick (om vi inte klickade på en befintlig ruta)
    // Men inte om det redan finns en markerad textruta (för att undvika att skapa ny när man klickar utanför)
    if (tool === 'text' && clickedElement === null && selectedType !== 'text') {
      // Spara scroll-position innan vi skapar textrutan för att förhindra att sidan hoppar
      const savedScrollTop = containerRef.current?.scrollTop || 0;
      
      // Skapa en textruta med minimal initial storlek (ungefär en bokstav)
      const fontSizePt = textSettings.fontSizePt || 12;
      const fontSizePx = fontSizePt * zoom;
      // Använd en mycket liten initial bredd - textrutan expanderar automatiskt när man skriver
      const defaultWidthPx = fontSizePx * 0.6; // Ungefär en bokstav
      const defaultHeightPx = fontSizePx * 1.1; // En rad höjd med kompakt line-height
      // Justera y-positionen så att textens baseline hamnar där användaren klickade
      // Baseline är ungefär 80% av fontstorleken från toppen av textrutan
      const baselineOffset = fontSizePx * 0.8; // Offset för att få baseline att hamna på klickpunkten
      const rectPx = {
        x: x,
        y: y - baselineOffset, // Flytta upp så att baseline hamnar på klickpunkten
        width: defaultWidthPx,
        height: defaultHeightPx
      };
      const rectPt = rectPxToPt(rectPx, zoom);
      
      const newTextBox = {
        rect: rectPt,
        text: '',
        fontSizePt: textSettings.fontSizePt,
        fontFamily: textSettings.fontFamily,
        color: textSettings.color,
        fontWeight: textSettings.fontWeight,
        fontStyle: textSettings.fontStyle,
        rotation: 0, // Rotation i grader (0-360)
        pageIndex: currentPage - 1,
        isNew: true, // Markera som ny för auto-edit
        isDirty: true
      };
      const newTextBoxes = [...textBoxes, newTextBox];
      setTextBoxes(newTextBoxes);
      const newIndex = textBoxes.length;
      setSelectedElement(newIndex);
      setSelectedType('text');
      saveToHistory(newTextBoxes, null, null, null, commentBoxes);
      
      // Återställ scroll-position efter att DOM har uppdaterats
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = savedScrollTop;
          }
        });
      });
      
      // Ta bort isNew-flaggan efter en delay (längre delay för att säkerställa att autoEdit hinner fungera)
      setTimeout(() => {
        setTextBoxes(prev => prev.map((tb, i) => 
          i === newIndex ? { ...tb, isNew: false } : tb
        ));
      }, 1000); // Ökad delay för att säkerställa att fokusering hinner fungera
      return;
    }
    
    // Om vi klickade utanför alla element, avmarkera allt
    // VIKTIGT: Detta måste komma FÖRE ritningslogiken så att valda element avmarkeras först
    if (clickedElement === null && !e.target.closest('textarea')) {
      // Om en form är vald när vi klickar utanför, avmarkera den och avaktivera form-verktyget
      if (selectedType === 'shape' && tool && tool.startsWith('shape')) {
        setSelectedElement(null);
        setSelectedType(null);
        setTool(null); // Avaktivera form-verktyget
        return; // Avbryt så att form-ritningslogiken inte körs
      }
      
      // Om whiteout är vald när vi klickar utanför, avmarkera den och avaktivera whiteout-verktyget
      if (selectedType === 'whiteout' && tool === 'whiteout') {
        setSelectedElement(null);
        setSelectedType(null);
        setTool(null); // Avaktivera whiteout-verktyget
        return; // Avbryt så att whiteout-ritningslogiken inte körs
      }
      
      // Om text är vald när vi klickar utanför, avmarkera den och avaktivera text-verktyget
      if (selectedType === 'text' && tool === 'text') {
        setSelectedElement(null);
        setSelectedType(null);
        setTool(null); // Avaktivera text-verktyget
        return; // Avbryt så att text-ritningslogiken inte körs
      }
      
      setSelectedElement(null);
      setSelectedType(null);
    }
    
    // För whiteout, börja rita (endast om verktyget är aktivt och vi inte klickade på en befintlig ruta)
    // VIKTIGT: Detta måste komma EFTER avmarkeringslogiken så att valda whiteout-element avmarkeras först
    if (tool === 'whiteout' && clickedElement === null && selectedType !== 'whiteout') {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
      setDrawingPage(clickedPage.pageNum);
      return;
    }

    // Bild-verktyg: dra för att placera vald bild
    if (tool === 'image' && pendingImageData && clickedElement === null) {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
      setDrawingPage(clickedPage.pageNum);
      return;
    }

    // För highlight-ytor (rektangulär)
    if (tool === 'highlight' && highlightMode === 'rect' && clickedElement === null && selectedType !== 'shape') {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
      setDrawingPage(clickedPage.pageNum);
      return;
    }
    
    // För shape-verktyget, börja rita (endast om verktyget är aktivt, vi inte klickade på en befintlig shape, OCH ingen form är vald)
    // VIKTIGT: Detta måste komma EFTER avmarkeringslogiken så att valda former avmarkeras först
    if (tool && tool.startsWith('shape') && clickedElement === null && selectedType !== 'shape') {
      const shapeType = tool.replace('shape-', '');
      // För linjer och pilar: punkt-till-punkt ritning
      if (shapeType === 'line' || shapeType === 'arrow') {
        setIsDrawing(true);
        setLineStartPoint({ x, y }); // Startpunkt i px
        setLineEndPoint({ x, y }); // Initial slutpunkt (samma som start)
        setDrawingPage(clickedPage.pageNum);
        return; // Avbryt så att inget mer händer
      } else {
        // För rektanglar och cirklar: rektangel-baserad ritning
        setIsDrawing(true);
        setDrawStart({ x, y });
        setCurrentRect({ x, y, width: 0, height: 0 });
        setDrawingPage(clickedPage.pageNum);
        return; // Avbryt så att inget mer händer
      }
    }
  };

  const handleMouseMove = (e) => {
    // Om panning är aktivt, flytta PDF:en
    if (isPanning && containerRef.current) {
      const deltaX = panStart.x - e.clientX;
      const deltaY = panStart.y - e.clientY;
      containerRef.current.scrollLeft = panStart.scrollLeft + deltaX;
      containerRef.current.scrollTop = panStart.scrollTop + deltaY;
      return;
    }

    // Hitta vilken sida musen är över
    const hoveredPage = findPageFromMousePosition(e);
    if (!hoveredPage || !canvasRefs.current[hoveredPage.pageNum]) return;
    
    const canvasRef = canvasRefs.current[hoveredPage.pageNum];
    const canvasRect = canvasRef.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

    // Cursor-preview för frihand highlight / eraser
    if (tool === 'highlight' && highlightMode === 'freehand') {
      setHighlightCursor({ pageNum: hoveredPage.pageNum, x, y });
    } else if (highlightCursor) {
      setHighlightCursor(null);
    }
    if (tool === 'eraser') {
      setEraserCursor({ pageNum: hoveredPage.pageNum, x, y });

      // Dynamisk färg baserat på omgivande luminans (medelvärde över en liten ruta)
      const canvasRef = canvasRefs.current[hoveredPage.pageNum];
      if (canvasRef) {
        const ctx = canvasRef.getContext('2d');
        if (ctx) {
          const radiusPx = Math.max(2, eraserSettings.size / 2);
          const sampleSize = Math.max(4, Math.min(32, Math.round(radiusPx))); // liten ruta för snabb sampling
          const half = Math.floor(sampleSize / 2);
          const sx = Math.min(Math.max(Math.floor(x) - half, 0), Math.max(canvasRef.width - sampleSize, 0));
          const sy = Math.min(Math.max(Math.floor(y) - half, 0), Math.max(canvasRef.height - sampleSize, 0));
          try {
            const imgData = ctx.getImageData(sx, sy, sampleSize, sampleSize).data;
            let sum = 0;
            const step = Math.max(1, Math.floor(sampleSize / 6)); // subsampling för prestanda
            let count = 0;
            for (let yy = 0; yy < sampleSize; yy += step) {
              for (let xx = 0; xx < sampleSize; xx += step) {
                const idx = ((yy * sampleSize) + xx) * 4;
                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];
                sum += 0.299 * r + 0.587 * g + 0.114 * b;
                count++;
              }
            }
            const avgLum = count > 0 ? sum / count : 255;
            if (avgLum < 140) {
              setEraserCursorColor('rgba(255,255,255,0.9)'); // ljus ring på mörk bakgrund
            } else {
              setEraserCursorColor('rgba(0,0,0,0.9)'); // mörk ring på ljus bakgrund
            }
          } catch (err) {
            // Fallback: behåll befintlig färg
          }
        }
      }
    } else if (eraserCursor) {
      setEraserCursor(null);
    }

    // Frihand-highlight ritning
    if (isDrawing && tool === 'highlight' && highlightMode === 'freehand' && currentStroke && drawingPage === hoveredPage.pageNum) {
      const updatedStroke = {
        ...currentStroke,
        points: [...(currentStroke.points || []), { x, y }]
      };
      setCurrentStroke(updatedStroke);
      return;
    }

    // Hantera resize av text
    if (isResizing && resizeHandle && originalRect && originalFontSize !== null && selectedElement !== null && selectedType === 'text') {
      // Sätt flaggan för att förhindra useEffect-loops
      isResizingRef.current = true;
      
      const tb = textBoxes[selectedElement];
      const origRectPx = rectPtToPx(originalRect, zoom);
      let newRectPx = { ...origRectPx };
      
      // Sätt textrutans kant direkt till muspekarens position
      // dragStart innehåller original kant-positionen
      const originalEdgeX = dragStart.x;
      const originalEdgeY = dragStart.y;
      
      if (resizeHandle.includes('n')) {
        // Övre kant följer muspekaren
        const diff = y - originalEdgeY;
        newRectPx.y = origRectPx.y + diff;
        newRectPx.height = origRectPx.height - diff;
      }
      if (resizeHandle.includes('s')) {
        // Nedre kant följer muspekaren
        newRectPx.height = y - origRectPx.y;
      }
      if (resizeHandle.includes('w')) {
        // Vänstra kant följer muspekaren
        const diff = x - originalEdgeX;
        newRectPx.x = origRectPx.x + diff;
        newRectPx.width = origRectPx.width - diff;
      }
      if (resizeHandle.includes('e')) {
        // Högra kant följer muspekaren
        newRectPx.width = x - origRectPx.x;
      }
      
      // Minsta storlek - justera position om nödvändigt
      if (newRectPx.width < 20) {
        if (resizeHandle.includes('w')) {
          // Behåll högra kanten, flytta vänstra kanten
          newRectPx.x = origRectPx.x + origRectPx.width - 20;
        } else if (resizeHandle.includes('e')) {
          // Behåll vänstra kanten, justera högra kanten
          newRectPx.width = 20;
        } else {
          newRectPx.width = 20;
        }
      }
      if (newRectPx.height < 20) {
        if (resizeHandle.includes('n')) {
          // Behåll nedre kanten, flytta övre kanten
          newRectPx.y = origRectPx.y + origRectPx.height - 20;
        } else if (resizeHandle.includes('s')) {
          // Behåll övre kanten, justera nedre kanten
          newRectPx.height = 20;
        } else {
          newRectPx.height = 20;
        }
      }
      
      // Beräkna skalningsfaktor baserat på förändringen i storlek
      // Använd genomsnittet av width och height för skalning
      const scaleX = newRectPx.width / origRectPx.width;
      const scaleY = newRectPx.height / origRectPx.height;
      const scale = (scaleX + scaleY) / 2; // Genomsnittlig skalning
      
      // Beräkna ny fontstorlek (minst MIN_FONT_PT) och avrunda till heltal
      const newFontSizePt = Math.round(Math.max(MIN_FONT_PT, originalFontSize * scale));
      
      const newRectPt = rectPxToPt(newRectPx, zoom);
      const newBoxes = [...textBoxes];
      const sampleRectPx = rectPtToPx(tb.originalRect || tb.rect, zoom);
      const sampledColor = tb.isImported
        ? (sampleRectAverageColor((tb.pageIndex ?? (currentPage - 1)) + 1, sampleRectPx) || tb.maskColor)
        : tb.maskColor;

      newBoxes[selectedElement] = markTextBoxDirty(tb, { 
        ...tb, 
        rect: newRectPt,
        fontSizePt: newFontSizePt,
        maskColor: sampledColor
      });
      setTextBoxes(newBoxes);
      
      // Uppdatera också textSettings så att render-logiken använder rätt fontstorlek
      // Detta behövs eftersom render-logiken använder textSettings för valda textboxar
      setTextSettings(prev => ({
        ...prev,
        fontSizePt: newFontSizePt
      }));
      
      return;
    }

    // Hantera resize av whiteout
    if (isResizing && resizeHandle && originalRect && selectedElement !== null && selectedType === 'whiteout') {
      const wb = whiteoutBoxes[selectedElement];
      const origRectPx = rectPtToPx(originalRect, zoom);
      let newRectPx = { ...origRectPx };
      
      // Beräkna ny position och storlek baserat på resize-handle
      // dragStart.x och dragStart.y är initial mouse position när resize startade
      const startX = dragStart.x;
      const startY = dragStart.y;
      
      if (resizeHandle.includes('n')) {
        const diff = y - startY;
        newRectPx.y = origRectPx.y + diff;
        newRectPx.height = origRectPx.height - diff;
      }
      if (resizeHandle.includes('s')) {
        newRectPx.height = origRectPx.height + (y - startY);
      }
      if (resizeHandle.includes('w')) {
        const diff = x - startX;
        newRectPx.x = origRectPx.x + diff;
        newRectPx.width = origRectPx.width - diff;
      }
      if (resizeHandle.includes('e')) {
        newRectPx.width = origRectPx.width + (x - startX);
      }
      
      // Minsta storlek
      if (newRectPx.width < 20) {
        if (resizeHandle.includes('w')) {
          newRectPx.x = origRectPx.x + origRectPx.width - 20;
        }
        newRectPx.width = 20;
      }
      if (newRectPx.height < 20) {
        if (resizeHandle.includes('n')) {
          newRectPx.y = origRectPx.y + origRectPx.height - 20;
        }
        newRectPx.height = 20;
      }
      
      const newRectPt = rectPxToPt(newRectPx, zoom);
      const newBoxes = [...whiteoutBoxes];
      newBoxes[selectedElement] = { ...wb, rect: newRectPt };
      setWhiteoutBoxes(newBoxes);
      return;
    }
    
    // Hantera rotation av text och whiteout
    if (isRotating && rotationStart && selectedElement !== null) {
      const { centerX, centerY } = rotationStart;
      
      // Beräkna vinklar från centrum till start- och nuvarande musposition
      const startAngle = Math.atan2(rotationStart.y - centerY, rotationStart.x - centerX) * (180 / Math.PI);
      const currentAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      
      // Beräkna vinkelskillnaden
      let angleDiff = currentAngle - startAngle;
      
      // Normalisera vinkelskillnaden till -180 till 180 för att hantera övergångar över 0/360
      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;
      
      // Lägg till skillnaden till initial rotation
      let newRotation = initialRotation + angleDiff;
      
      // Normalisera till 0-360
      newRotation = newRotation % 360;
      if (newRotation < 0) newRotation += 360;
      
      if (selectedType === 'text') {
        const tb = textBoxes[selectedElement];
        if (!tb) return;
      const newBoxes = [...textBoxes];
        const sampleRectPx = rectPtToPx(tb.originalRect || tb.rect, zoom);
        const sampledColor = tb.isImported
          ? (sampleRectAverageColor((tb.pageIndex ?? (currentPage - 1)) + 1, sampleRectPx) || tb.maskColor)
          : tb.maskColor;

        newBoxes[selectedElement] = markTextBoxDirty(tb, { ...tb, rotation: newRotation, maskColor: sampledColor });
      setTextBoxes(newBoxes);
      return;
      } else if (selectedType === 'whiteout') {
        const wb = whiteoutBoxes[selectedElement];
        if (!wb) return;
        const newBoxes = [...whiteoutBoxes];
        newBoxes[selectedElement] = { ...wb, rotation: newRotation };
        setWhiteoutBoxes(newBoxes);
        return;
      }
    }
    
    // Erasing highlights (frihand) - bit-för-bit
    if (isErasing && tool === 'eraser' && drawingPage === hoveredPage.pageNum) {
      const radiusPx = eraserSettings.size / 2;
      const radiusPt = pxToPt(radiusPx, zoom);
      const erasePt = pointPxToPt({ x, y }, zoom);
      const newStrokes = [];

      for (const stroke of highlightStrokes) {
        if (stroke.pageIndex !== (hoveredPage.pageNum - 1)) {
          newStrokes.push(stroke);
          continue;
        }

        const pts = stroke.points || [];
        const segments = [];
        let current = [];

        for (const p of pts) {
          const dx = erasePt.x - p.x;
          const dy = erasePt.y - p.y;
          const hit = Math.sqrt(dx * dx + dy * dy) <= radiusPt;

          if (!hit) {
            current.push(p);
          } else {
            if (current.length > 1) segments.push(current);
            current = [];
          }
        }
        if (current.length > 1) segments.push(current);

        if (segments.length === 1) {
          newStrokes.push({ ...stroke, points: segments[0] });
        } else if (segments.length > 1) {
          segments.forEach((seg) => newStrokes.push({ ...stroke, points: seg }));
        }
        // Om inga segment återstår, stroke tas bort
      }

      if (newStrokes.length !== highlightStrokes.length) {
        setHighlightStrokes(newStrokes);
        setHasErasedThisDrag(true);
      }
      return;
    }

    // Hantera drag av text
    if (isDragging && dragStart && selectedElement !== null && selectedType === 'text') {
      const tb = textBoxes[selectedElement];
      const origRectPx = rectPtToPx(originalRect, zoom);
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      
      const newRectPx = {
        x: dragStart.startX + dx,
        y: dragStart.startY + dy,
        width: origRectPx.width,
        height: origRectPx.height
      };
      
      const newRectPt = rectPxToPt(newRectPx, zoom);
      const sampleRectPx = rectPtToPx(tb.originalRect || tb.rect, zoom);
      const sampledColor = tb.isImported
        ? (sampleRectAverageColor((tb.pageIndex ?? (currentPage - 1)) + 1, sampleRectPx) || tb.maskColor)
        : tb.maskColor;

      const newBoxes = [...textBoxes];
      newBoxes[selectedElement] = markTextBoxDirty(tb, { ...tb, rect: newRectPt, maskColor: sampledColor });
      setTextBoxes(newBoxes);
      return;
    }
    
    // Hantera drag av whiteout
    if (isDragging && dragStart && selectedElement !== null && selectedType === 'whiteout') {
      const wb = whiteoutBoxes[selectedElement];
      const origRectPx = rectPtToPx(originalRect, zoom);
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      
      const newRectPx = {
        x: dragStart.startX + dx,
        y: dragStart.startY + dy,
        width: origRectPx.width,
        height: origRectPx.height
      };
      
      const newRectPt = rectPxToPt(newRectPx, zoom);
      const newBoxes = [...whiteoutBoxes];
      newBoxes[selectedElement] = { ...wb, rect: newRectPt };
      setWhiteoutBoxes(newBoxes);
      return;
    }
    
    // Hantera drag av comment
    // Starta drag om användaren har dragStart, musknappen är nedtryckt och faktiskt drar (rör sig mer än 5px)
    if (dragStart && isMouseDown && selectedElement !== null && selectedType === 'comment') {
      const cb = commentBoxes[selectedElement];
      if (!cb) return;
      
      // Beräkna koordinater relativt till kommentarens egen sida för konsistens
      const commentPageNum = (cb.pageIndex !== undefined ? cb.pageIndex : 0) + 1;
      const commentCanvasRef = canvasRefs.current[commentPageNum];
      if (!commentCanvasRef) return;
      
      const commentCanvasRect = commentCanvasRef.getBoundingClientRect();
      const commentX = e.clientX - commentCanvasRect.left;
      const commentY = e.clientY - commentCanvasRect.top;
      
      const dx = commentX - dragStart.x;
      const dy = commentY - dragStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Starta drag om användaren har dragit mer än 5px
      if (distance > 5 && !isDragging) {
        setIsDragging(true);
      }
      
      // Om drag är aktivt, uppdatera position
      if (isDragging || distance > 5) {
        const origRectPx = rectPtToPx(originalRect, zoom);
        // Beräkna ny position baserat på ursprungligt offset inom markören,
        // inte på avrundad modellkoordinat, för att undvika att markören hoppar.
        const offsetX = dragStart.offsetX ?? (dragStart.x - dragStart.startX);
        const offsetY = dragStart.offsetY ?? (dragStart.y - dragStart.startY);
        const newRectPx = {
          x: commentX - offsetX,
          y: commentY - offsetY,
          width: origRectPx.width,
          height: origRectPx.height
        };
        
        const newRectPt = rectPxToPt(newRectPx, zoom);
        const newBoxes = [...commentBoxes];
        newBoxes[selectedElement] = { ...cb, rect: newRectPt };
        setCommentBoxes(newBoxes);
        return;
      }
    }
    
    // Hantera drag av patch
    if (isDragging && dragStart && selectedElement !== null && selectedType === 'patch') {
      const pb = patchBoxes[selectedElement];
      const origRectPx = rectPtToPx(originalRect, zoom);
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      
      const newRectPx = {
        x: dragStart.startX + dx,
        y: dragStart.startY + dy,
        width: origRectPx.width,
        height: origRectPx.height
      };
      
      const newRectPt = rectPxToPt(newRectPx, zoom);
      const newBoxes = [...patchBoxes];
      newBoxes[selectedElement] = { ...pb, targetRect: newRectPt };
      setPatchBoxes(newBoxes);
      return;
    }
    
    // Hantera resize av shape (endast för rektanglar/cirklar, inte linjer/pilar)
    if (isResizing && resizeHandle && originalRect && selectedElement !== null && selectedType === 'shape') {
      const sb = shapeBoxes[selectedElement];
      const isLineOrArrow = (sb.type === 'line' || sb.type === 'arrow') && sb.startPoint && sb.endPoint;
      if (!isLineOrArrow) {
        // Endast resize rektanglar/cirklar
        const origRectPx = rectPtToPx(originalRect, zoom);
        let newRectPx = { ...origRectPx };
        
        const startX = dragStart.x;
        const startY = dragStart.y;
        
        if (resizeHandle.includes('n')) {
          const diff = y - startY;
          newRectPx.y = origRectPx.y + diff;
          newRectPx.height = origRectPx.height - diff;
        }
        if (resizeHandle.includes('s')) {
          newRectPx.height = origRectPx.height + (y - startY);
        }
        if (resizeHandle.includes('w')) {
          const diff = x - startX;
          newRectPx.x = origRectPx.x + diff;
          newRectPx.width = origRectPx.width - diff;
        }
        if (resizeHandle.includes('e')) {
          newRectPx.width = origRectPx.width + (x - startX);
        }
        
        // Minsta storlek
        if (newRectPx.width < 20) {
          if (resizeHandle.includes('w')) {
            newRectPx.x = origRectPx.x + origRectPx.width - 20;
          }
          newRectPx.width = 20;
        }
        if (newRectPx.height < 20) {
          if (resizeHandle.includes('n')) {
            newRectPx.y = origRectPx.y + origRectPx.height - 20;
          }
          newRectPx.height = 20;
        }
        
        const newRectPt = rectPxToPt(newRectPx, zoom);
        const newBoxes = [...shapeBoxes];
        newBoxes[selectedElement] = { ...sb, rect: newRectPt };
        setShapeBoxes(newBoxes);
      }
      return;
    }
    
    // Hantera endpoint-dragning för linjer/pilar (har högre prioritet än hela linjen/pilen)
    if (isDraggingEndpoint && draggingEndpointType && originalStartPoint && originalEndPoint && selectedElement !== null && selectedType === 'shape') {
      const sb = shapeBoxes[selectedElement];
      if ((sb.type === 'line' || sb.type === 'arrow') && sb.startPoint && sb.endPoint) {
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;
        
        const startPointPx = pointPtToPx(originalStartPoint, zoom);
        const endPointPx = pointPtToPx(originalEndPoint, zoom);
        
        let newStartPointPx, newEndPointPx;
        
        if (draggingEndpointType === 'start') {
          // Flytta startpunkt
          newStartPointPx = { x: startPointPx.x + dx, y: startPointPx.y + dy };
          newEndPointPx = endPointPx;
        } else {
          // Flytta slutpunkt
          newStartPointPx = startPointPx;
          newEndPointPx = { x: endPointPx.x + dx, y: endPointPx.y + dy };
        }
        
        const newStartPointPt = pointPxToPt(newStartPointPx, zoom);
        const newEndPointPt = pointPxToPt(newEndPointPx, zoom);
        
        const newBoxes = [...shapeBoxes];
        newBoxes[selectedElement] = {
          ...sb,
          startPoint: newStartPointPt,
          endPoint: newEndPointPt
        };
        setShapeBoxes(newBoxes);
      }
      return;
    }
    
    // Hantera drag av hela linjen/pilen (endast om inte endpoint-dragging)
    if (isDragging && dragStart && originalStartPoint && originalEndPoint && selectedElement !== null && selectedType === 'shape') {
      const sb = shapeBoxes[selectedElement];
      const isLineOrArrow = (sb.type === 'line' || sb.type === 'arrow') && sb.startPoint && sb.endPoint;
      if (isLineOrArrow) {
        // Flytta båda endpoints tillsammans
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;
        
        const startPointPx = pointPtToPx(originalStartPoint, zoom);
        const endPointPx = pointPtToPx(originalEndPoint, zoom);
        
        const newStartPointPx = { x: startPointPx.x + dx, y: startPointPx.y + dy };
        const newEndPointPx = { x: endPointPx.x + dx, y: endPointPx.y + dy };
        
        const newStartPointPt = pointPxToPt(newStartPointPx, zoom);
        const newEndPointPt = pointPxToPt(newEndPointPx, zoom);
        
        const newBoxes = [...shapeBoxes];
        newBoxes[selectedElement] = {
          ...sb,
          startPoint: newStartPointPt,
          endPoint: newEndPointPt
        };
        setShapeBoxes(newBoxes);
        return;
      }
    }
    
    // Hantera drag av shape (rektanglar/cirklar)
    if (isDragging && dragStart && originalRect && selectedElement !== null && selectedType === 'shape') {
      const sb = shapeBoxes[selectedElement];
      const isLineOrArrow = (sb.type === 'line' || sb.type === 'arrow') && sb.startPoint && sb.endPoint;
      if (!isLineOrArrow && sb.rect) {
        // Rektangel-baserad dragning
        const origRectPx = rectPtToPx(originalRect, zoom);
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;
        
        const newRectPx = {
          x: dragStart.startX + dx,
          y: dragStart.startY + dy,
          width: origRectPx.width,
          height: origRectPx.height
        };
        
        const newRectPt = rectPxToPt(newRectPx, zoom);
        const newBoxes = [...shapeBoxes];
        newBoxes[selectedElement] = { ...sb, rect: newRectPt };
        setShapeBoxes(newBoxes);
      }
      return;
    }

    // Hantera rita nya element
    if (!isDrawing) return;
    
    // För linjer/pilar: punkt-till-punkt ritning
    if (lineStartPoint && (tool === 'shape-line' || tool === 'shape-arrow')) {
      setLineEndPoint({ x, y });
      return;
    }
    
    // För andra shapes: rektangel-baserad ritning
    if (!drawStart) return;

    const width = Math.abs(x - drawStart.x);
    const height = Math.abs(y - drawStart.y);
    const minX = Math.min(drawStart.x, x);
    const minY = Math.min(drawStart.y, y);

    setCurrentRect({ x: minX, y: minY, width, height });
  };

  const handleMouseUp = () => {
    // Alltid sätt isMouseDown till false när musknappen släpps
    setIsMouseDown(false);
    
    // Rensa dragStart för kommentarer även om drag inte startade
    // Detta förhindrar att kommentaren följer musen efter klick utan drag
    if (dragStart && selectedType === 'comment' && !isDragging) {
      setDragStart(null);
      setOriginalRect(null);
    }
    
    // Stoppa panning
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Avsluta frihand-highlight
    if (isDrawing && tool === 'highlight' && highlightMode === 'freehand' && currentStroke && currentStroke.points && currentStroke.points.length > 1) {
      const strokePt = {
        ...currentStroke,
        points: currentStroke.points.map((p) => pointPxToPt(p, zoom))
      };
      const newStrokes = [...highlightStrokes, strokePt];
      setHighlightStrokes(newStrokes);
      saveToHistory(null, null, null, null, null, newStrokes);
    }
    setCurrentStroke(null);
    if (isDrawing && tool === 'highlight' && highlightMode === 'freehand') {
      setIsDrawing(false);
      setDrawingPage(null);
      return;
    }

    if (isErasing) {
      if (hasErasedThisDrag) {
        saveToHistory(null, null, null, null, null, highlightStrokes);
      }
      setIsErasing(false);
      setHasErasedThisDrag(false);
    }

    // Rensa cursor-preview när musen släpps
    if (highlightCursor) {
      setHighlightCursor(null);
    }
    if (eraserCursor) {
      setEraserCursor(null);
    }

      // Hantera resize/drag/rotation avslut
    if (isResizing || isDragging || isDraggingEndpoint || isRotating) {
      if (isRotating && selectedElement !== null && selectedType === 'text') {
        setIsRotating(false);
        setRotationStart(null);
        setInitialRotation(0);
        saveToHistory(textBoxes, null, null, null, commentBoxes);
        return;
      }
      if (isRotating && selectedElement !== null && selectedType === 'whiteout') {
        setIsRotating(false);
        setRotationStart(null);
        setInitialRotation(0);
        saveToHistory(null, whiteoutBoxes, null, null, commentBoxes);
        return;
      }
      if (selectedElement !== null && selectedType === 'whiteout') {
        saveToHistory(null, whiteoutBoxes, null, null, commentBoxes);
      } else if (selectedElement !== null && selectedType === 'patch') {
        saveToHistory(null, null, patchBoxes, null, commentBoxes);
      } else if (selectedElement !== null && selectedType === 'text') {
        // Spara till history för textbox resize/drag
        saveToHistory(textBoxes, null, null, null, commentBoxes);
      } else if (selectedElement !== null && selectedType === 'shape') {
        // Spara till history för shape resize/drag
        saveToHistory(null, null, null, shapeBoxes, commentBoxes);
      } else if (selectedElement !== null && selectedType === 'comment') {
        // Spara till history för comment drag
        saveToHistory(null, null, null, null, commentBoxes);
      }
      setIsResizing(false);
      setIsDragging(false);
      setIsRotating(false);
      setIsDraggingEndpoint(false);
      setDraggingEndpointType(null);
      setResizeHandle(null);
      setDragStart(null);
      setRotationStart(null);
      setInitialRotation(0);
      setOriginalRect(null);
      setOriginalFontSize(null);
      setOriginalStartPoint(null);
      setOriginalEndPoint(null);
      // Återställ resize-flaggan så att useEffect kan köras igen
      isResizingRef.current = false;
    }
    
    // Hantera punkt-till-punkt ritning för linjer/pilar
    if (isDrawing && lineStartPoint && lineEndPoint && (tool === 'shape-line' || tool === 'shape-arrow')) {
      const drawingPageNum = drawingPage || currentPage;
      const shapeType = tool.replace('shape-', '');
      
      // Kontrollera minsta längd (10-15 pixlar)
      const length = Math.sqrt(
        Math.pow(lineEndPoint.x - lineStartPoint.x, 2) + 
        Math.pow(lineEndPoint.y - lineStartPoint.y, 2)
      );
      const minLength = 15;
      
      if (length >= minLength) {
        const startPointPt = pointPxToPt(lineStartPoint, zoom);
        const endPointPt = pointPxToPt(lineEndPoint, zoom);
        
        const newShape = {
          startPoint: startPointPt,
          endPoint: endPointPt,
          pageIndex: drawingPageNum - 1,
          type: shapeType,
          strokeColor: shapeSettings.strokeColor,
          strokeWidth: shapeSettings.strokeWidth
        };
        const newShapeBoxes = [...shapeBoxes, newShape];
        setShapeBoxes(newShapeBoxes);
        setSelectedElement(shapeBoxes.length);
        setSelectedType('shape');
        saveToHistory(null, null, null, newShapeBoxes, commentBoxes);
      }
      
      setIsDrawing(false);
      setLineStartPoint(null);
      setLineEndPoint(null);
      setDrawingPage(null);
      return;
    }
    
    if (!isDrawing || !drawStart || !currentRect) {
      setIsDrawing(false);
      setLineStartPoint(null);
      setLineEndPoint(null);
      return;
    }

    // Kontrollera minsta storlek för att skapa en box
    // Highlight area (rect) ska kunna vara liten, övriga verktyg behåller större tröskel.
    const minSize = (tool === 'highlight' && highlightMode === 'rect') ? 2 : 20;
    if (currentRect.width < minSize || currentRect.height < minSize) {
      // För liten storlek, avbryt utan att skapa något
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentRect(null);
      return;
    }

    const rectPt = rectPxToPt(currentRect, zoom);

    if (tool === 'text') {
      // Hitta vilken sida som ritas på
      const drawingPageNum = drawingPage || currentPage;
      const newTextBox = {
        rect: rectPt,
        text: '',
        fontSizePt: textSettings.fontSizePt,
        fontFamily: textSettings.fontFamily,
        color: textSettings.color,
        fontWeight: textSettings.fontWeight,
        fontStyle: textSettings.fontStyle,
        pageIndex: drawingPageNum - 1,
        isNew: true, // Markera som ny för auto-edit
        isDirty: true
      };
      const newTextBoxes = [...textBoxes, newTextBox];
      setTextBoxes(newTextBoxes);
      const newIndex = textBoxes.length;
      setSelectedElement(newIndex);
      setSelectedType('text');
      saveToHistory(newTextBoxes, null, null, null, commentBoxes);
      
      // Ta bort isNew-flaggan efter en kort delay för att undvika att den alltid är i edit-läge
      setTimeout(() => {
        setTextBoxes(prev => prev.map((tb, i) => 
          i === newIndex ? { ...tb, isNew: false } : tb
        ));
      }, 100);
    } else if (tool === 'whiteout') {
      // Hitta vilken sida som ritas på
      const drawingPageNum = drawingPage || currentPage;
      const newWhiteout = {
        rect: rectPt,
        pageIndex: drawingPageNum - 1,
        color: whiteoutColor,
        rotation: 0
      };
      const newWhiteoutBoxes = [...whiteoutBoxes, newWhiteout];
      setWhiteoutBoxes(newWhiteoutBoxes);
      setSelectedElement(whiteoutBoxes.length);
      setSelectedType('whiteout');
      saveToHistory(null, newWhiteoutBoxes, null, null, commentBoxes);
    } else if (tool === 'image' && pendingImageData) {
      const drawingPageNum = drawingPage || currentPage;
      const newImagePatch = {
        targetRect: rectPt,
        pageIndex: drawingPageNum - 1,
        imageData: pendingImageData
      };
      const newPatchBoxes = [...patchBoxes, newImagePatch];
      setPatchBoxes(newPatchBoxes);
      setSelectedElement(patchBoxes.length);
      setSelectedType('patch');
      saveToHistory(null, null, newPatchBoxes, null, commentBoxes);

      // Avaktivera bild-verktyget efter placering (redigera är primärt)
      setTool(null);
      setPendingImageData(null);
      success(t('success.imagePlaced', 'Bild placerad'));
    } else if (tool === 'patch' && patchMode === 'select') {
      // Spara sourceRect och växla till place-mode
      const drawingPageNum = drawingPage || currentPage;
      setSourceRect(rectPt);
      setSourcePageIndex(drawingPageNum - 1); // Spara källsidan
      setPatchMode('place');
    } else if (tool === 'highlight' && highlightMode === 'rect') {
      const drawingPageNum = drawingPage || currentPage;
      const newHighlight = {
        rect: rectPt,
        pageIndex: drawingPageNum - 1,
        type: 'highlight',
        strokeColor: 'transparent',
        fillColor: highlightSettings.color,
        opacity: highlightSettings.opacity,
        strokeWidth: 0
      };
      const newShapeBoxes = [...shapeBoxes, newHighlight];
      setShapeBoxes(newShapeBoxes);
      setSelectedElement(shapeBoxes.length);
      setSelectedType('shape');
      saveToHistory(null, null, null, newShapeBoxes, commentBoxes);
    } else if (tool && tool.startsWith('shape')) {
      // Hitta vilken sida som ritas på
      const drawingPageNum = drawingPage || currentPage;
      const shapeType = tool.replace('shape-', ''); // Extrahera shape-typ från tool (t.ex. 'rectangle' från 'shape-rectangle')
      
      // För linjer/pilar: detta ska inte hända här eftersom de hanteras i punkt-till-punkt sektionen ovan
      // Detta är endast för rektanglar/cirklar
      if (shapeType !== 'line' && shapeType !== 'arrow') {
        const newShape = {
          rect: rectPt,
          pageIndex: drawingPageNum - 1,
          type: shapeType,
          strokeColor: shapeSettings.strokeColor,
          fillColor: shapeSettings.fillColor,
          strokeWidth: shapeSettings.strokeWidth
        };
        const newShapeBoxes = [...shapeBoxes, newShape];
        setShapeBoxes(newShapeBoxes);
        setSelectedElement(shapeBoxes.length);
        setSelectedType('shape');
        saveToHistory(null, null, null, newShapeBoxes, commentBoxes);
      }
    }

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentRect(null);
    setDrawingPage(null);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(5, prev + 0.1));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.5, prev - 0.1));
  };

  // Scrolla till en specifik sida
  const scrollToPage = (pageNum) => {
    if (!containerRef.current || !pageContainerRefs.current[pageNum]) return;
    
    const pageContainer = pageContainerRefs.current[pageNum];
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const pageTop = pageContainer.offsetTop;
    
    // Scrolla så att sidan är i mitten av viewport
    const scrollPosition = pageTop - containerRect.height / 2 + pageContainer.offsetHeight / 2;
    container.scrollTo({
      top: Math.max(0, scrollPosition),
      behavior: 'smooth'
    });
  };

  // Hjälpfunktion: Exportera PDF från pdfDoc genom att rendera till bilder (för detached ArrayBuffer)
  const exportPDFFromPdfDoc = async (pdfDocRef) => {
    const newPdfDoc = await PDFDocument.create();
    const numPages = pdfDocRef.numPages;
    
    // Processa varje sida
    for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
      const page = await pdfDocRef.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 2.0 });
      
      // Skapa canvas för att rendera PDF-sidan
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      
      // Rendera PDF-sidan till canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Konvertera canvas till PNG
      const imageData = canvas.toDataURL('image/png');
      const base64String = imageData.split(',')[1];
      const binaryString = atob(base64String);
      const imageBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        imageBytes[i] = binaryString.charCodeAt(i);
      }
      
      // Bädda in bilden i ny PDF
      const image = await newPdfDoc.embedPng(imageBytes);
      const { width, height } = page.getViewport({ scale: 1.0 });
      const pdfPage = newPdfDoc.addPage([width, height]);
      
      // Rita PDF-sidan som bakgrund
      pdfPage.drawImage(image, {
        x: 0,
        y: 0,
        width: width,
        height: height
      });
    }
    
    const pdfBytes = await newPdfDoc.save();
    return new Uint8Array(pdfBytes);
  };

  // Rotera sidor
  const handleRotatePages = async (pageNumbers, angle) => {
    if (!pdfDoc || !pdfData || pageNumbers.length === 0) return;

    setIsLoading(true);
    setLoadingMessage(t('loading.rotatingPages', 'Roterar sidor...'));

    try {
      // Preserve viewer position (stay on current page + same intra-page scroll) across the PDF reload.
      const savedPage = currentPageRef.current || currentPage;
      const container = containerRef.current;
      const pageEl = pageContainerRefs.current?.[savedPage];
      pendingViewerScrollRestoreRef.current = {
        pageNum: savedPage,
        offsetInPage: container && pageEl ? (container.scrollTop - pageEl.offsetTop) : 0,
        // In "paged" mode, prefer centering like scrollToPage to avoid ending up between pages.
        align: navMode === 'paged' ? 'center' : 'keep'
      };
      suppressPageFromScrollRef.current = true;

      // Kopiera PDF-data säkert (hantera detached ArrayBuffer)
      let pdfDataCopy;
      try {
        const uint8Array = new Uint8Array(pdfData);
        pdfDataCopy = uint8Array.slice().buffer;
      } catch (error) {
        // Om ArrayBuffer är detached, exportera PDF:en från pdfDoc för att få en frisk kopia
        console.warn('PDF data är detached, exporterar från pdfDoc...');
        const exportedBytes = await exportPDFFromPdfDoc(pdfDoc);
        pdfDataCopy = exportedBytes.buffer.slice(0);
      }

      // Ladda PDF med pdf-lib
      const pdfLibDoc = await PDFDocument.load(pdfDataCopy, { 
        ignoreEncryption: true,
        updateMetadata: false,
        parseSpeed: 0
      });

      const pages = pdfLibDoc.getPages();
      
      // Rotera valda sidor (pageNumbers är 1-indexerade)
      for (const pageNum of pageNumbers) {
        const pageIndex = pageNum - 1; // Konvertera till 0-indexerad
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          // Hämta nuvarande rotation och konvertera till grader
          let currentRotation = 0;
          try {
            const rotation = page.getRotation();
            // getRotation() kan returnera ett Rotation-objekt eller ett nummer
            if (rotation && typeof rotation === 'object') {
              // Om det är ett objekt, prova olika metoder för att få ut grader
              if (typeof rotation.degrees === 'function') {
                currentRotation = rotation.degrees();
              } else if (typeof rotation.angle === 'number') {
                currentRotation = rotation.angle;
              } else if (typeof rotation.valueOf === 'function') {
                currentRotation = Number(rotation.valueOf());
              } else {
                currentRotation = 0;
              }
            } else {
              currentRotation = Number(rotation) || 0;
            }
          } catch (e) {
            // Om getRotation() misslyckas, antag 0 grader
            currentRotation = 0;
          }
          
          // Lägg till vinkeln och normalisera till 0-270
          const newRotation = (currentRotation + angle) % 360;
          // pdf-lib kräver att rotationen skickas som ett Rotation-objekt, använd degrees()
          page.setRotation(degrees(newRotation));
        }
      }

      // Spara modifierad PDF
      const modifiedPdfBytes = await pdfLibDoc.save();
      // Skapa två separata kopior: en för state, en för PDF.js (för att undvika detached ArrayBuffer och raster-fallback)
      const stateBytes = new Uint8Array(modifiedPdfBytes);
      const pdfJsBytes = new Uint8Array(modifiedPdfBytes);

      // Ladda om med PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: pdfJsBytes });
      const newDoc = await loadingTask.promise;
      
      setPdfData(stateBytes.buffer.slice(0));
      setPdfDoc(newDoc);
      setPdfPages([]);
      setPageViewports([]);
      canvasRefs.current = {};
      pageContainerRefs.current = {};
      
      // Keep current page (unless it is now out of bounds)
      const keepPage = pendingViewerScrollRestoreRef.current?.pageNum ?? (currentPageRef.current || currentPage);
      const nextPage = Math.min(Math.max(1, keepPage), newDoc.numPages);
      currentPageRef.current = nextPage;
      setCurrentPage(nextPage);
      if (pendingViewerScrollRestoreRef.current && pendingViewerScrollRestoreRef.current.pageNum !== nextPage) {
        pendingViewerScrollRestoreRef.current = null;
      }

      success(t('success.pagesRotated', { count: pageNumbers.length }, `${pageNumbers.length} sida/sidor roterade`));
    } catch (err) {
      console.error('Fel vid rotation av sidor:', err);
      error(t('errors.rotateFailed', 'Rotation misslyckades') + ': ' + err.message);
    } finally {
      // If restore didn't happen (e.g. error), don't permanently suppress.
      if (!pendingViewerScrollRestoreRef.current) {
        suppressPageFromScrollRef.current = false;
      }
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Ta bort sidor
  const handleDeletePages = async (pageNumbers) => {
    if (!pdfDoc || !pdfData || pageNumbers.length === 0 || pdfDoc.numPages <= 1) return;

    setIsLoading(true);
    setLoadingMessage(t('loading.deletingPages', 'Tar bort sidor...'));

    try {
      // Kopiera PDF-data säkert (hantera detached ArrayBuffer)
      let pdfDataCopy;
      try {
        const uint8Array = new Uint8Array(pdfData);
        pdfDataCopy = uint8Array.slice().buffer;
      } catch (error) {
        // Om ArrayBuffer är detached, exportera PDF:en för att få en frisk kopia
        console.warn('PDF data är detached, exporterar för att få frisk kopia...');
        const exportedBytes = await exportPDF(pdfData, textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, highlightStrokes);
        pdfDataCopy = exportedBytes.buffer.slice(0);
      }

      // Ladda PDF med pdf-lib
      const pdfLibDoc = await PDFDocument.load(pdfDataCopy, { 
        ignoreEncryption: true,
        updateMetadata: false,
        parseSpeed: 0
      });

      // Sortera sidnummer i fallande ordning för att ta bort från slutet
      const sortedPages = [...pageNumbers].sort((a, b) => b - a);
      
      // Ta bort sidor (pageNumbers är 1-indexerade, pdf-lib använder 0-indexerade)
      for (const pageNum of sortedPages) {
        const pageIndex = pageNum - 1;
        if (pageIndex >= 0 && pageIndex < pdfLibDoc.getPageCount()) {
          pdfLibDoc.removePage(pageIndex);
        }
      }

      // Ta bort element på borttagna sidor
      const pagesToDelete = new Set(sortedPages.map(p => p - 1)); // Konvertera till 0-indexerade
      
      const newTextBoxes = textBoxes.filter(tb => {
        const pageIndex = tb.pageIndex !== undefined ? tb.pageIndex : 0;
        return !pagesToDelete.has(pageIndex);
      }).map(tb => {
        const pageIndex = tb.pageIndex !== undefined ? tb.pageIndex : 0;
        // Uppdatera pageIndex för element efter borttagna sidor
        let newPageIndex = pageIndex;
        for (const deletedPage of sortedPages) {
          const deletedIndex = deletedPage - 1;
          if (pageIndex > deletedIndex) {
            newPageIndex--;
          }
        }
        return { ...tb, pageIndex: newPageIndex };
      });

      const newWhiteoutBoxes = whiteoutBoxes.filter(wb => {
        const pageIndex = wb.pageIndex !== undefined ? wb.pageIndex : 0;
        return !pagesToDelete.has(pageIndex);
      }).map(wb => {
        const pageIndex = wb.pageIndex !== undefined ? wb.pageIndex : 0;
        let newPageIndex = pageIndex;
        for (const deletedPage of sortedPages) {
          const deletedIndex = deletedPage - 1;
          if (pageIndex > deletedIndex) {
            newPageIndex--;
          }
        }
        return { ...wb, pageIndex: newPageIndex };
      });

      const newPatchBoxes = patchBoxes.filter(pb => {
        const pageIndex = pb.pageIndex !== undefined ? pb.pageIndex : 0;
        const sourcePageIndex = pb.sourcePageIndex !== undefined ? pb.sourcePageIndex : 0;
        return !pagesToDelete.has(pageIndex) && !pagesToDelete.has(sourcePageIndex);
      }).map(pb => {
        const pageIndex = pb.pageIndex !== undefined ? pb.pageIndex : 0;
        const sourcePageIndex = pb.sourcePageIndex !== undefined ? pb.sourcePageIndex : 0;
        let newPageIndex = pageIndex;
        let newSourcePageIndex = sourcePageIndex;
        for (const deletedPage of sortedPages) {
          const deletedIndex = deletedPage - 1;
          if (pageIndex > deletedIndex) {
            newPageIndex--;
          }
          if (sourcePageIndex > deletedIndex) {
            newSourcePageIndex--;
          }
        }
        return { ...pb, pageIndex: newPageIndex, sourcePageIndex: newSourcePageIndex };
      });

      const newShapeBoxes = shapeBoxes.filter(sb => {
        const pageIndex = sb.pageIndex !== undefined ? sb.pageIndex : 0;
        return !pagesToDelete.has(pageIndex);
      }).map(sb => {
        const pageIndex = sb.pageIndex !== undefined ? sb.pageIndex : 0;
        let newPageIndex = pageIndex;
        for (const deletedPage of sortedPages) {
          const deletedIndex = deletedPage - 1;
          if (pageIndex > deletedIndex) {
            newPageIndex--;
          }
        }
        return { ...sb, pageIndex: newPageIndex };
      });

      const newCommentBoxes = commentBoxes.filter(cb => {
        const pageIndex = cb.pageIndex !== undefined ? cb.pageIndex : 0;
        return !pagesToDelete.has(pageIndex);
      }).map(cb => {
        const pageIndex = cb.pageIndex !== undefined ? cb.pageIndex : 0;
        let newPageIndex = pageIndex;
        for (const deletedPage of sortedPages) {
          const deletedIndex = deletedPage - 1;
          if (pageIndex > deletedIndex) {
            newPageIndex--;
          }
        }
        return { ...cb, pageIndex: newPageIndex };
      });

      const newHighlightStrokes = highlightStrokes.filter(st => {
        const pageIndex = st.pageIndex !== undefined ? st.pageIndex : 0;
        return !pagesToDelete.has(pageIndex);
      }).map(st => {
        const pageIndex = st.pageIndex !== undefined ? st.pageIndex : 0;
        let newPageIndex = pageIndex;
        for (const deletedPage of sortedPages) {
          const deletedIndex = deletedPage - 1;
          if (pageIndex > deletedIndex) {
            newPageIndex--;
          }
        }
        return { ...st, pageIndex: newPageIndex };
      });

      // Spara modifierad PDF
      const modifiedPdfBytes = await pdfLibDoc.save();
      const stateBytes = new Uint8Array(modifiedPdfBytes);
      const pdfJsBytes = new Uint8Array(modifiedPdfBytes);

      // Ladda om med PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: pdfJsBytes });
      const newDoc = await loadingTask.promise;
      
      setPdfData(stateBytes.buffer.slice(0));
      setPdfDoc(newDoc);
      setPdfPages([]);
      setPageViewports([]);
      canvasRefs.current = {};
      pageContainerRefs.current = {};
      setTextBoxes(newTextBoxes);
      setWhiteoutBoxes(newWhiteoutBoxes);
      setPatchBoxes(newPatchBoxes);
      setShapeBoxes(newShapeBoxes);
      setCommentBoxes(newCommentBoxes);
      setHighlightStrokes(newHighlightStrokes);
      
      // Uppdatera currentPage
      const maxPage = Math.max(1, newDoc.numPages);
      if (currentPage > maxPage || sortedPages.includes(currentPage)) {
        setCurrentPage(Math.min(currentPage, maxPage));
      }

      // Spara till history
      saveToHistory(newTextBoxes, newWhiteoutBoxes, newPatchBoxes, newShapeBoxes, newCommentBoxes, newHighlightStrokes);

      success(t('success.pagesDeleted', { count: pageNumbers.length }, `${pageNumbers.length} sida/sidor borttagna`));
    } catch (err) {
      console.error('Fel vid borttagning av sidor:', err);
      error(t('errors.deleteFailed', 'Borttagning misslyckades') + ': ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const remapPageIndex = (idx, map) => {
    const safe = (idx === undefined || idx === null) ? 0 : idx;
    return map[safe] ?? safe;
  };

  const handleMovePages = async (pageNumbers, direction) => {
    if (!pdfDoc || !pdfData || !pageNumbers?.length) return;
    if (direction !== 'up' && direction !== 'down') return;

    const numPages = pdfDoc.numPages;
    if (numPages <= 1) return;

    setIsLoading(true);
    setLoadingMessage(t('loading.movingPages', 'Flyttar sidor...'));

    try {
      const selectedPositions = new Set(pageNumbers.map(p => p - 1).filter(i => i >= 0 && i < numPages));
      if (selectedPositions.size === 0) return;

      // Bygg ny ordning (array av gamla index i ny ordning)
      const order = Array.from({ length: numPages }, (_, i) => i);
      const posSelected = Array.from({ length: numPages }, (_, i) => selectedPositions.has(i));

      if (direction === 'up') {
        for (let pos = 1; pos < numPages; pos++) {
          if (posSelected[pos] && !posSelected[pos - 1]) {
            // swap pos-1 <-> pos
            [order[pos - 1], order[pos]] = [order[pos], order[pos - 1]];
            [posSelected[pos - 1], posSelected[pos]] = [posSelected[pos], posSelected[pos - 1]];
          }
        }
      } else {
        for (let pos = numPages - 2; pos >= 0; pos--) {
          if (posSelected[pos] && !posSelected[pos + 1]) {
            [order[pos + 1], order[pos]] = [order[pos], order[pos + 1]];
            [posSelected[pos + 1], posSelected[pos]] = [posSelected[pos], posSelected[pos + 1]];
          }
        }
      }

      // Om ordningen inte förändrades, gör inget
      const isSame = order.every((v, i) => v === i);
      if (isSame) return;

      // Kopiera PDF-data säkert (hantera detached ArrayBuffer)
      let pdfDataCopy;
      try {
        const uint8Array = new Uint8Array(pdfData);
        pdfDataCopy = uint8Array.slice().buffer;
      } catch (error) {
        console.warn('PDF data är detached, exporterar för att få frisk kopia...');
        const exportedBytes = await exportPDF(pdfData, textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, highlightStrokes);
        pdfDataCopy = exportedBytes.buffer.slice(0);
      }

      const srcDoc = await PDFDocument.load(pdfDataCopy, {
        ignoreEncryption: true,
        updateMetadata: false,
        parseSpeed: 0
      });
      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcDoc, order);
      copiedPages.forEach((p) => newPdf.addPage(p));

      const modifiedPdfBytes = await newPdf.save();
      const stateBytes = new Uint8Array(modifiedPdfBytes);
      const pdfJsBytes = new Uint8Array(modifiedPdfBytes);

      const loadingTask = pdfjsLib.getDocument({ data: pdfJsBytes });
      const newDoc = await loadingTask.promise;

      // Remap oldIndex -> newIndex
      const map = new Array(numPages);
      for (let newPos = 0; newPos < order.length; newPos++) {
        map[order[newPos]] = newPos;
      }

      const newTextBoxes = textBoxes.map(tb => ({ ...tb, pageIndex: remapPageIndex(tb.pageIndex, map) }));
      const newWhiteoutBoxes = whiteoutBoxes.map(wb => ({ ...wb, pageIndex: remapPageIndex(wb.pageIndex, map) }));
      const newShapeBoxes = shapeBoxes.map(sb => ({ ...sb, pageIndex: remapPageIndex(sb.pageIndex, map) }));
      const newCommentBoxes = commentBoxes.map(cb => ({ ...cb, pageIndex: remapPageIndex(cb.pageIndex, map) }));
      const newHighlightStrokes = highlightStrokes.map(st => ({ ...st, pageIndex: remapPageIndex(st.pageIndex, map) }));
      const newPatchBoxes = patchBoxes.map(pb => ({
        ...pb,
        pageIndex: remapPageIndex(pb.pageIndex, map),
        sourcePageIndex: remapPageIndex(pb.sourcePageIndex, map)
      }));

      setPdfData(stateBytes.buffer.slice(0));
      setPdfDoc(newDoc);
      setPdfPages([]);
      setPageViewports([]);
      canvasRefs.current = {};
      pageContainerRefs.current = {};

      setTextBoxes(newTextBoxes);
      setWhiteoutBoxes(newWhiteoutBoxes);
      setPatchBoxes(newPatchBoxes);
      setShapeBoxes(newShapeBoxes);
      setCommentBoxes(newCommentBoxes);
      setHighlightStrokes(newHighlightStrokes);

      // Behåll samma "innehållssida" i fokus
      const oldCurrent = (currentPageRef.current || currentPage) - 1;
      const newCurrent = (map[oldCurrent] ?? 0) + 1;
      currentPageRef.current = newCurrent;
      setCurrentPage(newCurrent);

      saveToHistory(newTextBoxes, newWhiteoutBoxes, newPatchBoxes, newShapeBoxes, newCommentBoxes, newHighlightStrokes);
      success(t('success.pagesMoved', 'Sidor flyttade'));
    } catch (err) {
      console.error('Fel vid flytt av sidor:', err);
      error(t('errors.movePagesFailed', 'Flytt av sidor misslyckades') + ': ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDuplicatePages = async (pageNumbers) => {
    if (!pdfDoc || !pdfData || !pageNumbers?.length) return;

    const numPages = pdfDoc.numPages;
    setIsLoading(true);
    setLoadingMessage(t('loading.duplicatingPages', 'Duplicerar sidor...'));

    try {
      const selected = new Set(pageNumbers.map(p => p - 1).filter(i => i >= 0 && i < numPages));
      if (selected.size === 0) return;

      // Ny ordning: lägg in duplikat direkt efter original
      const order = [];
      const originalNewIndex = new Array(numPages);
      const duplicateNewIndex = new Array(numPages).fill(null);
      for (let old = 0; old < numPages; old++) {
        originalNewIndex[old] = order.length;
        order.push(old);
        if (selected.has(old)) {
          duplicateNewIndex[old] = order.length;
          order.push(old);
        }
      }

      // Kopiera PDF-data säkert (hantera detached ArrayBuffer)
      let pdfDataCopy;
      try {
        const uint8Array = new Uint8Array(pdfData);
        pdfDataCopy = uint8Array.slice().buffer;
      } catch (error) {
        console.warn('PDF data är detached, exporterar för att få frisk kopia...');
        const exportedBytes = await exportPDF(pdfData, textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, highlightStrokes);
        pdfDataCopy = exportedBytes.buffer.slice(0);
      }

      const srcDoc = await PDFDocument.load(pdfDataCopy, {
        ignoreEncryption: true,
        updateMetadata: false,
        parseSpeed: 0
      });
      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcDoc, order);
      copiedPages.forEach((p) => newPdf.addPage(p));

      const modifiedPdfBytes = await newPdf.save();
      const stateBytes = new Uint8Array(modifiedPdfBytes);
      const pdfJsBytes = new Uint8Array(modifiedPdfBytes);

      const loadingTask = pdfjsLib.getDocument({ data: pdfJsBytes });
      const newDoc = await loadingTask.promise;

      const mapOrig = (idx) => originalNewIndex[(idx === undefined || idx === null) ? 0 : idx];
      const mapDup = (idx) => duplicateNewIndex[(idx === undefined || idx === null) ? 0 : idx];

      // Remappa original
      const remapOriginal = (arr, key = 'pageIndex') => arr.map(item => ({ ...item, [key]: mapOrig(item[key]) }));
      const newTextBoxes = remapOriginal(textBoxes, 'pageIndex');
      const newWhiteoutBoxes = remapOriginal(whiteoutBoxes, 'pageIndex');
      const newShapeBoxes = remapOriginal(shapeBoxes, 'pageIndex');
      const newCommentBoxes = remapOriginal(commentBoxes, 'pageIndex');
      const newHighlightStrokes = remapOriginal(highlightStrokes, 'pageIndex');
      const newPatchBoxes = patchBoxes.map(pb => ({
        ...pb,
        pageIndex: mapOrig(pb.pageIndex),
        sourcePageIndex: mapOrig(pb.sourcePageIndex)
      }));

      // Klona för duplicerade sidor
      const extraText = textBoxes
        .filter(tb => selected.has((tb.pageIndex ?? 0)))
        .map(tb => ({ ...JSON.parse(JSON.stringify(tb)), pageIndex: mapDup(tb.pageIndex) }));
      const extraWhiteout = whiteoutBoxes
        .filter(wb => selected.has((wb.pageIndex ?? 0)))
        .map(wb => ({ ...JSON.parse(JSON.stringify(wb)), pageIndex: mapDup(wb.pageIndex) }));
      const extraShapes = shapeBoxes
        .filter(sb => selected.has((sb.pageIndex ?? 0)))
        .map(sb => ({ ...JSON.parse(JSON.stringify(sb)), pageIndex: mapDup(sb.pageIndex) }));
      const extraComments = commentBoxes
        .filter(cb => selected.has((cb.pageIndex ?? 0)))
        .map(cb => ({ ...JSON.parse(JSON.stringify(cb)), pageIndex: mapDup(cb.pageIndex) }));
      const extraStrokes = highlightStrokes
        .filter(st => selected.has((st.pageIndex ?? 0)))
        .map(st => ({ ...JSON.parse(JSON.stringify(st)), pageIndex: mapDup(st.pageIndex) }));
      const extraPatches = patchBoxes
        .filter(pb => selected.has((pb.pageIndex ?? 0)))
        .map(pb => {
          const clone = JSON.parse(JSON.stringify(pb));
          clone.pageIndex = mapDup(pb.pageIndex);
          const srcOld = (pb.sourcePageIndex ?? 0);
          clone.sourcePageIndex = selected.has(srcOld) ? mapDup(srcOld) : mapOrig(srcOld);
          return clone;
        });

      const finalTextBoxes = [...newTextBoxes, ...extraText];
      const finalWhiteoutBoxes = [...newWhiteoutBoxes, ...extraWhiteout];
      const finalShapeBoxes = [...newShapeBoxes, ...extraShapes];
      const finalCommentBoxes = [...newCommentBoxes, ...extraComments];
      const finalHighlightStrokes = [...newHighlightStrokes, ...extraStrokes];
      const finalPatchBoxes = [...newPatchBoxes, ...extraPatches];

      setPdfData(stateBytes.buffer.slice(0));
      setPdfDoc(newDoc);
      setPdfPages([]);
      setPageViewports([]);
      canvasRefs.current = {};
      pageContainerRefs.current = {};

      setTextBoxes(finalTextBoxes);
      setWhiteoutBoxes(finalWhiteoutBoxes);
      setPatchBoxes(finalPatchBoxes);
      setShapeBoxes(finalShapeBoxes);
      setCommentBoxes(finalCommentBoxes);
      setHighlightStrokes(finalHighlightStrokes);

      saveToHistory(finalTextBoxes, finalWhiteoutBoxes, finalPatchBoxes, finalShapeBoxes, finalCommentBoxes, finalHighlightStrokes);
      success(t('success.pagesDuplicated', 'Sidor duplicerade'));
    } catch (err) {
      console.error('Fel vid duplicering av sidor:', err);
      error(t('errors.duplicatePagesFailed', 'Duplicering misslyckades') + ': ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Lägg till sidor
  const handleAddPage = async (type, file = null) => {
    if (!pdfDoc || !pdfData) return;

    setIsLoading(true);
    setLoadingMessage(t('loading.addingPage', 'Lägger till sida...'));

    try {
      // Kopiera PDF-data säkert (hantera detached ArrayBuffer)
      let pdfDataCopy;
      try {
        const uint8Array = new Uint8Array(pdfData);
        pdfDataCopy = uint8Array.slice().buffer;
      } catch (error) {
        // Om ArrayBuffer är detached, exportera PDF:en från pdfDoc för att få en frisk kopia
        console.warn('PDF data är detached, exporterar från pdfDoc...');
        const exportedBytes = await exportPDFFromPdfDoc(pdfDoc);
        pdfDataCopy = exportedBytes.buffer.slice(0);
      }

      // Ladda PDF med pdf-lib
      const pdfLibDoc = await PDFDocument.load(pdfDataCopy, { 
        ignoreEncryption: true,
        updateMetadata: false,
        parseSpeed: 0
      });

      if (type === 'blank') {
        // Lägg till tom sida med samma storlek som första sidan
        const firstPage = pdfLibDoc.getPage(0);
        const { width, height } = firstPage.getSize();
        pdfLibDoc.addPage([width, height]);
      } else if (type === 'fromFile' && file) {
        // Lägg till sidor från en annan PDF-fil
        const fileData = await loadPDF(file);
        const sourcePdf = await PDFDocument.load(fileData, { 
          ignoreEncryption: true,
          updateMetadata: false,
          parseSpeed: 0
        });
        
        const sourcePages = await pdfLibDoc.copyPages(sourcePdf, sourcePdf.getPageIndices());
        sourcePages.forEach((page) => {
          pdfLibDoc.addPage(page);
        });
      }

      // Spara modifierad PDF
      const modifiedPdfBytes = await pdfLibDoc.save();
      const stateBytes = new Uint8Array(modifiedPdfBytes);
      const pdfJsBytes = new Uint8Array(modifiedPdfBytes);

      // Ladda om med PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: pdfJsBytes });
      const newDoc = await loadingTask.promise;
      
      setPdfData(stateBytes.buffer.slice(0));
      setPdfDoc(newDoc);
      setPdfPages([]);
      setPageViewports([]);
      canvasRefs.current = {};
      pageContainerRefs.current = {};

      success(t('success.pageAdded', 'Sida tillagd'));
    } catch (err) {
      console.error('Fel vid tillägg av sida:', err);
      error(t('errors.addPageFailed', 'Tillägg av sida misslyckades') + ': ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleExport = async () => {
    if (!pdfDoc || !pdfData) {
      error(t('errors.noPdfLoaded', 'Ingen PDF laddad'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('loading.exporting', 'Exporterar PDF...'));
    
    try {
      const exported = await exportPDF(pdfData, textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, highlightStrokes);
      const blob = new Blob([exported], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'redigerad.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success(t('success.exported', 'PDF exporterad framgångsrikt'));
    } catch (err) {
      console.error('Fel vid export:', err);
      error(t('errors.exportFailed', 'Export misslyckades') + ': ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDownload = async (format, filename) => {
    if (!pdfDoc || !pdfData) {
      error(t('errors.noPdfLoaded', 'Ingen PDF laddad'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('loading.exporting', 'Exporterar fil...'));
    
    try {
      let result;
      
      switch (format) {
        case 'pdf':
          result = await exportAsPDF(pdfData, textBoxes, whiteoutBoxes, patchBoxes, shapeBoxes, highlightStrokes);
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.${result.extension}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          break;

        case 'png':
        case 'jpg':
          setLoadingMessage(t('loading.exportingImages', 'Exporterar bilder...'));
          const imageExport = format === 'png' 
            ? await exportAsPNG(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes)
            : await exportAsJPG(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes);
          
          for (const { dataUrl, pageNum } of imageExport.pages) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${filename}_${pageNum}.${imageExport.extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          break;

        case 'excel':
          result = await exportAsExcel(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes);
          const excelUrl = URL.createObjectURL(result.blob);
          const excelLink = document.createElement('a');
          excelLink.href = excelUrl;
          excelLink.download = `${filename}.${result.extension}`;
          document.body.appendChild(excelLink);
          excelLink.click();
          document.body.removeChild(excelLink);
          URL.revokeObjectURL(excelUrl);
          break;

        case 'word':
          result = await exportAsWord(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes);
          const wordUrl = URL.createObjectURL(result.blob);
          const wordLink = document.createElement('a');
          wordLink.href = wordUrl;
          wordLink.download = `${filename}.${result.extension}`;
          document.body.appendChild(wordLink);
          wordLink.click();
          document.body.removeChild(wordLink);
          URL.revokeObjectURL(wordUrl);
          break;

        case 'pptx':
          result = await exportAsPPTX(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes);
          const pptxUrl = URL.createObjectURL(result.blob);
          const pptxLink = document.createElement('a');
          pptxLink.href = pptxUrl;
          pptxLink.download = `${filename}.${result.extension}`;
          document.body.appendChild(pptxLink);
          pptxLink.click();
          document.body.removeChild(pptxLink);
          URL.revokeObjectURL(pptxUrl);
          break;

        default:
          error(t('errors.unknownFormat', 'Okänt filformat'));
          return;
      }
      success(t('success.downloaded', 'Fil nedladdad framgångsrikt'));
    } catch (err) {
      console.error('Fel vid nedladdning:', err);
      error(t('errors.exportFailed', 'Export misslyckades') + ': ' + err.message);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };


  // Visa landing page om ingen PDF är laddad
  if (!pdfDoc) {
    return <LandingPage onFileSelect={handleFileSelect} onCreateNew={handleCreateNewPdf} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      {/* Toolbar - Går hela vägen från vänster till höger */}
      <div style={{
        padding: '10px',
        backgroundColor: '#1a1a1a',
        borderBottom: '2px solid #ff6b35',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap',
        zIndex: 20,
        position: 'relative'
      }}>
        <button
          onClick={() => {
            setPdfDoc(null);
            setPdfData(null);
            setTextBoxes([]);
            setWhiteoutBoxes([]);
            setPatchBoxes([]);
            setShapeBoxes([]);
            setHistory([]);
            setHistoryIndex(-1);
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #555',
            cursor: 'pointer',
            borderRadius: '5px',
            marginRight: '10px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#333';
          }}
        >
          ← {t('toolbar.newPdf')}
        </button>
        
        <button
          onClick={() => {
            // Växla verktyget av/on
            if (tool === 'text') {
              setTool(null);
            } else {
              setTool('text');
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'text' ? '#ff6b35' : '#333',
            color: '#fff',
            border: tool === 'text' ? '1px solid #ff6b35' : '1px solid #555',
            cursor: 'pointer',
            borderRadius: '5px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (tool !== 'text') {
              e.currentTarget.style.backgroundColor = '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (tool !== 'text') {
              e.currentTarget.style.backgroundColor = '#333';
            }
          }}
        >
          {t('toolbar.addText')}
        </button>
        
        <button
          onClick={() => {
            if (tool === 'edit-text') {
              setTool(null);
              setHoveredTextBoxIndex(null);
            } else {
              setTool('edit-text');
              setSelectedElement(null);
              setSelectedType(null);
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'edit-text' ? '#ff6b35' : '#333',
            color: '#fff',
            border: tool === 'edit-text' ? '1px solid #ff6b35' : '1px solid #555',
            cursor: 'pointer',
            borderRadius: '5px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (tool !== 'edit-text') {
              e.currentTarget.style.backgroundColor = '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (tool !== 'edit-text') {
              e.currentTarget.style.backgroundColor = '#333';
            }
          }}
        >
          {t('toolbar.editText', 'Redigera text')}
        </button>
        
        <button
          onClick={() => {
            // Växla verktyget av/on
            if (tool === 'whiteout') {
              setTool(null);
              // Avmarkera whiteout-rutor när verktyget stängs av
              if (selectedType === 'whiteout') {
                setSelectedElement(null);
                setSelectedType(null);
              }
            } else {
              setTool('whiteout');
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'whiteout' ? '#ff6b35' : '#333',
            color: '#fff',
            border: tool === 'whiteout' ? '1px solid #ff6b35' : '1px solid #555',
            cursor: 'pointer',
            borderRadius: '5px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (tool !== 'whiteout') {
              e.currentTarget.style.backgroundColor = '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (tool !== 'whiteout') {
              e.currentTarget.style.backgroundColor = '#333';
            }
          }}
        >
          {t('toolbar.whiteout')}
        </button>
        
        <button
          onClick={() => {
            // Växla verktyget av/on
            if (tool === 'comment') {
              setTool(null);
              // Avmarkera kommentarer när verktyget stängs av
              if (selectedType === 'comment') {
                setSelectedElement(null);
                setSelectedType(null);
              }
            } else {
              setTool('comment');
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'comment' ? '#ff6b35' : '#333',
            color: '#fff',
            border: tool === 'comment' ? '1px solid #ff6b35' : '1px solid #555',
            cursor: 'pointer',
            borderRadius: '5px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (tool !== 'comment') {
              e.currentTarget.style.backgroundColor = '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (tool !== 'comment') {
              e.currentTarget.style.backgroundColor = '#333';
            }
          }}
        >
          {t('toolbar.comment', 'Kommentar')}
        </button>
        
        <button
          onClick={() => {
            // Växla verktyget av/on
            if (tool === 'patch') {
              setTool(null);
              setPatchMode('select');
              setSourceRect(null);
              setSourcePageIndex(null);
              // Avmarkera patch-rutor när verktyget stängs av
              if (selectedType === 'patch') {
                setSelectedElement(null);
                setSelectedType(null);
              }
            } else {
              setTool('patch');
              setPatchMode('select');
              setSourceRect(null);
              setSourcePageIndex(null);
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'patch' ? '#ff6b35' : '#333',
            color: '#fff',
            border: tool === 'patch' ? '1px solid #ff6b35' : '1px solid #555',
            cursor: 'pointer',
            borderRadius: '5px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (tool !== 'patch') {
              e.currentTarget.style.backgroundColor = '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (tool !== 'patch') {
              e.currentTarget.style.backgroundColor = '#333';
            }
          }}
        >
          {t('toolbar.copyArea')} {patchMode === 'select' ? t('toolbar.selectArea') : t('toolbar.place')}
        </button>

        <button
          onClick={() => {
            // Växla verktyget av/on
            if (tool === 'image') {
              setTool(null);
              setPendingImageData(null);
              return;
            }
            handleSelectImageFile();
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'image' ? '#ff6b35' : '#333',
            color: '#fff',
            border: tool === 'image' ? '1px solid #ff6b35' : '1px solid #555',
            cursor: 'pointer',
            borderRadius: '5px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (tool !== 'image') {
              e.currentTarget.style.backgroundColor = '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (tool !== 'image') {
              e.currentTarget.style.backgroundColor = '#333';
            }
          }}
          title={pendingImageData ? t('toolbar.imageReady', 'Dra för att placera bilden') : t('toolbar.imageHint', 'Välj en bild (PNG/JPG) och placera på sidan')}
        >
          {t('toolbar.image', 'Bild')}
        </button>

        {/* Highlight verktyg */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => {
              const next = tool === 'highlight' ? null : 'highlight';
              setTool(next);
              if (next) setHighlightMode('rect');
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: tool === 'highlight' ? '#ff6b35' : '#333',
              color: '#fff',
              border: tool === 'highlight' ? '1px solid #ff6b35' : '1px solid #555',
              cursor: 'pointer',
              borderRadius: '5px',
              transition: 'all 0.2s ease'
            }}
          >
            {t('toolbar.highlightRect', 'Highlight')}
          </button>
          {/* Övriga highlight-inställningar flyttas till highlight-sidebar */}
        </div>

        {/* Shape Tools - Dropdown */}
        <div style={{ position: 'relative', display: 'inline-block' }} data-shape-type-dropdown>
          <button
            onClick={() => {
              const isShapeTool = tool && tool.startsWith('shape');
              if (isShapeTool) {
                // Växla dropdown om shape-verktyget redan är aktivt
                setShowShapeTypeDropdown(!showShapeTypeDropdown);
              } else {
                // Aktivera shape-verktyget och visa dropdown
                setTool(`shape-${shapeSettings.type}`);
                setShowShapeTypeDropdown(true);
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: tool && tool.startsWith('shape') ? '#ff6b35' : '#333',
              color: '#fff',
              border: tool && tool.startsWith('shape') ? '1px solid #ff6b35' : '1px solid #555',
              cursor: 'pointer',
              borderRadius: '5px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!(tool && tool.startsWith('shape'))) {
                e.currentTarget.style.backgroundColor = '#444';
              }
            }}
            onMouseLeave={(e) => {
              if (!(tool && tool.startsWith('shape'))) {
                e.currentTarget.style.backgroundColor = '#333';
              }
            }}
          >
            {t('toolbar.shapes')}
            {tool && tool.startsWith('shape') && (
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                ({t(`toolbar.${shapeSettings.type}`)})
              </span>
            )}
          </button>
          
          {/* Shape Type Dropdown - Visas när showShapeTypeDropdown är true */}
          {tool && tool.startsWith('shape') && showShapeTypeDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '5px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #555',
                borderRadius: '5px',
                padding: '5px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                minWidth: '150px'
              }}
            >
              {['rectangle', 'circle', 'line', 'arrow'].map((shapeType) => (
                <button
                  key={shapeType}
                  onClick={() => {
                    setShapeSettings({ ...shapeSettings, type: shapeType });
                    setTool(`shape-${shapeType}`);
                    setShowShapeTypeDropdown(false); // Stäng dropdown när man väljer en form-typ
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: shapeSettings.type === shapeType ? '#ff6b35' : '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (shapeSettings.type !== shapeType) {
                      e.currentTarget.style.backgroundColor = '#444';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (shapeSettings.type !== shapeType) {
                      e.currentTarget.style.backgroundColor = '#333';
                    }
                  }}
                >
                  {t(`toolbar.${shapeType}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            // Växla pan-verktyget av/on
            if (tool === 'pan') {
              setTool(null);
            } else {
              setTool('pan');
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'pan' ? '#ff6b35' : '#333',
            color: '#fff',
            border: tool === 'pan' ? '1px solid #ff6b35' : '1px solid #555',
            cursor: 'pointer',
            borderRadius: '5px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (tool !== 'pan') {
              e.currentTarget.style.backgroundColor = '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (tool !== 'pan') {
              e.currentTarget.style.backgroundColor = '#333';
            }
          }}
        >
          {t('toolbar.pan')}
        </button>

        {/* Eraser tool */}
        <button
          onClick={() => {
            if (tool === 'eraser') {
              setTool(null);
            } else {
              setTool('eraser');
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: tool === 'eraser' ? '#ff6b35' : '#333',
            color: '#fff',
            border: tool === 'eraser' ? '1px solid #ff6b35' : '1px solid #555',
            cursor: 'pointer',
            borderRadius: '5px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (tool !== 'eraser') {
              e.currentTarget.style.backgroundColor = '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (tool !== 'eraser') {
              e.currentTarget.style.backgroundColor = '#333';
            }
          }}
        >
          {t('toolbar.eraser', 'Eraser')}
        </button>

        {selectedElement !== null && (
          <button
            onClick={handleDelete}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff4444',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '5px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ff6666';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff4444';
            }}
          >
            {t('toolbar.delete')}
          </button>
        )}

        {/* Undo/Redo knappar */}
        <div style={{ marginLeft: '10px', display: 'flex', gap: '5px' }}>
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            style={{
              padding: '8px 16px',
              backgroundColor: historyIndex <= 0 ? '#333' : '#444',
              color: '#fff',
              border: '1px solid #555',
              cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
              opacity: historyIndex <= 0 ? 0.5 : 1,
              borderRadius: '5px',
              transition: 'all 0.2s ease'
            }}
            title={t('tooltips.undo')}
            onMouseEnter={(e) => {
              if (historyIndex > 0) {
                e.currentTarget.style.backgroundColor = '#555';
              }
            }}
            onMouseLeave={(e) => {
              if (historyIndex > 0) {
                e.currentTarget.style.backgroundColor = '#444';
              }
            }}
          >
            ↶ {t('toolbar.undo')}
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            style={{
              padding: '8px 16px',
              backgroundColor: historyIndex >= history.length - 1 ? '#333' : '#444',
              color: '#fff',
              border: '1px solid #555',
              cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
              opacity: historyIndex >= history.length - 1 ? 0.5 : 1,
              borderRadius: '5px',
              transition: 'all 0.2s ease'
            }}
            title={t('tooltips.redo')}
            onMouseEnter={(e) => {
              if (historyIndex < history.length - 1) {
                e.currentTarget.style.backgroundColor = '#555';
              }
            }}
            onMouseLeave={(e) => {
              if (historyIndex < history.length - 1) {
                e.currentTarget.style.backgroundColor = '#444';
              }
            }}
          >
            ↷ {t('toolbar.redo')}
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center', color: '#fff' }}>
          {/* Page layout dropdown */}
          {pdfDoc && (
            <div ref={pageLayoutMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPageLayoutMenu(v => !v)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: showPageLayoutMenu ? '#5a6268' : '#6c757d',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!showPageLayoutMenu) {
                    e.currentTarget.style.backgroundColor = '#5a6268';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showPageLayoutMenu) {
                    e.currentTarget.style.backgroundColor = '#6c757d';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
                title={t('toolbar.pageLayout', 'Sidlayout')}
              >
                {t('toolbar.pageLayout', 'Sidlayout')}
              </button>

              {showPageLayoutMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '44px',
                    right: 0,
                    width: '320px',
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                    overflow: 'hidden',
                    zIndex: 2000
                  }}
                >
                  <div style={{ padding: '14px 14px 10px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#333' }}>
                      {t('toolbar.pageLayout', 'Sidlayout')}
                    </div>
                  </div>

                  {/* Page Mode */}
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '10px' }}>
                      {t('toolbar.pageMode', 'Sidläge')}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setPageLayoutMode('single')}
                        style={{
                          flex: 1,
                          padding: '10px 10px',
                          borderRadius: '8px',
                          border: pageLayoutMode === 'single' ? '2px solid #0066ff' : '1px solid #ddd',
                          backgroundColor: pageLayoutMode === 'single' ? 'rgba(0,102,255,0.08)' : '#fff',
                          cursor: 'pointer'
                        }}
                        title={t('toolbar.layoutSingle', 'En sida')}
                      >
                        <div style={{ width: '34px', height: '26px', margin: '0 auto 8px auto', borderRadius: '4px', border: '2px solid #2a2a2a' }} />
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#333' }}>{t('toolbar.layoutSingle', 'En sida')}</div>
                      </button>

                      <button
                        onClick={() => setPageLayoutMode('double')}
                        style={{
                          flex: 1,
                          padding: '10px 10px',
                          borderRadius: '8px',
                          border: pageLayoutMode === 'double' ? '2px solid #0066ff' : '1px solid #ddd',
                          backgroundColor: pageLayoutMode === 'double' ? 'rgba(0,102,255,0.08)' : '#fff',
                          cursor: 'pointer'
                        }}
                        title={t('toolbar.layoutDouble', 'Två sidor')}
                      >
                        <div style={{ display: 'flex', gap: '6px', width: '74px', margin: '0 auto 8px auto' }}>
                          <div style={{ flex: 1, height: '26px', borderRadius: '4px', border: '2px solid #2a2a2a' }} />
                          <div style={{ flex: 1, height: '26px', borderRadius: '4px', border: '2px solid #2a2a2a' }} />
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#333' }}>{t('toolbar.layoutDouble', 'Två sidor')}</div>
                      </button>

                      <button
                        onClick={() => setPageLayoutMode('auto')}
                        style={{
                          flex: 1,
                          padding: '10px 10px',
                          borderRadius: '8px',
                          border: pageLayoutMode === 'auto' ? '2px solid #0066ff' : '1px solid #ddd',
                          backgroundColor: pageLayoutMode === 'auto' ? 'rgba(0,102,255,0.08)' : '#fff',
                          cursor: 'pointer'
                        }}
                        title={t('toolbar.layoutAuto', 'Auto')}
                      >
                        <div style={{ width: '34px', height: '26px', margin: '0 auto 8px auto', borderRadius: '4px', border: '2px dashed #2a2a2a' }} />
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#333' }}>{t('toolbar.layoutAuto', 'Auto')}</div>
                      </button>
                    </div>

                    {pageLayoutMode === 'auto' && (
                      <div style={{ marginTop: '10px', fontSize: '11px', color: '#666' }}>
                        {t('toolbar.layoutAutoHint', 'Auto växlar mellan en/två sidor beroende på bredd.')}
                      </div>
                    )}
                  </div>

                  {/* Page Transition */}
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '10px' }}>
                      {t('toolbar.pageTransition', 'Sidövergång')}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setNavMode('scroll')}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: navMode === 'scroll' ? '2px solid #0066ff' : '1px solid #ddd',
                          backgroundColor: navMode === 'scroll' ? 'rgba(0,102,255,0.08)' : '#fff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#333'
                        }}
                      >
                        {t('toolbar.navScroll', 'Scroll')}
                      </button>
                      <button
                        onClick={() => setNavMode('paged')}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: navMode === 'paged' ? '2px solid #0066ff' : '1px solid #ddd',
                          backgroundColor: navMode === 'paged' ? 'rgba(0,102,255,0.08)' : '#fff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#333'
                        }}
                      >
                        {t('toolbar.navPaged', 'Sida')}
                      </button>
                    </div>
                  </div>

                  {/* Page Rotation */}
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '10px' }}>
                      {t('toolbar.pageRotation', 'Sidrotation')}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleRotatePages([currentPage], 270)}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #ddd',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#333'
                        }}
                        title={t('toolbar.rotateLeft', 'Rotera vänster')}
                      >
                        ⟲ {t('toolbar.rotateLeft', 'Rotera vänster')}
                      </button>
                      <button
                        onClick={() => handleRotatePages([currentPage], 90)}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #ddd',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#333'
                        }}
                        title={t('toolbar.rotateRight', 'Rotera höger')}
                      >
                        ⟳ {t('toolbar.rotateRight', 'Rotera höger')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Language Switcher */}
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            style={{
              padding: '6px 10px',
              backgroundColor: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            <option value="en">EN</option>
            <option value="sv">SV</option>
          </select>
          
          <label htmlFor="zoom-range" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {t('toolbar.zoom')}:
            <input
              id="zoom-range"
              name="zoom"
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{ 
                marginLeft: '5px',
                accentColor: '#ff6b35'
              }}
            />
            <span style={{ minWidth: '50px', textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
          </label>

          {pdfDoc && (
            <>
              <button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  currentPageRef.current = newPage;
                  setCurrentPage(newPage);
                  // Scrolla till sidan
                  scrollToPage(newPage);
                }}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 16px',
                  backgroundColor: currentPage === 1 ? '#333' : '#444',
                  color: '#fff',
                  border: '1px solid #555',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  borderRadius: '5px',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                {t('toolbar.previous')}
              </button>
              <span style={{ color: '#fff', padding: '0 10px' }}>{t('toolbar.page')} {currentPage} {t('toolbar.of')} {pdfDoc.numPages}</span>
              <button
                onClick={() => {
                  const newPage = Math.min(pdfDoc.numPages, currentPage + 1);
                  currentPageRef.current = newPage;
                  setCurrentPage(newPage);
                  // Scrolla till sidan
                  scrollToPage(newPage);
                }}
                disabled={currentPage === pdfDoc.numPages}
                style={{
                  padding: '8px 16px',
                  backgroundColor: currentPage === pdfDoc.numPages ? '#333' : '#444',
                  color: '#fff',
                  border: '1px solid #555',
                  cursor: currentPage === pdfDoc.numPages ? 'not-allowed' : 'pointer',
                  borderRadius: '5px',
                  opacity: currentPage === pdfDoc.numPages ? 0.5 : 1
                }}
              >
                {t('toolbar.next')}
              </button>
            </>
          )}

          {pdfDoc && (
            <button
              onClick={() => setShowPageManagementPanel(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '5px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                marginRight: '10px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#5a6268';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#6c757d';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {t('toolbar.pageManagement', 'Sidhantering')}
            </button>
          )}

          <button
            onClick={() => setShowDownloadModal(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0066ff',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '5px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0052cc';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0066ff';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {t('toolbar.download', 'Ladda ner')}
          </button>
        </div>
      </div>

      {/* Main Content Area - med flex row för sidebar och PDF viewer */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        flex: 1, 
        height: 'calc(100vh - 60px)', 
        position: 'relative', 
        overflow: 'hidden'
      }}>
        {/* Thumbnail Sidebar - position absolute så den inte påverkar layouten */}
        {pdfDoc && (
          <ThumbnailSidebar
            pdfDoc={pdfDoc}
            currentPage={currentPage}
            onPageSelect={(pageNum) => {
              currentPageRef.current = pageNum;
              setCurrentPage(pageNum);
              scrollToPage(pageNum);
            }}
            zoom={zoom}
            sidebarWidth={sidebarWidth}
            onWidthChange={handleSidebarWidthChange}
          />
        )}
        
        {/* Text Settings Sidebar - Använd position absolute så den inte påverkar layouten */}
        {(tool === 'text' || tool === 'edit-text') && (
          <div
            style={{
              position: 'absolute',
              top: 0, // Direkt vid kanten där verktygsfältet börjar
              left: pdfDoc ? `${sidebarWidth}px` : '0', // Börja efter thumbnail sidebar
              right: '17px', // Lämna utrymme för scrollbaren (vanligtvis 15-17px)
              zIndex: 40,
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              padding: '15px 20px',
              display: 'flex',
              gap: '30px',
              alignItems: 'center',
              flexWrap: 'wrap',
              animation: 'slideDown 0.3s ease-out',
              transition: 'top 0.3s ease',
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

          {/* Font Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label htmlFor="font-size-input" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
              {t('textSidebar.size')}:
            </label>
            <input
              id="font-size-input"
              name="font-size"
              ref={fontSizeInputRef}
              type="number"
              min="6"
              max="72"
              step="1"
              value={fontSizeInput}
              onChange={(e) => {
                // Uppdatera bara lokal input-state, låt användaren skriva fritt
                setFontSizeInput(e.target.value);
              }}
              onBlur={(e) => {
                // När användaren lämnar fältet, validera och uppdatera textSettings
                const inputValue = e.target.value.trim();
                if (inputValue === '' || inputValue === '-') {
                  // Om tomt, återställ till nuvarande värde
                  setFontSizeInput(String(Math.round(textSettings.fontSizePt)));
                  return;
                }
                const numValue = parseInt(inputValue, 10);
                if (isNaN(numValue) || numValue < 6 || numValue > 72) {
                  // Ogiltigt värde, återställ till nuvarande värde
                  setFontSizeInput(String(Math.round(textSettings.fontSizePt)));
                } else {
                  // Giltigt värde, uppdatera textSettings
                  setTextSettings({ ...textSettings, fontSizePt: numValue });
                  setFontSizeInput(String(numValue));
                }
              }}
              onKeyDown={(e) => {
                // När användaren trycker Enter, validera och uppdatera
                if (e.key === 'Enter') {
                  e.target.blur(); // Triggar onBlur som validerar
                }
              }}
              style={{
                width: '70px',
                padding: '6px 10px',
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '5px',
                fontSize: '0.9rem'
              }}
            />
            <span style={{ color: '#888', fontSize: '0.85rem' }}>pt</span>
          </div>

          {/* Font Family */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label htmlFor="font-family-select" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
              {t('textSidebar.fontFamily')}:
            </label>
            <select
              id="font-family-select"
              name="font-family"
              value={textSettings.fontFamily}
              onChange={(e) => setTextSettings({ ...textSettings, fontFamily: e.target.value })}
              style={{
                padding: '6px 10px',
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '5px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="Helvetica">Helvetica</option>
              <option value="Arial">Arial</option>
              <option value="Times-Roman">Times Roman</option>
              <option value="Courier">Courier</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
            </select>
          </div>

          {/* Text Color */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
            <label htmlFor="text-color-picker" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
              {t('textSidebar.color')}:
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
              <div style={{ position: 'relative' }} data-color-picker>
                <button
                  onClick={() => setShowColorPalette(!showColorPalette)}
                  style={{
                    width: '50px',
                    height: '35px',
                    border: '2px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    backgroundColor: textSettings.color,
                    transition: 'all 0.2s ease',
                    boxShadow: showColorPalette ? '0 0 0 2px rgba(255, 107, 53, 0.5)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#888';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#555';
                  }}
                  title={t('textSidebar.selectColor')}
                />
                {/* Dropdown med vanliga färger */}
                {showColorPalette && (
                  <div
                    data-color-picker
                    style={{
                      position: 'absolute',
                      top: '45px',
                      left: '0',
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #555',
                      borderRadius: '8px',
                      padding: '12px',
                      zIndex: 1000,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      width: '200px'
                    }}
                  >
                    {[
                      { nameKey: 'colors.black', color: '#000000' },
                      { nameKey: 'colors.white', color: '#FFFFFF' },
                      { nameKey: 'colors.red', color: '#FF0000' },
                      { nameKey: 'colors.blue', color: '#0000FF' },
                      { nameKey: 'colors.green', color: '#008000' },
                      { nameKey: 'colors.yellow', color: '#FFFF00' },
                      { nameKey: 'colors.orange', color: '#FF6B35' },
                      { nameKey: 'colors.purple', color: '#800080' },
                      { nameKey: 'colors.pink', color: '#FF69B4' },
                      { nameKey: 'colors.gray', color: '#808080' },
                      { nameKey: 'colors.darkBlue', color: '#000080' },
                      { nameKey: 'colors.darkGreen', color: '#006400' }
                    ].map((colorOption) => (
                      <button
                        key={colorOption.color}
                        onClick={() => {
                          setTextSettings({ ...textSettings, color: colorOption.color });
                          setShowColorPalette(false);
                        }}
                        title={t(colorOption.nameKey)}
                        style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: colorOption.color,
                          border: textSettings.color.toLowerCase() === colorOption.color.toLowerCase() 
                            ? '3px solid #ff6b35' 
                            : '2px solid #555',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: textSettings.color.toLowerCase() === colorOption.color.toLowerCase()
                            ? '0 0 0 2px rgba(255, 107, 53, 0.3)'
                            : 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (textSettings.color.toLowerCase() !== colorOption.color.toLowerCase()) {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.borderColor = '#888';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (textSettings.color.toLowerCase() !== colorOption.color.toLowerCase()) {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.borderColor = '#555';
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <input
                id="text-color-picker"
                name="text-color"
                type="color"
                value={textSettings.color}
                onChange={(e) => setTextSettings({ ...textSettings, color: e.target.value })}
                style={{
                  width: '50px',
                  height: '35px',
                  border: '1px solid #555',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  backgroundColor: '#333'
                }}
              />
              <input
                id="text-color-text"
                name="text-color-hex"
                type="text"
                value={textSettings.color}
                onChange={(e) => setTextSettings({ ...textSettings, color: e.target.value })}
                style={{
                  width: '90px',
                  padding: '6px 10px',
                  backgroundColor: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '5px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>

          {/* Font Weight & Style */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
              {t('textSidebar.style')}:
            </label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={() => {
                  const newWeight = textSettings.fontWeight === 'bold' ? 'normal' : 'bold';
                  setTextSettings({ ...textSettings, fontWeight: newWeight });
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: textSettings.fontWeight === 'bold' ? '#ff6b35' : '#333',
                  color: '#fff',
                  border: textSettings.fontWeight === 'bold' ? '1px solid #ff6b35' : '1px solid #555',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease'
                }}
                title={t('textSidebar.bold')}
              >
                <strong>B</strong>
              </button>
              <button
                onClick={() => {
                  const newStyle = textSettings.fontStyle === 'italic' ? 'normal' : 'italic';
                  setTextSettings({ ...textSettings, fontStyle: newStyle });
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: textSettings.fontStyle === 'italic' ? '#ff6b35' : '#333',
                  color: '#fff',
                  border: textSettings.fontStyle === 'italic' ? '1px solid #ff6b35' : '1px solid #555',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontStyle: 'italic',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease'
                }}
                title={t('textSidebar.italic')}
              >
                <em>I</em>
              </button>
            </div>
          </div>

          {/* Preview */}
          <div style={{ 
            marginLeft: 'auto', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            padding: '8px 15px',
            backgroundColor: '#333',
            borderRadius: '5px',
            border: '1px solid #555'
          }}>
            <span style={{ color: '#888', fontSize: '0.85rem', marginRight: '5px' }}>{t('textSidebar.preview')}:</span>
            <span
              style={{
                fontSize: '14px', // Fast storlek oavsett textrutans fontstorlek
                fontFamily: textSettings.fontFamily,
                color: textSettings.color,
                fontWeight: textSettings.fontWeight,
                fontStyle: textSettings.fontStyle
              }}
            >
              Aa
            </span>
          </div>
        </div>
      )}

        {/* Comment Settings Sidebar - Visas när comment-verktyget är aktivt */}
        {tool === 'comment' && (
          <div
            data-comment-sidebar
            style={{
              position: 'absolute',
              top: 0,
              left: pdfDoc ? `${sidebarWidth}px` : '0',
              right: '17px',
              zIndex: 50,
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              padding: '15px 20px',
              display: 'flex',
              gap: '20px',
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

            {/* Delete comment button */}
            <button
              onClick={() => {
                if (selectedElement !== null && selectedType === 'comment') {
                  const confirmed = window.confirm(t('commentSidebar.confirmDelete', 'Vill du ta bort kommentaren?'));
                  if (confirmed) {
                    handleDelete();
                    setTool(null); // stäng comment-läget när kommentaren tas bort via sidomenyn
                  }
                }
              }}
              disabled={selectedElement === null || selectedType !== 'comment'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: '#c0392b',
                color: '#fff',
                border: '1px solid #a93226',
                borderRadius: '6px',
                cursor: selectedElement !== null && selectedType === 'comment' ? 'pointer' : 'not-allowed',
                opacity: selectedElement !== null && selectedType === 'comment' ? 1 : 0.5,
                minWidth: '44px',
                height: '42px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
              }}
              title={t('commentSidebar.delete', 'Ta bort kommentar')}
            >
              🗑️
            </button>

            {/* Comment Color */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
              <label htmlFor="comment-color-picker" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
                {t('commentSidebar.color')}:
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
                <div style={{ position: 'relative' }} data-comment-color-picker>
                  <button
                    onClick={() => setShowCommentColorPalette(!showCommentColorPalette)}
                    style={{
                      width: '50px',
                      height: '35px',
                      border: '2px solid #555',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      backgroundColor: commentSettings.backgroundColor,
                      transition: 'all 0.2s ease',
                      boxShadow: showCommentColorPalette ? '0 0 0 2px rgba(255, 107, 53, 0.5)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#888';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#555';
                    }}
                    title={t('commentSidebar.color')}
                  />
                  {/* Dropdown med färger */}
                  {showCommentColorPalette && (
                    <div
                      data-comment-color-picker
                      style={{
                        position: 'absolute',
                        top: '45px',
                        left: '0',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #555',
                        borderRadius: '8px',
                        padding: '12px',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        width: '200px'
                      }}
                    >
                      {[
                        { color: '#FFF59D', name: 'Gul' },
                        { color: '#FFA870', name: 'Orange' },
                        { color: '#FF7A7A', name: 'Röd' },
                        { color: '#FF8AF5', name: 'Magenta' },
                        { color: '#7AA8FF', name: 'Blå' },
                        { color: '#7DFFA3', name: 'Lime grön' }
                      ].map((colorOption) => (
                        <button
                          key={colorOption.color}
                          onClick={() => {
                            setCommentSettings({ ...commentSettings, backgroundColor: colorOption.color });
                            setShowCommentColorPalette(false);
                            // Uppdatera även vald kommentar om en är markerad
                            if (selectedElement !== null && selectedType === 'comment') {
                              const newBoxes = [...commentBoxes];
                              newBoxes[selectedElement] = { 
                                ...newBoxes[selectedElement], 
                                backgroundColor: colorOption.color 
                              };
                              setCommentBoxes(newBoxes);
                              saveToHistory(null, null, null, null, newBoxes);
                            }
                          }}
                          title={colorOption.name}
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: colorOption.color,
                            border: commentSettings.backgroundColor.toLowerCase() === colorOption.color.toLowerCase() 
                              ? '3px solid #ff6b35' 
                              : '2px solid #555',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: commentSettings.backgroundColor.toLowerCase() === colorOption.color.toLowerCase()
                              ? '0 0 0 2px rgba(255, 107, 53, 0.3)'
                              : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (commentSettings.backgroundColor.toLowerCase() !== colorOption.color.toLowerCase()) {
                              e.currentTarget.style.transform = 'scale(1.1)';
                              e.currentTarget.style.borderColor = '#888';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (commentSettings.backgroundColor.toLowerCase() !== colorOption.color.toLowerCase()) {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.borderColor = '#555';
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <input
                  id="comment-color-picker"
                  name="comment-color"
                  type="color"
                  value={commentSettings.backgroundColor}
                  onChange={(e) => {
                    const newColor = e.target.value;
                    setCommentSettings({ ...commentSettings, backgroundColor: newColor });
                    // Uppdatera även vald kommentar om en är markerad
                    if (selectedElement !== null && selectedType === 'comment') {
                      const newBoxes = [...commentBoxes];
                      newBoxes[selectedElement] = { ...newBoxes[selectedElement], backgroundColor: newColor };
                      setCommentBoxes(newBoxes);
                      saveToHistory(null, null, null, null, newBoxes);
                    }
                  }}
                  style={{
                    width: '50px',
                    height: '35px',
                    border: '1px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    backgroundColor: '#333'
                  }}
                />
                <input
                  id="comment-color-text"
                  name="comment-color-hex"
                  type="text"
                  value={commentSettings.backgroundColor}
                  onChange={(e) => {
                    const newColor = e.target.value;
                    setCommentSettings({ ...commentSettings, backgroundColor: newColor });
                    // Uppdatera även vald kommentar om en är markerad
                    if (selectedElement !== null && selectedType === 'comment') {
                      const newBoxes = [...commentBoxes];
                      newBoxes[selectedElement] = { ...newBoxes[selectedElement], backgroundColor: newColor };
                      setCommentBoxes(newBoxes);
                    }
                  }}
                  onBlur={() => {
                    // Spara till history när användaren är klar med att skriva
                    if (selectedElement !== null && selectedType === 'comment') {
                      saveToHistory(null, null, null, null, commentBoxes);
                    }
                  }}
                  style={{
                    width: '90px',
                    padding: '6px 10px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: '5px',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>

            {/* Icon Selection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
                {t('commentSidebar.icon')}:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Speech Bubble */}
                <button
                  onClick={() => {
                    setCommentSettings({ ...commentSettings, icon: 'speech-bubble' });
                    // Uppdatera även vald kommentar om en är markerad
                    if (selectedElement !== null && selectedType === 'comment') {
                      const newBoxes = [...commentBoxes];
                      newBoxes[selectedElement] = { ...newBoxes[selectedElement], icon: 'speech-bubble' };
                      setCommentBoxes(newBoxes);
                      saveToHistory(null, null, null, null, newBoxes);
                    }
                  }}
                  style={{
                    width: '35px',
                    height: '35px',
                    backgroundColor: commentSettings.icon === 'speech-bubble' ? '#ff6b35' : '#333',
                    border: commentSettings.icon === 'speech-bubble' ? '2px solid #ff6b35' : '2px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    transition: 'all 0.2s ease'
                  }}
                  title={t('commentSidebar.speechBubble')}
                  onMouseEnter={(e) => {
                    if (commentSettings.icon !== 'speech-bubble') {
                      e.currentTarget.style.backgroundColor = '#444';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (commentSettings.icon !== 'speech-bubble') {
                      e.currentTarget.style.backgroundColor = '#333';
                    }
                  }}
                >
                  💬
                </button>
                
                {/* Arrow */}
                <button
                  onClick={() => {
                    setCommentSettings({ ...commentSettings, icon: 'arrow' });
                    // Uppdatera även vald kommentar om en är markerad
                    if (selectedElement !== null && selectedType === 'comment') {
                      const newBoxes = [...commentBoxes];
                      newBoxes[selectedElement] = { ...newBoxes[selectedElement], icon: 'arrow' };
                      setCommentBoxes(newBoxes);
                      saveToHistory(null, null, null, null, newBoxes);
                    }
                  }}
                  style={{
                    width: '35px',
                    height: '35px',
                    backgroundColor: commentSettings.icon === 'arrow' ? '#ff6b35' : '#333',
                    border: commentSettings.icon === 'arrow' ? '2px solid #ff6b35' : '2px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    transition: 'all 0.2s ease'
                  }}
                  title={t('commentSidebar.arrow')}
                  onMouseEnter={(e) => {
                    if (commentSettings.icon !== 'arrow') {
                      e.currentTarget.style.backgroundColor = '#444';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (commentSettings.icon !== 'arrow') {
                      e.currentTarget.style.backgroundColor = '#333';
                    }
                  }}
                >
                  →
                </button>
                
                {/* Checkmark */}
                <button
                  onClick={() => {
                    setCommentSettings({ ...commentSettings, icon: 'checkmark' });
                    // Uppdatera även vald kommentar om en är markerad
                    if (selectedElement !== null && selectedType === 'comment') {
                      const newBoxes = [...commentBoxes];
                      newBoxes[selectedElement] = { ...newBoxes[selectedElement], icon: 'checkmark' };
                      setCommentBoxes(newBoxes);
                      saveToHistory(null, null, null, null, newBoxes);
                    }
                  }}
                  style={{
                    width: '35px',
                    height: '35px',
                    backgroundColor: commentSettings.icon === 'checkmark' ? '#ff6b35' : '#333',
                    border: commentSettings.icon === 'checkmark' ? '2px solid #ff6b35' : '2px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    transition: 'all 0.2s ease'
                  }}
                  title={t('commentSidebar.checkmark')}
                  onMouseEnter={(e) => {
                    if (commentSettings.icon !== 'checkmark') {
                      e.currentTarget.style.backgroundColor = '#444';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (commentSettings.icon !== 'checkmark') {
                      e.currentTarget.style.backgroundColor = '#333';
                    }
                  }}
                >
                  ✓
                </button>
                
                {/* X */}
                <button
                  onClick={() => {
                    setCommentSettings({ ...commentSettings, icon: 'x' });
                    // Uppdatera även vald kommentar om en är markerad
                    if (selectedElement !== null && selectedType === 'comment') {
                      const newBoxes = [...commentBoxes];
                      newBoxes[selectedElement] = { ...newBoxes[selectedElement], icon: 'x' };
                      setCommentBoxes(newBoxes);
                      saveToHistory(null, null, null, null, newBoxes);
                    }
                  }}
                  style={{
                    width: '35px',
                    height: '35px',
                    backgroundColor: commentSettings.icon === 'x' ? '#ff6b35' : '#333',
                    border: commentSettings.icon === 'x' ? '2px solid #ff6b35' : '2px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    transition: 'all 0.2s ease'
                  }}
                  title={t('commentSidebar.x')}
                  onMouseEnter={(e) => {
                    if (commentSettings.icon !== 'x') {
                      e.currentTarget.style.backgroundColor = '#444';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (commentSettings.icon !== 'x') {
                      e.currentTarget.style.backgroundColor = '#333';
                    }
                  }}
                >
                  ✕
                </button>
                
                {/* Star */}
                <button
                  onClick={() => {
                    setCommentSettings({ ...commentSettings, icon: 'star' });
                    // Uppdatera även vald kommentar om en är markerad
                    if (selectedElement !== null && selectedType === 'comment') {
                      const newBoxes = [...commentBoxes];
                      newBoxes[selectedElement] = { ...newBoxes[selectedElement], icon: 'star' };
                      setCommentBoxes(newBoxes);
                      saveToHistory(null, null, null, null, newBoxes);
                    }
                  }}
                  style={{
                    width: '35px',
                    height: '35px',
                    backgroundColor: commentSettings.icon === 'star' ? '#ff6b35' : '#333',
                    border: commentSettings.icon === 'star' ? '2px solid #ff6b35' : '2px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    transition: 'all 0.2s ease'
                  }}
                  title={t('commentSidebar.star')}
                  onMouseEnter={(e) => {
                    if (commentSettings.icon !== 'star') {
                      e.currentTarget.style.backgroundColor = '#444';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (commentSettings.icon !== 'star') {
                      e.currentTarget.style.backgroundColor = '#333';
                    }
                  }}
                >
                  ★
                </button>
                
                {/* Key */}
                <button
                  onClick={() => {
                    setCommentSettings({ ...commentSettings, icon: 'key' });
                    // Uppdatera även vald kommentar om en är markerad
                    if (selectedElement !== null && selectedType === 'comment') {
                      const newBoxes = [...commentBoxes];
                      newBoxes[selectedElement] = { ...newBoxes[selectedElement], icon: 'key' };
                      setCommentBoxes(newBoxes);
                      saveToHistory(null, null, null, null, newBoxes);
                    }
                  }}
                  style={{
                    width: '35px',
                    height: '35px',
                    backgroundColor: commentSettings.icon === 'key' ? '#ff6b35' : '#333',
                    border: commentSettings.icon === 'key' ? '2px solid #ff6b35' : '2px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    transition: 'all 0.2s ease'
                  }}
                  title={t('commentSidebar.key')}
                  onMouseEnter={(e) => {
                    if (commentSettings.icon !== 'key') {
                      e.currentTarget.style.backgroundColor = '#444';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (commentSettings.icon !== 'key') {
                      e.currentTarget.style.backgroundColor = '#333';
                    }
                  }}
                >
                  🔑
                </button>
              </div>
            </div>

            {/* Preview */}
            <div style={{ 
              marginLeft: 'auto', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '8px 15px',
              backgroundColor: '#333',
              borderRadius: '5px',
              border: '1px solid #555'
            }}>
              <span style={{ color: '#888', fontSize: '0.85rem', marginRight: '5px' }}>
                {t('commentSidebar.preview')}:
              </span>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: commentSettings.backgroundColor,
                  border: '2px solid #555',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  transform: 'rotate(-2deg)'
                }}
              >
                {commentSettings.icon === 'speech-bubble' && '💬'}
                {commentSettings.icon === 'arrow' && '→'}
                {commentSettings.icon === 'checkmark' && '✓'}
                {commentSettings.icon === 'x' && '✕'}
                {commentSettings.icon === 'star' && '★'}
                {commentSettings.icon === 'key' && '🔑'}
              </div>
            </div>
          </div>
        )}

        {/* Highlight Sidebar */}
        {tool === 'highlight' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: pdfDoc ? `${sidebarWidth}px` : '0',
              right: '17px',
              zIndex: 45,
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              padding: '15px 20px',
              display: 'flex',
              gap: '20px',
              alignItems: 'center',
              flexWrap: 'wrap',
              animation: 'slideDown 0.3s ease-out',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            {/* Lägen */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>{t('toolbar.mode', 'Läge')}:</span>
              <button
                onClick={() => setHighlightMode('rect')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: highlightMode === 'rect' ? '#ff6b35' : '#333',
                  color: '#fff',
                  border: highlightMode === 'rect' ? '1px solid #ff6b35' : '1px solid #555',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {t('toolbar.highlightRect', 'Markera yta')}
              </button>
              <button
                onClick={() => setHighlightMode('freehand')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: highlightMode === 'freehand' ? '#ff6b35' : '#333',
                  color: '#fff',
                  border: highlightMode === 'freehand' ? '1px solid #ff6b35' : '1px solid #555',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {t('toolbar.highlightFreehand', 'Överstryk penna')}
              </button>
            </div>

            {/* Färg */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                {t('toolbar.highlightColor', 'Highlight-färg')}:
              </label>
              <input
                type="color"
                value={highlightSettings.color}
                onChange={(e) => setHighlightSettings({ ...highlightSettings, color: e.target.value })}
                style={{ width: '44px', height: '34px', border: '1px solid #555', background: '#222', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={highlightSettings.color}
                onChange={(e) => setHighlightSettings({ ...highlightSettings, color: e.target.value })}
                style={{ width: '90px', padding: '6px 10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '5px', fontFamily: 'monospace' }}
              />
            </div>

            {/* Opacitet */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                {t('toolbar.opacity', 'Opacitet')}:
              </label>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={highlightSettings.opacity}
                onChange={(e) => setHighlightSettings({ ...highlightSettings, opacity: parseFloat(e.target.value) })}
                style={{ accentColor: '#ff6b35' }}
              />
              <span style={{ color: '#fff', minWidth: '38px', textAlign: 'right' }}>{Math.round((highlightSettings.opacity || 0.35) * 100)}%</span>
            </div>

            {/* Stroke-bredd (för frihand) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                {t('toolbar.stroke', 'Bredd')}:
              </label>
              <input
                type="range"
                min="2"
                max="48"
                step="1"
                value={highlightSettings.strokeWidth}
                onChange={(e) => setHighlightSettings({ ...highlightSettings, strokeWidth: Math.max(2, Math.min(48, Number(e.target.value))) })}
                style={{ accentColor: '#6b5bff', minWidth: '140px' }}
              />
              <span style={{ color: '#fff', minWidth: '44px', textAlign: 'right' }}>{highlightSettings.strokeWidth} px</span>
            </div>
          </div>
        )}

        {/* Eraser Sidebar */}
        {tool === 'eraser' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: pdfDoc ? `${sidebarWidth}px` : '0',
              right: '17px',
              zIndex: 44,
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              padding: '15px 20px',
              display: 'flex',
              gap: '20px',
              alignItems: 'center',
              flexWrap: 'wrap',
              animation: 'slideDown 0.3s ease-out',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                {t('toolbar.stroke', 'Bredd')}:
              </label>
              <input
                type="range"
                min="4"
                max="64"
                step="1"
                value={eraserSettings.size}
                onChange={(e) => setEraserSettings({ ...eraserSettings, size: Math.max(4, Math.min(64, Number(e.target.value))) })}
                style={{ accentColor: '#6b5bff', minWidth: '160px' }}
              />
              <span style={{ color: '#fff', minWidth: '44px', textAlign: 'right' }}>{eraserSettings.size} px</span>
            </div>
          </div>
        )}

        {/* Whiteout Settings Sidebar - Visas när whiteout-verktyget är aktivt */}
        {tool === 'whiteout' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: pdfDoc ? `${sidebarWidth}px` : '0',
              right: '17px',
              zIndex: 10,
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              padding: '15px 20px',
              display: 'flex',
              gap: '30px',
              alignItems: 'center',
              flexWrap: 'wrap',
              animation: 'slideDown 0.3s ease-out',
              transition: 'top 0.3s ease',
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

            {/* Whiteout Color */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
              <label htmlFor="whiteout-color-picker" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
                {t('whiteoutSidebar.color', 'Färg')}:
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
                <div style={{ position: 'relative' }} data-whiteout-color-picker>
                  <button
                    onClick={() => setShowWhiteoutColorPalette(!showWhiteoutColorPalette)}
                    style={{
                      width: '50px',
                      height: '35px',
                      border: '2px solid #555',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      backgroundColor: whiteoutColor,
                      transition: 'all 0.2s ease',
                      boxShadow: showWhiteoutColorPalette ? '0 0 0 2px rgba(255, 107, 53, 0.5)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#888';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#555';
                    }}
                    title={t('whiteoutSidebar.selectColor', 'Välj färg')}
                  />
                  {/* Dropdown med vanliga färger */}
                  {showWhiteoutColorPalette && (
                    <div
                      data-whiteout-color-picker
                      style={{
                        position: 'absolute',
                        top: '45px',
                        left: '0',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #555',
                        borderRadius: '8px',
                        padding: '12px',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        width: '200px'
                      }}
                    >
                      {[
                        { nameKey: 'colors.white', color: '#FFFFFF' },
                        { nameKey: 'colors.black', color: '#000000' },
                        { nameKey: 'colors.red', color: '#FF0000' },
                        { nameKey: 'colors.blue', color: '#0000FF' },
                        { nameKey: 'colors.green', color: '#008000' },
                        { nameKey: 'colors.yellow', color: '#FFFF00' },
                        { nameKey: 'colors.orange', color: '#FF6B35' },
                        { nameKey: 'colors.purple', color: '#800080' },
                        { nameKey: 'colors.pink', color: '#FF69B4' },
                        { nameKey: 'colors.gray', color: '#808080' },
                        { nameKey: 'colors.darkBlue', color: '#000080' },
                        { nameKey: 'colors.darkGreen', color: '#006400' }
                      ].map((colorOption) => (
                        <button
                          key={colorOption.color}
                          onClick={() => {
                            setWhiteoutColor(colorOption.color);
                            setShowWhiteoutColorPalette(false);
                          }}
                          title={t(colorOption.nameKey)}
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: colorOption.color,
                            border: whiteoutColor.toLowerCase() === colorOption.color.toLowerCase() 
                              ? '3px solid #ff6b35' 
                              : '2px solid #555',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: whiteoutColor.toLowerCase() === colorOption.color.toLowerCase()
                              ? '0 0 0 2px rgba(255, 107, 53, 0.3)'
                              : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (whiteoutColor.toLowerCase() !== colorOption.color.toLowerCase()) {
                              e.currentTarget.style.transform = 'scale(1.1)';
                              e.currentTarget.style.borderColor = '#888';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (whiteoutColor.toLowerCase() !== colorOption.color.toLowerCase()) {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.borderColor = '#555';
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <input
                  id="whiteout-color-picker"
                  name="whiteout-color"
                  type="color"
                  value={whiteoutColor}
                  onChange={(e) => setWhiteoutColor(e.target.value)}
                  style={{
                    width: '50px',
                    height: '35px',
                    border: '1px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    backgroundColor: '#333'
                  }}
                />
                <input
                  id="whiteout-color-text"
                  name="whiteout-color-hex"
                  type="text"
                  value={whiteoutColor}
                  onChange={(e) => setWhiteoutColor(e.target.value)}
                  style={{
                    width: '90px',
                    padding: '6px 10px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: '5px',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>

            {/* Preview */}
            <div style={{ 
              marginLeft: 'auto', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '8px 15px',
              backgroundColor: '#333',
              borderRadius: '5px',
              border: '1px solid #555'
            }}>
              <span style={{ color: '#888', fontSize: '0.85rem', marginRight: '5px' }}>
                {t('whiteoutSidebar.preview', 'Förhandsgranskning')}:
              </span>
              <div
                style={{
                  width: '40px',
                  height: '30px',
                  backgroundColor: whiteoutColor,
                  border: '2px solid #555',
                  borderRadius: '3px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              />
            </div>
          </div>
        )}

        {/* Shape Settings Sidebar - Visas när shape-verktyget är aktivt */}
        {tool && tool.startsWith('shape') && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: pdfDoc ? `${sidebarWidth}px` : '0',
              right: '17px',
              zIndex: 10,
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              padding: '15px 20px',
              display: 'flex',
              gap: '30px',
              alignItems: 'center',
              flexWrap: 'wrap',
              animation: 'slideDown 0.3s ease-out',
              transition: 'top 0.3s ease',
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

            {/* Shape Type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
                {t('shapeSidebar.type', 'Typ')}:
              </label>
              <select
                value={shapeSettings.type}
                onChange={(e) => {
                  setShapeSettings({ ...shapeSettings, type: e.target.value });
                  setTool(`shape-${e.target.value}`);
                }}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '5px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="rectangle">{t('toolbar.rectangle')}</option>
                <option value="circle">{t('toolbar.circle')}</option>
                <option value="line">{t('toolbar.line')}</option>
                <option value="arrow">{t('toolbar.arrow')}</option>
              </select>
            </div>

            {/* Stroke Color */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
              <label htmlFor="shape-stroke-color-picker" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '100px' }}>
                {t('shapeSidebar.strokeColor', 'Linjefärg')}:
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
                <div style={{ position: 'relative' }} data-shape-stroke-color-picker>
                  <button
                    onClick={() => setShowShapeStrokeColorPalette(!showShapeStrokeColorPalette)}
                    style={{
                      width: '50px',
                      height: '35px',
                      border: '2px solid #555',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      backgroundColor: shapeSettings.strokeColor,
                      transition: 'all 0.2s ease',
                      boxShadow: showShapeStrokeColorPalette ? '0 0 0 2px rgba(255, 107, 53, 0.5)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#888';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#555';
                    }}
                    title={t('shapeSidebar.selectColor', 'Välj färg')}
                  />
                  {/* Dropdown med vanliga färger */}
                  {showShapeStrokeColorPalette && (
                    <div
                      data-shape-stroke-color-picker
                      style={{
                        position: 'absolute',
                        top: '45px',
                        left: '0',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #555',
                        borderRadius: '8px',
                        padding: '12px',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        width: '200px'
                      }}
                    >
                      {[
                        { nameKey: 'colors.black', color: '#000000' },
                        { nameKey: 'colors.white', color: '#FFFFFF' },
                        { nameKey: 'colors.red', color: '#FF0000' },
                        { nameKey: 'colors.blue', color: '#0000FF' },
                        { nameKey: 'colors.green', color: '#008000' },
                        { nameKey: 'colors.yellow', color: '#FFFF00' },
                        { nameKey: 'colors.orange', color: '#FF6B35' },
                        { nameKey: 'colors.purple', color: '#800080' },
                        { nameKey: 'colors.pink', color: '#FF69B4' },
                        { nameKey: 'colors.gray', color: '#808080' },
                        { nameKey: 'colors.darkBlue', color: '#000080' },
                        { nameKey: 'colors.darkGreen', color: '#006400' }
                      ].map((colorOption) => (
                        <button
                          key={colorOption.color}
                          onClick={() => {
                            setShapeSettings({ ...shapeSettings, strokeColor: colorOption.color });
                            setShowShapeStrokeColorPalette(false);
                          }}
                          title={t(colorOption.nameKey)}
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: colorOption.color,
                            border: shapeSettings.strokeColor.toLowerCase() === colorOption.color.toLowerCase() 
                              ? '3px solid #ff6b35' 
                              : '2px solid #555',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: shapeSettings.strokeColor.toLowerCase() === colorOption.color.toLowerCase()
                              ? '0 0 0 2px rgba(255, 107, 53, 0.3)'
                              : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (shapeSettings.strokeColor.toLowerCase() !== colorOption.color.toLowerCase()) {
                              e.currentTarget.style.transform = 'scale(1.1)';
                              e.currentTarget.style.borderColor = '#888';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (shapeSettings.strokeColor.toLowerCase() !== colorOption.color.toLowerCase()) {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.borderColor = '#555';
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <input
                  id="shape-stroke-color-picker"
                  name="shape-stroke-color"
                  type="color"
                  value={shapeSettings.strokeColor}
                  onChange={(e) => setShapeSettings({ ...shapeSettings, strokeColor: e.target.value })}
                  style={{
                    width: '50px',
                    height: '35px',
                    border: '1px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    backgroundColor: '#333'
                  }}
                />
                <input
                  id="shape-stroke-color-text"
                  name="shape-stroke-color-hex"
                  type="text"
                  value={shapeSettings.strokeColor}
                  onChange={(e) => setShapeSettings({ ...shapeSettings, strokeColor: e.target.value })}
                  style={{
                    width: '90px',
                    padding: '6px 10px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: '5px',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>

            {/* Fill Color - Endast för rektangel och cirkel */}
            {(shapeSettings.type === 'rectangle' || shapeSettings.type === 'circle') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                <label htmlFor="shape-fill-color-picker" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '100px' }}>
                  {t('shapeSidebar.fillColor', 'Fyllningsfärg')}:
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
                  <div style={{ position: 'relative' }} data-shape-fill-color-picker>
                    <button
                      onClick={() => setShowShapeFillColorPalette(!showShapeFillColorPalette)}
                      style={{
                        width: '50px',
                        height: '35px',
                        border: '2px solid #555',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        backgroundColor: shapeSettings.fillColor === 'transparent' ? '#2a2a2a' : shapeSettings.fillColor,
                        backgroundImage: shapeSettings.fillColor === 'transparent' 
                          ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                          : 'none',
                        backgroundSize: shapeSettings.fillColor === 'transparent' ? '10px 10px' : 'auto',
                        backgroundPosition: shapeSettings.fillColor === 'transparent' ? '0 0, 0 5px, 5px -5px, -5px 0px' : 'auto',
                        transition: 'all 0.2s ease',
                        boxShadow: showShapeFillColorPalette ? '0 0 0 2px rgba(255, 107, 53, 0.5)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#888';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#555';
                      }}
                      title={t('shapeSidebar.selectColor', 'Välj färg')}
                    />
                    {/* Dropdown med vanliga färger */}
                    {showShapeFillColorPalette && (
                      <div
                        data-shape-fill-color-picker
                        style={{
                          position: 'absolute',
                          top: '45px',
                          left: '0',
                          backgroundColor: '#2a2a2a',
                          border: '1px solid #555',
                          borderRadius: '8px',
                          padding: '12px',
                          zIndex: 1000,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          width: '200px'
                        }}
                      >
                        <button
                          onClick={() => {
                            setShapeSettings({ ...shapeSettings, fillColor: 'transparent' });
                            setShowShapeFillColorPalette(false);
                          }}
                          title="Transparent"
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#2a2a2a',
                            backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                            backgroundSize: '10px 10px',
                            backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                            border: shapeSettings.fillColor === 'transparent' 
                              ? '3px solid #ff6b35' 
                              : '2px solid #555',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: shapeSettings.fillColor === 'transparent'
                              ? '0 0 0 2px rgba(255, 107, 53, 0.3)'
                              : 'none'
                          }}
                        />
                        {[
                          { nameKey: 'colors.white', color: '#FFFFFF' },
                          { nameKey: 'colors.black', color: '#000000' },
                          { nameKey: 'colors.red', color: '#FF0000' },
                          { nameKey: 'colors.blue', color: '#0000FF' },
                          { nameKey: 'colors.green', color: '#008000' },
                          { nameKey: 'colors.yellow', color: '#FFFF00' },
                          { nameKey: 'colors.orange', color: '#FF6B35' },
                          { nameKey: 'colors.purple', color: '#800080' },
                          { nameKey: 'colors.pink', color: '#FF69B4' },
                          { nameKey: 'colors.gray', color: '#808080' },
                          { nameKey: 'colors.darkBlue', color: '#000080' },
                          { nameKey: 'colors.darkGreen', color: '#006400' }
                        ].map((colorOption) => (
                          <button
                            key={colorOption.color}
                            onClick={() => {
                              setShapeSettings({ ...shapeSettings, fillColor: colorOption.color });
                              setShowShapeFillColorPalette(false);
                            }}
                            title={t(colorOption.nameKey)}
                            style={{
                              width: '32px',
                              height: '32px',
                              backgroundColor: colorOption.color,
                              border: (shapeSettings.fillColor || 'transparent').toLowerCase() === colorOption.color.toLowerCase() 
                                ? '3px solid #ff6b35' 
                                : '2px solid #555',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: (shapeSettings.fillColor || 'transparent').toLowerCase() === colorOption.color.toLowerCase()
                                ? '0 0 0 2px rgba(255, 107, 53, 0.3)'
                                : 'none'
                            }}
                            onMouseEnter={(e) => {
                              if ((shapeSettings.fillColor || 'transparent').toLowerCase() !== colorOption.color.toLowerCase()) {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.borderColor = '#888';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if ((shapeSettings.fillColor || 'transparent').toLowerCase() !== colorOption.color.toLowerCase()) {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.borderColor = '#555';
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    id="shape-fill-color-picker"
                    name="shape-fill-color"
                    type="color"
                    value={shapeSettings.fillColor === 'transparent' ? '#FFFFFF' : shapeSettings.fillColor}
                    onChange={(e) => {
                      if (e.target.value === '#FFFFFF') {
                        setShapeSettings({ ...shapeSettings, fillColor: 'transparent' });
                      } else {
                        setShapeSettings({ ...shapeSettings, fillColor: e.target.value });
                      }
                    }}
                    style={{
                      width: '50px',
                      height: '35px',
                      border: '1px solid #555',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      backgroundColor: '#333'
                    }}
                  />
                  <input
                    id="shape-fill-color-text"
                    name="shape-fill-color-hex"
                    type="text"
                    value={shapeSettings.fillColor}
                    onChange={(e) => setShapeSettings({ ...shapeSettings, fillColor: e.target.value })}
                    placeholder="transparent"
                    style={{
                      width: '90px',
                      padding: '6px 10px',
                      backgroundColor: '#333',
                      color: '#fff',
                      border: '1px solid #555',
                      borderRadius: '5px',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Stroke Width */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label htmlFor="shape-stroke-width" style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '100px' }}>
                {t('shapeSidebar.strokeWidth', 'Linjetjocklek')}:
              </label>
              <input
                id="shape-stroke-width"
                name="shape-stroke-width"
                type="number"
                min="1"
                max="20"
                step="1"
                value={shapeSettings.strokeWidth}
                onChange={(e) => {
                  const width = parseInt(e.target.value, 10);
                  if (!isNaN(width) && width >= 1 && width <= 20) {
                    setShapeSettings({ ...shapeSettings, strokeWidth: width });
                  }
                }}
                style={{
                  width: '70px',
                  padding: '6px 10px',
                  backgroundColor: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '5px',
                  fontSize: '0.9rem'
                }}
              />
              <span style={{ color: '#888', fontSize: '0.85rem' }}>px</span>
            </div>

            {/* Preview */}
            <div style={{ 
              marginLeft: 'auto', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '8px 15px',
              backgroundColor: '#333',
              borderRadius: '5px',
              border: '1px solid #555'
            }}>
              <span style={{ color: '#888', fontSize: '0.85rem', marginRight: '5px' }}>
                {t('shapeSidebar.preview', 'Förhandsgranskning')}:
              </span>
              <svg
                width="60"
                height="40"
                style={{ display: 'block' }}
              >
                {shapeSettings.type === 'rectangle' && (
                  <rect
                    x="5"
                    y="5"
                    width="50"
                    height="30"
                    fill={shapeSettings.fillColor || 'transparent'}
                    stroke={shapeSettings.strokeColor}
                    strokeWidth={shapeSettings.strokeWidth}
                  />
                )}
                {shapeSettings.type === 'circle' && (
                  <ellipse
                    cx="30"
                    cy="20"
                    rx="22"
                    ry="15"
                    fill={shapeSettings.fillColor || 'transparent'}
                    stroke={shapeSettings.strokeColor}
                    strokeWidth={shapeSettings.strokeWidth}
                  />
                )}
                {shapeSettings.type === 'line' && (
                  <line
                    x1="5"
                    y1="35"
                    x2="55"
                    y2="5"
                    stroke={shapeSettings.strokeColor}
                    strokeWidth={shapeSettings.strokeWidth}
                  />
                )}
                {shapeSettings.type === 'arrow' && (
                  <g>
                    <line
                      x1="5"
                      y1="35"
                      x2="55"
                      y2="5"
                      stroke={shapeSettings.strokeColor}
                      strokeWidth={shapeSettings.strokeWidth}
                    />
                    <polygon
                      points="55,5 45,8 45,2"
                      fill={shapeSettings.strokeColor}
                    />
                  </g>
                )}
              </svg>
            </div>
          </div>
        )}

        {/* PDF Viewer Area - med margin-left för att göra plats för sidebar */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          flex: 1, 
          height: '100%', 
          position: 'relative', 
          overflow: 'hidden',
          marginLeft: pdfDoc ? `${sidebarWidth}px` : '0' // Gör plats för sidebar
        }}>
      {/* PDF Viewer - Konstant padding-top så canvas inte hoppar när sidebar visas/döljs */}
      <div
        ref={containerRef}
        className={
          tool === 'text' || tool === 'edit-text' ? 'text-cursor' : 
          (
            tool === 'whiteout' ||
            tool === 'patch' ||
            (tool && tool.startsWith('shape')) ||
            (tool === 'highlight' && highlightMode === 'rect')
              ? 'crosshair-cursor'
              : ''
          )
        }
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: (navMode === 'paged' && !canScrollCurrentPage) ? 'hidden' : 'auto',
          position: 'relative',
          backgroundColor: '#1a1a1a',
          cursor: tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : undefined,
          scrollSnapType: navMode === 'paged' ? 'y mandatory' : 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {pdfDoc ? (
          <div style={{ 
            position: 'relative', 
            paddingTop: '100px', // Fast värde så canvas inte flyttas när sidebar ändras (text-sidebar är högst)
            paddingLeft: '20px',
            paddingRight: '20px',
            paddingBottom: '20px',
            minWidth: 'max-content',
            boxSizing: 'border-box',
            display: effectiveLayout === 'double' ? 'grid' : 'flex',
            gridTemplateColumns: effectiveLayout === 'double' ? 'repeat(2, max-content)' : undefined,
            flexDirection: effectiveLayout === 'double' ? undefined : 'column',
            justifyContent: 'center',
            alignItems: effectiveLayout === 'double' ? 'start' : 'center',
            gap: '20px' // Mellanrum mellan sidor / mellan grid items
          }}>
            {/* Rendera alla sidor */}
            {pdfPages.map((page, index) => {
              const pageNum = index + 1;
              const viewport = pageViewports[index];
              if (!viewport) return null;
              
              return (
                <div
                  key={pageNum}
                  ref={(el) => {
                    if (el) pageContainerRefs.current[pageNum] = el;
                  }}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    marginBottom: effectiveLayout === 'double' ? '0' : (index < pdfPages.length - 1 ? '20px' : '0'),
                    scrollSnapAlign: navMode === 'paged' ? 'center' : 'none'
                  }}
                >
                  <canvas
                    ref={(el) => {
                      if (el) canvasRefs.current[pageNum] = el;
                    }}
                    style={{
                      border: '1px solid #ccc',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      display: 'block',
                      backgroundColor: 'white',
                      cursor:
                        (tool === 'highlight' && highlightMode === 'freehand') || tool === 'eraser'
                          ? 'none'
                          : (tool === 'highlight' && highlightMode === 'rect')
                            ? 'crosshair'
                            : (tool === 'whiteout' || tool === 'patch' || (tool && tool.startsWith('shape')))
                              ? 'crosshair'
                              : 'default'
                    }}
                  />
                  
                  {/* Render whiteout boxes för denna sida */}
                  {whiteoutBoxes
                    .filter((whiteoutBox) => {
                      const boxPageIndex = whiteoutBox.pageIndex !== undefined ? whiteoutBox.pageIndex : 0;
                      return boxPageIndex === index;
                    })
                    .map((whiteoutBox, localIndex) => {
                      // Hitta global index
                      const globalIndex = whiteoutBoxes.findIndex(wb => wb === whiteoutBox);
                return (
                  <WhiteoutBox
                    key={`whiteout-${globalIndex}`}
                    whiteoutBox={whiteoutBox}
                    zoom={zoom}
                    isSelected={selectedElement === globalIndex && selectedType === 'whiteout'}
                    tool={tool}
                    whiteoutBoxIndex={globalIndex}
                    onUpdate={(updated) => {
                      const newBoxes = [...whiteoutBoxes];
                      newBoxes[globalIndex] = updated;
                      setWhiteoutBoxes(newBoxes);
                      saveToHistory(null, newBoxes, null, null, commentBoxes);
                    }}
                    onResizeStart={(handle, e) => {
                      e.stopPropagation();
                      const pageNum = whiteoutBox.pageIndex !== undefined ? whiteoutBox.pageIndex + 1 : currentPage;
                      const canvasRef = canvasRefs.current[pageNum];
                      if (!canvasRef) return;
                      const canvasRect = canvasRef.getBoundingClientRect();
                      const x = e.clientX - canvasRect.left;
                      const y = e.clientY - canvasRect.top;
                      setIsResizing(true);
                      setResizeHandle(handle);
                      setDragStart({ x, y });
                      setOriginalRect(whiteoutBox.rect);
                    }}
                    onRotationStart={(e) => {
                      e.stopPropagation();
                      const pageNum = whiteoutBox.pageIndex !== undefined ? whiteoutBox.pageIndex + 1 : currentPage;
                      const canvasRef = canvasRefs.current[pageNum];
                      if (!canvasRef) return;
                      const canvasRect = canvasRef.getBoundingClientRect();
                      const mouseX = e.clientX - canvasRect.left;
                      const mouseY = e.clientY - canvasRect.top;

                      let actualRectPx = rectPtToPx(whiteoutBox.rect, zoom);
                      const container = document.querySelector(`[data-whiteout-container-index="${globalIndex}"]`);
                      if (container) {
                        const rect = container.getBoundingClientRect();
                        actualRectPx = {
                          x: rect.left - canvasRect.left,
                          y: rect.top - canvasRect.top,
                          width: rect.width,
                          height: rect.height
                        };
                      }

                      const centerX = actualRectPx.x + actualRectPx.width / 2;
                      const centerY = actualRectPx.y + actualRectPx.height / 2;

                      setSelectedElement(globalIndex);
                      setSelectedType('whiteout');
                      setIsRotating(true);
                      setRotationStart({ x: mouseX, y: mouseY, centerX, centerY });
                      setInitialRotation(whiteoutBox.rotation || 0);
                    }}
                  />
                );
              })}
                  
                  {/* Render patch boxes för denna sida */}
                  {patchBoxes
                    .filter((patchBox) => {
                      const boxPageIndex = patchBox.pageIndex !== undefined ? patchBox.pageIndex : 0;
                      return boxPageIndex === index;
                    })
                    .map((patchBox, localIndex) => {
                      const globalIndex = patchBoxes.findIndex(pb => pb === patchBox);
                      // Hämta källsidan om den finns, annars använd targetsidan (för bakåtkompatibilitet)
                      const sourcePageIndex = patchBox.sourcePageIndex !== undefined 
                        ? patchBox.sourcePageIndex 
                        : (patchBox.pageIndex !== undefined ? patchBox.pageIndex : index);
                      const sourcePage = pdfPages[sourcePageIndex] || null;
                      return (
                        <PatchBox
                          key={`patch-${pageNum}-${globalIndex}`}
                          patchBox={patchBox}
                          zoom={zoom}
                          pdfPage={page} // Target page (där patchen visas)
                          sourcePdfPage={sourcePage} // Source page (där patchen kopieras från)
                          pdfPageNum={pageNum}
                          isSelected={selectedElement === globalIndex && selectedType === 'patch'}
                          tool={tool}
                          onUpdate={(updated) => {
                            const newBoxes = [...patchBoxes];
                            newBoxes[globalIndex] = updated;
                            setPatchBoxes(newBoxes);
                            saveToHistory(null, null, newBoxes, null, commentBoxes);
                          }}
                        />
                      );
                    })}

                  {/* Frihand-highlight strokes för denna sida */}
                  <svg
                    width={viewport.width}
                    height={viewport.height}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      pointerEvents: 'none',
                      overflow: 'visible'
                    }}
                  >
                    {highlightStrokes
                      .filter((stroke) => stroke.pageIndex === index)
                      .map((stroke, strokeIdx) => {
                        const pointsPx = (stroke.points || []).map((p) => pointPtToPx(p, zoom));
                        if (pointsPx.length < 2) return null;
                        const d = pointsPx
                          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                          .join(' ');
                        return (
                          <path
                            key={`stroke-${pageNum}-${strokeIdx}`}
                            d={d}
                            fill="none"
                            stroke={hexToRgba(stroke.color || '#FFEB3B', stroke.opacity ?? 0.35)}
                            strokeWidth={(stroke.strokeWidth || 12) * zoom}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={stroke.opacity ?? 0.35}
                          />
                        );
                      })}
                    {/* Live-stroke preview */}
                    {currentStroke && currentStroke.pageIndex === index && currentStroke.points?.length > 1 && (
                      <path
                        d={currentStroke.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                        fill="none"
                        stroke={hexToRgba(currentStroke.color || '#FFEB3B', currentStroke.opacity ?? 0.35)}
                        strokeWidth={(currentStroke.strokeWidth || 12) * zoom}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={currentStroke.opacity ?? 0.35}
                      />
                    )}
                    {/* Cursor preview ring för frihand highlight */}
                    {highlightCursor && highlightCursor.pageNum === pageNum && highlightMode === 'freehand' && tool === 'highlight' && (
                      <circle
                        cx={highlightCursor.x}
                        cy={highlightCursor.y}
                        r={(highlightSettings.strokeWidth / 2) * zoom}
                        fill="none"
                        stroke={hexToRgba(highlightSettings.color, 0.9)}
                        strokeWidth={2}
                        opacity={0.9}
                      />
                    )}
                    {/* Cursor preview ring för eraser */}
                    {eraserCursor && eraserCursor.pageNum === pageNum && tool === 'eraser' && (
                      <circle
                        cx={eraserCursor.x}
                        cy={eraserCursor.y}
                        r={(eraserSettings.size / 2) * zoom}
                        fill="none"
                        stroke={eraserCursorColor}
                        strokeWidth={2}
                        opacity={0.9}
                      />
                    )}
                  </svg>
                  
                  {/* Render text boxes för denna sida */}
                  {textBoxes
                    .filter((textBox) => {
                      const boxPageIndex = textBox.pageIndex !== undefined ? textBox.pageIndex : 0;
                      return boxPageIndex === index;
                    })
                    .map((textBox, localIndex) => {
                      const globalIndex = textBoxes.findIndex(tb => tb === textBox);
                      return (
                        <TransparentTextBox
                          key={`text-${pageNum}-${globalIndex}`}
                          textBox={{
                            ...textBox,
                            ...(selectedElement === globalIndex && selectedType === 'text' ? {
                              fontSizePt: textSettings.fontSizePt,
                              fontFamily: textSettings.fontFamily,
                              color: textSettings.color,
                              fontWeight: textSettings.fontWeight,
                              fontStyle: textSettings.fontStyle
                            } : {})
                          }}
                          zoom={zoom}
                          autoEdit={textBox.isNew === true}
                          textBoxIndex={globalIndex}
                          tool={tool}
                          hovered={tool === 'edit-text' && hoveredTextBoxIndex === globalIndex}
                          onHoverChange={(isHovering) => {
                            if (tool === 'edit-text') {
                              setHoveredTextBoxIndex(isHovering ? globalIndex : null);
                            }
                          }}
                          editTrigger={textEditTrigger && textEditTrigger.index === globalIndex ? textEditTrigger.nonce : null}
                          onEditComplete={() => {
                            setTextEditTrigger(null);
                          }}
                          onUpdate={(updated) => {
                            const newBoxes = [...textBoxes];
                            const prev = textBoxes[globalIndex];

                            // 1) Markera dirty först
                            let dirtyCandidate = markTextBoxDirty(prev, updated);

                            // 2) För importerad text: sampla maskColor direkt när den blir dirty,
                            // så originaltexten inte "blöder igenom" i UI.
                            if (dirtyCandidate?.isImported && dirtyCandidate?.isDirty && !dirtyCandidate?.maskColor) {
                              const rectForSample = prev?.originalRect || dirtyCandidate?.originalRect || dirtyCandidate?.rect || prev?.rect;
                              if (rectForSample) {
                                const sampleRectPx = rectPtToPx(rectForSample, zoom);
                                const sampled = sampleRectAverageColor(pageNum, sampleRectPx);
                                const maskColor = sampled || 'rgba(255,255,255,1)';
                                dirtyCandidate = markTextBoxDirty(prev, { ...dirtyCandidate, maskColor });
                              } else {
                                dirtyCandidate = markTextBoxDirty(prev, { ...dirtyCandidate, maskColor: 'rgba(255,255,255,1)' });
                              }
                            }

                            newBoxes[globalIndex] = dirtyCandidate;
                            setTextBoxes(newBoxes);
                            saveToHistory(newBoxes, null, null, null, commentBoxes);
                          }}
                          isSelected={selectedElement === globalIndex && selectedType === 'text'}
                          onResizeStart={(handle, e) => {
                            e.stopPropagation();
                            const canvasRef = canvasRefs.current[pageNum];
                            if (!canvasRef) return;
                            const canvasRect = canvasRef.getBoundingClientRect();
                            const mouseX = e.clientX - canvasRect.left;
                            const mouseY = e.clientY - canvasRect.top;
                            
                            const textBoxContainer = document.querySelector(`[data-textbox-container-index="${globalIndex}"]`);
                            let actualRectPx = rectPtToPx(textBox.rect, zoom);
                            
                            if (textBoxContainer) {
                              const rect = textBoxContainer.getBoundingClientRect();
                              const canvasRect = canvasRef.getBoundingClientRect();
                              actualRectPx = {
                                x: rect.left - canvasRect.left,
                                y: rect.top - canvasRect.top,
                                width: rect.width,
                                height: rect.height
                              };
                            }
                            
                            let edgeX = mouseX;
                            let edgeY = mouseY;
                            
                            if (handle.includes('n')) {
                              edgeY = actualRectPx.y;
                            } else if (handle.includes('s')) {
                              edgeY = actualRectPx.y + actualRectPx.height;
                            }
                            if (handle.includes('w')) {
                              edgeX = actualRectPx.x;
                            } else if (handle.includes('e')) {
                              edgeX = actualRectPx.x + actualRectPx.width;
                            }
                            
                            const actualRectPt = rectPxToPt(actualRectPx, zoom);
                            isResizingRef.current = true;
                            setIsResizing(true);
                            setResizeHandle(handle);
                            setDragStart({ x: edgeX, y: edgeY });
                            setOriginalRect(actualRectPt);
                            setOriginalFontSize(textBox.fontSizePt || 12);
                          }}
                          onRotationStart={(e) => {
                            e.stopPropagation();
                            const canvasRef = canvasRefs.current[pageNum];
                            if (!canvasRef) return;
                            const canvasRect = canvasRef.getBoundingClientRect();
                            const mouseX = e.clientX - canvasRect.left;
                            const mouseY = e.clientY - canvasRect.top;
                            
                            // Hitta textrutans centrum
                            const textBoxContainer = document.querySelector(`[data-textbox-container-index="${globalIndex}"]`);
                            let actualRectPx = rectPtToPx(textBox.rect, zoom);
                            
                            if (textBoxContainer) {
                              const rect = textBoxContainer.getBoundingClientRect();
                              const canvasRect = canvasRef.getBoundingClientRect();
                              actualRectPx = {
                                x: rect.left - canvasRect.left,
                                y: rect.top - canvasRect.top,
                                width: rect.width,
                                height: rect.height
                              };
                            }
                            
                            const centerX = actualRectPx.x + actualRectPx.width / 2;
                            const centerY = actualRectPx.y + actualRectPx.height / 2;
                            
                            setIsRotating(true);
                            setRotationStart({ x: mouseX, y: mouseY, centerX, centerY });
                            setInitialRotation(textBox.rotation || 0);
                          }}
                        />
                      );
                    })}
                  
                  {/* Render shape boxes för denna sida */}
                  {shapeBoxes
                    .filter((shapeBox) => {
                      const boxPageIndex = shapeBox.pageIndex !== undefined ? shapeBox.pageIndex : 0;
                      return boxPageIndex === index;
                    })
                    .map((shapeBox, localIndex) => {
                      const globalIndex = shapeBoxes.findIndex(sb => sb === shapeBox);
                      return (
                        <ShapeBox
                          key={`shape-${pageNum}-${globalIndex}`}
                          shape={{
                            ...shapeBox,
                            ...(shapeBox.type === 'highlight'
                              ? {
                                  fillColor: hexToRgba(shapeBox.fillColor || '#FFEB3B', shapeBox.opacity ?? 0.35),
                                  strokeColor: 'transparent'
                                }
                              : {}),
                            ...(selectedElement === globalIndex && selectedType === 'shape' && shapeBox.type !== 'highlight'
                              ? {
                                  strokeColor: shapeSettings.strokeColor,
                                  fillColor: shapeSettings.fillColor,
                                  strokeWidth: shapeSettings.strokeWidth
                                }
                              : {})
                          }}
                          zoom={zoom}
                          isSelected={selectedElement === globalIndex && selectedType === 'shape'}
                          tool={tool}
                          onUpdate={(updated) => {
                            const newBoxes = [...shapeBoxes];
                            newBoxes[globalIndex] = updated;
                            setShapeBoxes(newBoxes);
                            saveToHistory(null, null, null, newBoxes, commentBoxes);
                          }}
                          onResizeStart={(handle, e) => {
                            e.stopPropagation();
                            const isLineOrArrow = (shapeBox.type === 'line' || shapeBox.type === 'arrow') && shapeBox.startPoint && shapeBox.endPoint;
                            if (isLineOrArrow) return; // Endast resize för rektanglar/cirklar
                            const pageNum = shapeBox.pageIndex !== undefined ? shapeBox.pageIndex + 1 : currentPage;
                            const canvasRef = canvasRefs.current[pageNum];
                            if (!canvasRef) return;
                            const canvasRect = canvasRef.getBoundingClientRect();
                            const x = e.clientX - canvasRect.left;
                            const y = e.clientY - canvasRect.top;
                            setIsResizing(true);
                            setResizeHandle(handle);
                            setDragStart({ x, y });
                            setOriginalRect(shapeBox.rect);
                          }}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            const isLineOrArrow = (shapeBox.type === 'line' || shapeBox.type === 'arrow') && shapeBox.startPoint && shapeBox.endPoint;
                            if (isLineOrArrow) return; // Endast drag för rektanglar/cirklar, inte linjer/pilar
                            const pageNum = shapeBox.pageIndex !== undefined ? shapeBox.pageIndex + 1 : currentPage;
                            const canvasRef = canvasRefs.current[pageNum];
                            if (!canvasRef || !shapeBox.rect) return;
                            const canvasRect = canvasRef.getBoundingClientRect();
                            const x = e.clientX - canvasRect.left;
                            const y = e.clientY - canvasRect.top;
                            const sbRect = rectPtToPx(shapeBox.rect, zoom);
                            setIsDragging(true);
                            setDragStart({ x, y, startX: sbRect.x, startY: sbRect.y });
                            setOriginalRect(shapeBox.rect);
                          }}
                          onEndpointDragStart={(endpointType, e) => {
                            e.stopPropagation();
                            const pageNum = shapeBox.pageIndex !== undefined ? shapeBox.pageIndex + 1 : currentPage;
                            const canvasRef = canvasRefs.current[pageNum];
                            if (!canvasRef) return;
                            const canvasRect = canvasRef.getBoundingClientRect();
                            const x = e.clientX - canvasRect.left;
                            const y = e.clientY - canvasRect.top;
                            
                            if (shapeBox.startPoint && shapeBox.endPoint) {
                              setIsDraggingEndpoint(true);
                              setDraggingEndpointType(endpointType);
                              setOriginalStartPoint(shapeBox.startPoint);
                              setOriginalEndPoint(shapeBox.endPoint);
                              setDragStart({ x, y });
                            }
                          }}
                          onShapeClick={(e) => {
                            // När shape klickas och shape-verktyget inte är aktivt, aktivera det
                            const shapeType = shapeBox.type || 'rectangle';
                            const isHighlightShape = shapeType === 'highlight';
                            const isShapeToolActive = tool && (tool.startsWith('shape') || tool === 'highlight');
                            if (!isShapeToolActive) {
                              if (containerRef.current) {
                                scrollPositionRef.current = containerRef.current.scrollTop;
                              }
                              setTool(isHighlightShape ? 'highlight' : `shape-${shapeType}`);
                              setSelectedElement(globalIndex);
                              setSelectedType('shape');
                              // Starta dragging direkt
                              const pageNum = shapeBox.pageIndex !== undefined ? shapeBox.pageIndex + 1 : currentPage;
                              const canvasRef = canvasRefs.current[pageNum];
                              if (canvasRef) {
                                const canvasRect = canvasRef.getBoundingClientRect();
                                const x = e.clientX - canvasRect.left;
                                const y = e.clientY - canvasRect.top;
                                const isLineOrArrow = (shapeBox.type === 'line' || shapeBox.type === 'arrow') && shapeBox.startPoint && shapeBox.endPoint;
                                if (isLineOrArrow && shapeBox.startPoint && shapeBox.endPoint) {
                                  setIsDragging(true);
                                  setOriginalStartPoint(shapeBox.startPoint);
                                  setOriginalEndPoint(shapeBox.endPoint);
                                  setDragStart({ x, y });
                                } else if (shapeBox.rect) {
                                  const sbRect = rectPtToPx(shapeBox.rect, zoom);
                                  setIsDragging(true);
                                  setDragStart({ x, y, startX: sbRect.x, startY: sbRect.y });
                                  setOriginalRect(shapeBox.rect);
                                }
                              }
                            }
                          }}
                        />
                      );
                    })}
                  
                  {/* Render comment boxes för denna sida */}
                  {commentBoxes
                    .filter((commentBox) => {
                      const boxPageIndex = commentBox.pageIndex !== undefined ? commentBox.pageIndex : 0;
                      return boxPageIndex === index;
                    })
                    .map((commentBox, localIndex) => {
                      const globalIndex = commentBoxes.findIndex(cb => cb === commentBox);
                      return (
                        <CommentBox
                          key={`comment-${pageNum}-${globalIndex}`}
                          commentBox={commentBox}
                          zoom={zoom}
                          isSelected={selectedElement === globalIndex && selectedType === 'comment'}
                          forceHidePopup={isDragging && selectedType === 'comment'}
                          onUpdate={(updated) => {
                            const newBoxes = [...commentBoxes];
                            newBoxes[globalIndex] = updated;
                            setCommentBoxes(newBoxes);
                            saveToHistory(null, null, null, null, newBoxes);
                          }}
                          onDelete={(commentIdOrBox) => {
                            // Hitta kommentaren baserat på id eller index
                            const indexToDelete = typeof commentIdOrBox === 'string' 
                              ? commentBoxes.findIndex(cb => cb.id === commentIdOrBox)
                              : commentBoxes.findIndex(cb => cb === commentIdOrBox);
                            
                            if (indexToDelete !== -1) {
                              const newBoxes = commentBoxes.filter((_, i) => i !== indexToDelete);
                              setCommentBoxes(newBoxes);
                              if (selectedElement === indexToDelete && selectedType === 'comment') {
                                setSelectedElement(null);
                                setSelectedType(null);
                              }
                              saveToHistory(null, null, null, null, newBoxes);
                            }
                          }}
                          onEditEnd={handleCommentEditEnd}
                        />
                      );
                    })}
                  
                  {/* Drawing preview för punkt-till-punkt linjer/pilar */}
                  {isDrawing && lineStartPoint && lineEndPoint && drawingPage === pageNum && (tool === 'shape-line' || tool === 'shape-arrow') && (
                    <svg
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        overflow: 'visible'
                      }}
                    >
                      {(() => {
                        const shapeType = tool.replace('shape-', '');
                        const strokeColor = shapeSettings.strokeColor || '#000000';
                        const strokeWidth = shapeSettings.strokeWidth || 2;

                        if (shapeType === 'line') {
                          return (
                            <line
                              x1={lineStartPoint.x}
                              y1={lineStartPoint.y}
                              x2={lineEndPoint.x}
                              y2={lineEndPoint.y}
                              stroke={strokeColor}
                              strokeWidth={strokeWidth}
                              strokeDasharray="5,5"
                              opacity={0.8}
                            />
                          );
                        } else if (shapeType === 'arrow') {
                          const dx = lineEndPoint.x - lineStartPoint.x;
                          const dy = lineEndPoint.y - lineStartPoint.y;
                          const angle = Math.atan2(dy, dx);
                          const length = Math.sqrt(dx * dx + dy * dy);
                          const arrowHeadLength = Math.min(15, length * 0.2);
                          const arrowHeadAngle = Math.PI / 6; // 30 degrees
                          
                          return (
                            <g opacity={0.8}>
                              <line
                                x1={lineStartPoint.x}
                                y1={lineStartPoint.y}
                                x2={lineEndPoint.x}
                                y2={lineEndPoint.y}
                                stroke={strokeColor}
                                strokeWidth={strokeWidth}
                                strokeDasharray="5,5"
                              />
                              <polygon
                                points={`
                                  ${lineEndPoint.x},${lineEndPoint.y}
                                  ${lineEndPoint.x - arrowHeadLength * Math.cos(angle - arrowHeadAngle)},${lineEndPoint.y - arrowHeadLength * Math.sin(angle - arrowHeadAngle)}
                                  ${lineEndPoint.x - arrowHeadLength * Math.cos(angle + arrowHeadAngle)},${lineEndPoint.y - arrowHeadLength * Math.sin(angle + arrowHeadAngle)}
                                `}
                                fill={strokeColor}
                              />
                            </g>
                          );
                        }
                        return null;
                      })()}
                    </svg>
                  )}
                  
                  {/* Drawing preview för rektanglar/cirklar och whiteout */}
                  {isDrawing && currentRect && drawingPage === pageNum && !(tool === 'shape-line' || tool === 'shape-arrow') && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${currentRect.x}px`,
                        top: `${currentRect.y}px`,
                        width: `${currentRect.width}px`,
                        height: `${currentRect.height}px`,
                        border: tool && tool.startsWith('shape') ? '1px dashed rgba(255, 107, 53, 0.5)' : '2px dashed #0066ff',
                        backgroundColor: tool === 'whiteout' ? (() => {
                          // Konvertera hex till rgba med 50% opacity
                          const hex = whiteoutColor.replace('#', '');
                          const r = parseInt(hex.substring(0, 2), 16);
                          const g = parseInt(hex.substring(2, 4), 16);
                          const b = parseInt(hex.substring(4, 6), 16);
                          return `rgba(${r}, ${g}, ${b}, 0.5)`;
                        })() : (tool && tool.startsWith('shape') ? 'transparent' : 'transparent'),
                        pointerEvents: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* Shape preview - Visa faktisk form med SVG */}
                      {tool && tool.startsWith('shape') && (
                        <svg
                          width={currentRect.width}
                          height={currentRect.height}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            overflow: 'visible'
                          }}
                        >
                          {(() => {
                            const shapeType = shapeSettings.type || tool.replace('shape-', '');
                            const width = currentRect.width;
                            const height = currentRect.height;
                            const centerX = width / 2;
                            const centerY = height / 2;
                            const strokeColor = shapeSettings.strokeColor || '#000000';
                            const fillColor = shapeSettings.fillColor || 'transparent';
                            const strokeWidth = shapeSettings.strokeWidth || 2;

                            switch (shapeType) {
                              case 'rectangle':
                                return (
                                  <rect
                                    x={0}
                                    y={0}
                                    width={width}
                                    height={height}
                                    fill={fillColor === 'transparent' ? 'none' : fillColor}
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    opacity={0.8}
                                  />
                                );
                              
                              case 'circle':
                                const radius = Math.min(width, height) / 2;
                                return (
                                  <ellipse
                                    cx={centerX}
                                    cy={centerY}
                                    rx={radius}
                                    ry={radius}
                                    fill={fillColor === 'transparent' ? 'none' : fillColor}
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    opacity={0.8}
                                  />
                                );
                              
                              default:
                                return null;
                            }
                          })()}
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#666'
          }}>
            <p>Ladda en PDF-fil för att börja redigera</p>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Floating Control Bar */}
      {pdfDoc && (
        <FloatingControlBar
          currentPage={currentPage}
          totalPages={pdfDoc.numPages}
          onPageChange={(pageNum) => {
            currentPageRef.current = pageNum;
            setCurrentPage(pageNum);
            scrollToPage(pageNum);
          }}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          panToolActive={tool === 'pan'}
          onPanToolToggle={() => {
            if (tool === 'pan') {
              setTool(null);
            } else {
              setTool('pan');
            }
          }}
          sidebarWidth={sidebarWidth}
        />
      )}

      {/* Download Modal */}
      <DownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        onDownload={handleDownload}
        defaultFilename="intyg_164879456"
      />

      {/* Page Management Panel */}
      {showPageManagementPanel && pdfDoc && (
        <PageManagementPanel
          pdfDoc={pdfDoc}
          numPages={pdfDoc.numPages}
          currentPage={currentPage}
          onRotatePage={handleRotatePages}
          onDeletePage={handleDeletePages}
          onAddPage={handleAddPage}
          onDuplicatePages={handleDuplicatePages}
          onMovePages={handleMovePages}
          onClose={() => setShowPageManagementPanel(false)}
        />
      )}

      {/* Loading Spinner */}
      {isLoading && <LoadingSpinner message={loadingMessage} />}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

