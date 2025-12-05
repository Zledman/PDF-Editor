import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';
import TransparentTextBox from './components/TransparentTextBox';
import WhiteoutBox from './components/WhiteoutBox';
import PatchBox from './components/PatchBox';
import LandingPage from './components/LandingPage';
import ThumbnailSidebar from './components/ThumbnailSidebar';
import FloatingControlBar from './components/FloatingControlBar';
import DownloadModal from './components/DownloadModal';
import { exportPDF } from './services/pdfExport';
import { loadPDF } from './services/pdfService';
import { exportAsPDF, exportAsPNG, exportAsJPG, exportAsExcel, exportAsWord, exportAsPPTX } from './services/fileExport';
import { pxToPt, rectPxToPt, rectPtToPx } from './utils/coordMap';
import { MIN_FONT_PT } from './utils/textLayoutConstants';

// Konfigurera PDF.js worker
if (typeof window !== 'undefined') {
  // Använd CDN för PDF.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfData, setPdfData] = useState(null); // Spara original PDF data för export
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfPages, setPdfPages] = useState([]); // Array av alla renderade PDF-sidor
  const [pageViewports, setPageViewports] = useState([]); // Viewports för alla sidor
  const [pageHeights, setPageHeights] = useState([]); // Höjder för alla sidor (för scroll-tracking)
  const [zoom, setZoom] = useState(1.0);
  const [tool, setTool] = useState(null); // 'text', 'whiteout', 'patch', 'pan', eller null för inget verktyg
  const [patchMode, setPatchMode] = useState('select'); // 'select' eller 'place'
  const [sourceRect, setSourceRect] = useState(null);
  const [sourcePageIndex, setSourcePageIndex] = useState(null); // Vilken sida som är källan för patchen
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  
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
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(200); // Bredd på thumbnail sidebar
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  
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

  // Spara tillstånd till history (måste vara före useEffect som använder den)
  const saveToHistory = useCallback((newTextBoxes = null, newWhiteoutBoxes = null, newPatchBoxes = null) => {
    const state = {
      textBoxes: JSON.parse(JSON.stringify(newTextBoxes !== null ? newTextBoxes : textBoxes)),
      whiteoutBoxes: JSON.parse(JSON.stringify(newWhiteoutBoxes !== null ? newWhiteoutBoxes : whiteoutBoxes)),
      patchBoxes: JSON.parse(JSON.stringify(newPatchBoxes !== null ? newPatchBoxes : patchBoxes))
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
  }, [textBoxes, whiteoutBoxes, patchBoxes, historyIndex]);

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
          newBoxes[selectedElement] = {
            ...selectedTextBox,
            fontSizePt: Math.round(textSettings.fontSizePt),
            fontFamily: textSettings.fontFamily,
            color: textSettings.color,
            fontWeight: textSettings.fontWeight,
            fontStyle: textSettings.fontStyle
          };
          setTextBoxes(newBoxes);
          // Spara till history när inställningar ändras
          const timer = setTimeout(() => {
            saveToHistory(newBoxes, null, null);
          }, 500); // Debounce för att inte spara för ofta
          return () => clearTimeout(timer);
        }
      }
    }
  }, [textSettings, selectedElement, selectedType, textBoxes, saveToHistory]);
  
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
  const [dragStart, setDragStart] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [originalRect, setOriginalRect] = useState(null);
  const [originalFontSize, setOriginalFontSize] = useState(null); // Spara original fontstorlek vid resize

  // Ångra (Undo)
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setTextBoxes(JSON.parse(JSON.stringify(state.textBoxes)));
      setWhiteoutBoxes(JSON.parse(JSON.stringify(state.whiteoutBoxes)));
      setPatchBoxes(JSON.parse(JSON.stringify(state.patchBoxes)));
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
        textBoxes: [],
        whiteoutBoxes: [],
        patchBoxes: []
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
      saveToHistory(newBoxes, null, null);
    } else if (selectedType === 'whiteout') {
      const newBoxes = whiteoutBoxes.filter((_, i) => i !== selectedElement);
      setWhiteoutBoxes(newBoxes);
      saveToHistory(null, newBoxes, null);
    } else if (selectedType === 'patch') {
      const newBoxes = patchBoxes.filter((_, i) => i !== selectedElement);
      setPatchBoxes(newBoxes);
      saveToHistory(null, null, newBoxes);
    }

    setSelectedElement(null);
    setSelectedType(null);
  }, [selectedElement, selectedType, textBoxes, whiteoutBoxes, patchBoxes, saveToHistory]);

  // Stäng färgpaletten när man klickar utanför
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showColorPalette && !e.target.closest('[data-color-picker]')) {
        setShowColorPalette(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPalette]);

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
            : 'Vill du ta bort detta kopierade område?';
          
          if (window.confirm(confirmMessage)) {
            handleDelete();
          }
          return;
        }
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
          setHistoryIndex(newIndex);
          setSelectedElement(null);
          setSelectedType(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, selectedElement, selectedType, handleDelete]);

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
      setPageHeights([]);
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
      const heights = [];
      let cumulativeHeight = 0;

      // Avbryt alla tidigare render-tasks först
      Object.values(renderTasksRef.current).forEach(task => {
        if (task && task.cancel) {
          task.cancel();
        }
      });
      renderTasksRef.current = {};

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: zoom });
          
          pages.push(page);
          viewports.push(viewport);
          
          // Beräkna kumulativ höjd för scroll-tracking
          cumulativeHeight += viewport.height;
          heights.push(cumulativeHeight);
          
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
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              context.clearRect(0, 0, canvas.width, canvas.height);
              
              // Starta ny render-operation och spara task
              const renderTask = page.render({
                canvasContext: context,
                viewport: viewport
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
        setPageHeights(heights);
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

  // Uppdatera currentPage baserat på scroll-position
  useEffect(() => {
    if (!containerRef.current || pageHeights.length === 0) return;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const viewportCenter = scrollTop + containerHeight / 2;

      // Hitta vilken sida som är i mitten av viewport
      let newCurrentPage = 1;
      for (let i = 0; i < pageHeights.length; i++) {
        const pageTop = i === 0 ? 0 : pageHeights[i - 1];
        const pageBottom = pageHeights[i];
        
        if (viewportCenter >= pageTop && viewportCenter < pageBottom) {
          newCurrentPage = i + 1;
          break;
        }
      }

      if (newCurrentPage !== currentPage) {
        setCurrentPage(newCurrentPage);
      }
    };

    const container = containerRef.current;
    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Kör direkt för att sätta initial currentPage

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [pageHeights, currentPage]);

  const handleFileUpload = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Vänligen välj en PDF-fil');
      return;
    }

    try {
      const data = await loadPDF(file);
      // Skapa en kopia av ArrayBuffer via Uint8Array innan PDF.js använder den (för att undvika detached ArrayBuffer)
      // Detta säkerställer att vi har en oberoende kopia som inte kan bli detached
      const uint8Array = new Uint8Array(data);
      const dataCopy = uint8Array.slice().buffer; // Skapa en helt ny kopia
      setPdfData(dataCopy); // Spara kopia av original PDF data
      const loadingTask = pdfjsLib.getDocument({ data: data });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setCurrentPage(1);
      setPdfPages([]);
      setPageViewports([]);
      setPageHeights([]);
      canvasRefs.current = {};
      pageContainerRefs.current = {};
      setTextBoxes([]);
      setWhiteoutBoxes([]);
      setPatchBoxes([]);
      // History initieras i useEffect när pdfDoc sätts
    } catch (error) {
      console.error('Fel vid laddning av PDF:', error);
      alert('Kunde inte ladda PDF-filen');
    }
  };

  const handleFileSelect = async (file) => {
    await handleFileUpload(file);
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
    if (!clickedPage || !canvasRefs.current[clickedPage.pageNum]) return;
    
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

    // Kontrollera om vi klickade på ett befintligt element
    let clickedElement = null;
    let clickedType = null;

    // Kontrollera textBoxes (endast för aktuell sida)
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

    if (clickedElement === null) {
      // Kontrollera whiteoutBoxes (endast för aktuell sida)
      // Hoppa över whiteout-box-kontrollen när text-verktyget är aktivt, så att text kan skapas ovanpå whiteout-boxar
      // Men hoppa över om det är en resize-handle
      if (tool !== 'text' && !e.target.dataset.resizeHandle) {
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
      // Hoppa över patch-box-kontrollen när text-verktyget är aktivt, så att text kan skapas ovanpå patch-boxar
      if (tool !== 'text') {
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

    if (clickedElement !== null) {
      // Om whiteout-verktyget inte är aktivt, avmarkera elementet när man klickar på det
      if (clickedType === 'whiteout' && tool !== 'whiteout') {
        setSelectedElement(null);
        setSelectedType(null);
        return;
      }
      
      // Om patch-verktyget inte är aktivt, avmarkera elementet när man klickar på det
      if (clickedType === 'patch' && tool !== 'patch') {
        setSelectedElement(null);
        setSelectedType(null);
        return;
      }
      
      // Om text är vald, aktivera text-verktyget så att sidebar visas
      if (clickedType === 'text') {
        // Spara scroll-position innan vi ändrar tool (för att behålla PDF-canvas position)
        if (containerRef.current) {
          scrollPositionRef.current = containerRef.current.scrollTop;
        }
        setTool('text');
      }
      
      setSelectedElement(clickedElement);
      setSelectedType(clickedType);
      
      // Om text är vald och inte i edit-läge, starta drag (men inte om det är en resize-handle)
      if (clickedType === 'text' && !e.target.dataset.resizeHandle && !e.target.closest('textarea')) {
        const tb = textBoxes[clickedElement];
        const tbRect = rectPtToPx(tb.rect, zoom);
        setIsDragging(true);
        setDragStart({ x, y, startX: tbRect.x, startY: tbRect.y });
        setOriginalRect(tb.rect);
      }
      
      // Om whiteout är vald och verktyget är whiteout, starta drag (men inte om det är en resize-handle)
      if (clickedType === 'whiteout' && tool === 'whiteout' && !e.target.dataset.resizeHandle) {
        const wb = whiteoutBoxes[clickedElement];
        const wbRect = rectPtToPx(wb.rect, zoom);
        setIsDragging(true);
        setDragStart({ x, y, startX: wbRect.x, startY: wbRect.y });
        setOriginalRect(wb.rect);
      }
      
      // Om patch är vald och verktyget är patch, starta drag
      if (clickedType === 'patch' && tool === 'patch') {
        const pb = patchBoxes[clickedElement];
        const pbRect = rectPtToPx(pb.targetRect, zoom);
        setIsDragging(true);
        setDragStart({ x, y, startX: pbRect.x, startY: pbRect.y });
        setOriginalRect(pb.targetRect);
      }
      return;
    }
    
    // Om vi klickade utanför alla element, avmarkera allt
    if (clickedElement === null && !e.target.closest('textarea')) {
      setSelectedElement(null);
      setSelectedType(null);
      // Behåll text-verktyget aktivt så att sidebar stannar kvar och användaren kan fortsätta skapa textrutor
      // Användaren kan stänga av text-verktyget manuellt genom att klicka på knappen igen
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
      saveToHistory(null, null, newPatchBoxes);
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
        pageIndex: currentPage - 1,
        isNew: true // Markera som ny för auto-edit
      };
      const newTextBoxes = [...textBoxes, newTextBox];
      setTextBoxes(newTextBoxes);
      const newIndex = textBoxes.length;
      setSelectedElement(newIndex);
      setSelectedType('text');
      saveToHistory(newTextBoxes, null, null);
      
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
    
    // För whiteout, börja rita (endast om verktyget är aktivt och vi inte klickade på en befintlig ruta)
    if (tool === 'whiteout' && clickedElement === null) {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
      setDrawingPage(clickedPage.pageNum);
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
      newBoxes[selectedElement] = { 
        ...tb, 
        rect: newRectPt,
        fontSizePt: newFontSizePt
      };
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
      const newBoxes = [...textBoxes];
      newBoxes[selectedElement] = { ...tb, rect: newRectPt };
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

    // Hantera rita nya element
    if (!isDrawing || !drawStart) return;

    const width = Math.abs(x - drawStart.x);
    const height = Math.abs(y - drawStart.y);
    const minX = Math.min(drawStart.x, x);
    const minY = Math.min(drawStart.y, y);

    setCurrentRect({ x: minX, y: minY, width, height });
  };

  const handleMouseUp = () => {
    // Stoppa panning
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Hantera resize/drag avslut
    if (isResizing || isDragging) {
      if (selectedElement !== null && selectedType === 'whiteout') {
        saveToHistory(null, whiteoutBoxes, null);
      } else if (selectedElement !== null && selectedType === 'patch') {
        saveToHistory(null, null, patchBoxes);
      } else if (selectedElement !== null && selectedType === 'text') {
        // Spara till history för textbox resize/drag
        saveToHistory(textBoxes, null, null);
      }
      setIsResizing(false);
      setIsDragging(false);
      setResizeHandle(null);
      setDragStart(null);
      setOriginalRect(null);
      setOriginalFontSize(null);
      // Återställ resize-flaggan så att useEffect kan köras igen
      isResizingRef.current = false;
    }
    
    if (!isDrawing || !drawStart || !currentRect) {
      setIsDrawing(false);
      return;
    }

    // Kontrollera minsta storlek för att skapa en box (minst 20px i både width och height)
    const minSize = 20;
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
        isNew: true // Markera som ny för auto-edit
      };
      const newTextBoxes = [...textBoxes, newTextBox];
      setTextBoxes(newTextBoxes);
      const newIndex = textBoxes.length;
      setSelectedElement(newIndex);
      setSelectedType('text');
      saveToHistory(newTextBoxes, null, null);
      
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
        pageIndex: drawingPageNum - 1
      };
      const newWhiteoutBoxes = [...whiteoutBoxes, newWhiteout];
      setWhiteoutBoxes(newWhiteoutBoxes);
      setSelectedElement(whiteoutBoxes.length);
      setSelectedType('whiteout');
      saveToHistory(null, newWhiteoutBoxes, null);
    } else if (tool === 'patch' && patchMode === 'select') {
      // Spara sourceRect och växla till place-mode
      const drawingPageNum = drawingPage || currentPage;
      setSourceRect(rectPt);
      setSourcePageIndex(drawingPageNum - 1); // Spara källsidan
      setPatchMode('place');
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

  const handleExport = async () => {
    if (!pdfDoc || !pdfData) {
      alert('Ingen PDF laddad');
      return;
    }

    try {
      const exported = await exportPDF(pdfData, textBoxes, whiteoutBoxes, patchBoxes);
      const blob = new Blob([exported], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'redigerad.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fel vid export:', error);
      alert(t('errors.exportFailed') + ': ' + error.message);
    }
  };

  const handleDownload = async (format, filename) => {
    if (!pdfDoc || !pdfData) {
      alert('Ingen PDF laddad');
      return;
    }

    try {
      let result;
      
      switch (format) {
        case 'pdf':
          result = await exportAsPDF(pdfData, textBoxes, whiteoutBoxes, patchBoxes);
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
          alert('Okänt filformat');
      }
    } catch (error) {
      console.error('Fel vid nedladdning:', error);
      alert(t('errors.exportFailed') + ': ' + error.message);
    }
  };


  // Visa landing page om ingen PDF är laddad
  if (!pdfDoc) {
    return <LandingPage onFileSelect={handleFileSelect} />;
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
            setPdfPage(null);
            setTextBoxes([]);
            setWhiteoutBoxes([]);
            setPatchBoxes([]);
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
          
          <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {t('toolbar.zoom')}:
            <input
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
              setCurrentPage(pageNum);
              scrollToPage(pageNum);
            }}
            zoom={zoom}
            sidebarWidth={sidebarWidth}
            onWidthChange={handleSidebarWidthChange}
          />
        )}
        
        {/* Text Settings Sidebar - Använd position absolute så den inte påverkar layouten */}
        {tool === 'text' && (
          <div
            style={{
              position: 'absolute',
              top: 0, // Direkt vid kanten där verktygsfältet börjar
              left: pdfDoc ? `${sidebarWidth}px` : '0', // Börja efter thumbnail sidebar
              right: '17px', // Lämna utrymme för scrollbaren (vanligtvis 15-17px)
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

          {/* Font Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
              {t('textSidebar.size')}:
            </label>
            <input
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
            <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
              {t('textSidebar.fontFamily')}:
            </label>
            <select
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
            <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
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
          tool === 'text' ? 'text-cursor' : 
          (tool === 'whiteout' || tool === 'patch' ? 'crosshair-cursor' : '')
        }
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          backgroundColor: '#1a1a1a',
          cursor: tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : undefined
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {pdfDoc ? (
          <div style={{ 
            position: 'relative', 
            paddingTop: tool === 'text' ? '180px' : '100px', // Extra padding när text sidebar är synlig
            paddingLeft: '20px',
            paddingRight: '20px',
            paddingBottom: '20px',
            minWidth: 'max-content',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px' // Mellanrum mellan sidor
          }}>
            {/* Rendera alla sidor vertikalt */}
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
                    marginBottom: index < pdfPages.length - 1 ? '20px' : '0'
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
                      backgroundColor: 'white'
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
                    onUpdate={(updated) => {
                      const newBoxes = [...whiteoutBoxes];
                      newBoxes[globalIndex] = updated;
                      setWhiteoutBoxes(newBoxes);
                      saveToHistory(null, newBoxes, null);
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
                            saveToHistory(null, null, newBoxes);
                          }}
                        />
                      );
                    })}
                  
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
                          onUpdate={(updated) => {
                            const newBoxes = [...textBoxes];
                            newBoxes[globalIndex] = updated;
                            setTextBoxes(newBoxes);
                            saveToHistory(newBoxes, null, null);
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
                        />
                      );
                    })}
                  
                  {/* Drawing preview för denna sida */}
                  {isDrawing && currentRect && drawingPage === pageNum && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${currentRect.x}px`,
                        top: `${currentRect.y}px`,
                        width: `${currentRect.width}px`,
                        height: `${currentRect.height}px`,
                        border: '2px dashed #0066ff',
                        backgroundColor: tool === 'whiteout' ? 'rgba(255,255,255,0.5)' : 'transparent',
                        pointerEvents: 'none'
                      }}
                    />
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
    </div>
  );
}

