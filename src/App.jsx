import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import TransparentTextBox from './components/TransparentTextBox';
import WhiteoutBox from './components/WhiteoutBox';
import PatchBox from './components/PatchBox';
import LandingPage from './components/LandingPage';
import { exportPDF } from './services/pdfExport';
import { loadPDF } from './services/pdfService';
import { pxToPt, rectPxToPt, rectPtToPx } from './utils/coordMap';
import { MIN_FONT_PT } from './utils/textLayoutConstants';

// Konfigurera PDF.js worker
if (typeof window !== 'undefined') {
  // Använd CDN för PDF.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export default function App() {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfData, setPdfData] = useState(null); // Spara original PDF data för export
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfPage, setPdfPage] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const [tool, setTool] = useState(null); // 'text', 'whiteout', 'patch', eller null för inget verktyg
  const [patchMode, setPatchMode] = useState('select'); // 'select' eller 'place'
  const [sourceRect, setSourceRect] = useState(null);
  
  // Text-inställningar
  const [textSettings, setTextSettings] = useState({
    fontSizePt: 12,
    fontFamily: 'Helvetica',
    color: '#000000',
    fontWeight: 'normal',
    fontStyle: 'normal'
  });
  
  const [textBoxes, setTextBoxes] = useState([]);
  const [whiteoutBoxes, setWhiteoutBoxes] = useState([]);
  const [patchBoxes, setPatchBoxes] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  // Uppdatera textSettings när en textbox är vald
  useEffect(() => {
    if (selectedType === 'text' && selectedElement !== null) {
      const selectedTextBox = textBoxes[selectedElement];
      if (selectedTextBox) {
        setTextSettings({
          fontSizePt: selectedTextBox.fontSizePt || 12,
          fontFamily: selectedTextBox.fontFamily || 'Helvetica',
          color: selectedTextBox.color || '#000000',
          fontWeight: selectedTextBox.fontWeight || 'normal',
          fontStyle: selectedTextBox.fontStyle || 'normal'
        });
      }
    }
  }, [selectedElement, selectedType, textBoxes]);

  // Uppdatera vald textbox när textSettings ändras
  useEffect(() => {
    if (selectedType === 'text' && selectedElement !== null && textBoxes[selectedElement]) {
      const newBoxes = [...textBoxes];
      const selectedTextBox = newBoxes[selectedElement];
      if (selectedTextBox) {
        // Kontrollera om något faktiskt har ändrats för att undvika oändlig loop
        const hasChanged = 
          selectedTextBox.fontSizePt !== textSettings.fontSizePt ||
          selectedTextBox.fontFamily !== textSettings.fontFamily ||
          selectedTextBox.color !== textSettings.color ||
          selectedTextBox.fontWeight !== textSettings.fontWeight ||
          selectedTextBox.fontStyle !== textSettings.fontStyle;

        if (hasChanged) {
          newBoxes[selectedElement] = {
            ...selectedTextBox,
            fontSizePt: textSettings.fontSizePt,
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
  }, [textSettings, selectedElement, selectedType, textBoxes]);
  
  // History för undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 50;
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  
  // State för drag och resize
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [originalRect, setOriginalRect] = useState(null);

  // Spara tillstånd till history
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
            : 'Vill du ta bort denna patch?';
          
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

  // Rendera PDF-sida
  useEffect(() => {
    if (pdfDoc && currentPage && canvasRef.current) {
      // Vänta lite för att säkerställa att canvas är monterad
      const timer = setTimeout(() => {
        renderPage();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pdfDoc, currentPage, zoom]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) {
      console.log('renderPage: pdfDoc eller canvasRef saknas', { pdfDoc: !!pdfDoc, canvasRef: !!canvasRef.current });
      return;
    }

    try {
      console.log('Rendering page', currentPage);
      const page = await pdfDoc.getPage(currentPage);
      setPdfPage(page);
      
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Sätt canvas-storlek
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Rensa canvas först
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Rendera PDF-sidan
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      console.log('PDF renderad framgångsrikt', { width: canvas.width, height: canvas.height });
    } catch (error) {
      console.error('Fel vid rendering av PDF:', error);
      alert('Kunde inte rendera PDF: ' + error.message);
    }
  };

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

  const handleMouseDown = (e) => {
    if (!pdfPage || !canvasRef.current) return;

    // Beräkna koordinater relativt till canvas, inte containern
    const containerRect = containerRef.current.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Koordinater relativt till canvas
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

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
      // Men hoppa över om det är en resize-handle
      if (!e.target.dataset.resizeHandle) {
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
      
      setSelectedElement(clickedElement);
      setSelectedType(clickedType);
      
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

    // Om patch-läge och select-mode, börja markera sourceRect
    if (tool === 'patch' && patchMode === 'select') {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
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
        targetRect: targetRectPt,
        pageIndex: currentPage - 1
      };
      
      const newPatchBoxes = [...patchBoxes, newPatch];
      setPatchBoxes(newPatchBoxes);
      setPatchMode('select');
      setSourceRect(null);
      saveToHistory(null, null, newPatchBoxes);
      return;
    }

    // För text och whiteout, börja rita (endast om verktyget är aktivt och vi inte klickade på en befintlig ruta)
    // Om whiteout-verktyget är aktivt och vi klickade på en whiteout-ruta, starta drag istället för att rita
    if (tool === 'text' || (tool === 'whiteout' && clickedElement === null)) {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

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
    // Hantera resize/drag avslut
    if (isResizing || isDragging) {
      if (selectedElement !== null && selectedType === 'whiteout') {
        saveToHistory(null, whiteoutBoxes, null);
      } else if (selectedElement !== null && selectedType === 'patch') {
        saveToHistory(null, null, patchBoxes);
      }
      setIsResizing(false);
      setIsDragging(false);
      setResizeHandle(null);
      setDragStart(null);
      setOriginalRect(null);
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
      
      // Ta bort isNew-flaggan efter en kort delay för att undvika att den alltid är i edit-läge
      setTimeout(() => {
        setTextBoxes(prev => prev.map((tb, i) => 
          i === newIndex ? { ...tb, isNew: false } : tb
        ));
      }, 100);
    } else if (tool === 'whiteout') {
      const newWhiteout = {
        rect: rectPt,
        pageIndex: currentPage - 1
      };
      const newWhiteoutBoxes = [...whiteoutBoxes, newWhiteout];
      setWhiteoutBoxes(newWhiteoutBoxes);
      setSelectedElement(whiteoutBoxes.length);
      setSelectedType('whiteout');
      saveToHistory(null, newWhiteoutBoxes, null);
    } else if (tool === 'patch' && patchMode === 'select') {
      // Spara sourceRect och växla till place-mode
      setSourceRect(rectPt);
      setPatchMode('place');
    }

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentRect(null);
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
      alert('Kunde inte exportera PDF: ' + error.message);
    }
  };


  // Visa landing page om ingen PDF är laddad
  if (!pdfDoc) {
    return <LandingPage onFileSelect={handleFileSelect} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Toolbar */}
      <div style={{
        padding: '10px',
        backgroundColor: '#1a1a1a',
        borderBottom: '2px solid #ff6b35',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap'
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
          ← Ny PDF
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
          Lägg till text
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
          Whiteout
        </button>
        
        <button
          onClick={() => {
            // Växla verktyget av/on
            if (tool === 'patch') {
              setTool(null);
              setPatchMode('select');
              setSourceRect(null);
              // Avmarkera patch-rutor när verktyget stängs av
              if (selectedType === 'patch') {
                setSelectedElement(null);
                setSelectedType(null);
              }
            } else {
              setTool('patch');
              setPatchMode('select');
              setSourceRect(null);
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
          Patch {patchMode === 'select' ? '(Välj område)' : '(Placera)'}
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
            Ta bort
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
            title="Ångra (Ctrl+Z)"
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
            ↶ Ångra
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
            title="Gör om (Ctrl+Y)"
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
            ↷ Gör om
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center', color: '#fff' }}>
          <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Zoom:
            <input
              type="range"
              min="0.5"
              max="2"
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
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                Föregående
              </button>
              <span style={{ color: '#fff', padding: '0 10px' }}>Sida {currentPage} av {pdfDoc.numPages}</span>
              <button
                onClick={() => setCurrentPage(Math.min(pdfDoc.numPages, currentPage + 1))}
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
                Nästa
              </button>
            </>
          )}

          <button
            onClick={handleExport}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff6b35',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '5px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ff8c42';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff6b35';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Exportera PDF
          </button>
        </div>
      </div>

      {/* Text Settings Sidebar */}
      {tool === 'text' && (
        <div
          style={{
            backgroundColor: '#2a2a2a',
            borderBottom: '1px solid #444',
            padding: '15px 20px',
            display: 'flex',
            gap: '30px',
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

          {/* Font Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
              Storlek:
            </label>
            <input
              type="number"
              min="6"
              max="72"
              value={textSettings.fontSizePt}
              onChange={(e) => {
                const value = Math.max(6, Math.min(72, parseInt(e.target.value) || 12));
                setTextSettings({ ...textSettings, fontSizePt: value });
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
              Typsnitt:
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500', minWidth: '80px' }}>
              Färg:
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
              Stil:
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
                title="Fet"
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
                title="Kursiv"
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
            <span style={{ color: '#888', fontSize: '0.85rem', marginRight: '5px' }}>Förhandsvisning:</span>
            <span
              style={{
                fontSize: `${textSettings.fontSizePt * 0.8}px`,
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

      {/* PDF Viewer */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          backgroundColor: '#1a1a1a',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '20px',
          cursor: tool === 'text' || tool === 'whiteout' || tool === 'patch' ? 'crosshair' : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {pdfDoc ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas
              ref={canvasRef}
              style={{
                border: '1px solid #ccc',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                display: 'block',
                backgroundColor: 'white'
              }}
            />
            
            {/* Render text boxes */}
            {textBoxes
              .map((textBox, globalIndex) => {
                // Visa endast element för aktuell sida
                if (textBox.pageIndex !== undefined && textBox.pageIndex !== currentPage - 1) {
                  return null;
                }
                return (
                  <TransparentTextBox
                    key={`text-${globalIndex}`}
                    textBox={{
                      ...textBox,
                      // Använd textSettings om detta är den valda textboxen och inställningar ändras
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
                    onUpdate={(updated) => {
                      const newBoxes = [...textBoxes];
                      newBoxes[globalIndex] = updated;
                      setTextBoxes(newBoxes);
                      saveToHistory(newBoxes, null, null);
                    }}
                    isSelected={selectedElement === globalIndex && selectedType === 'text'}
                  />
                );
              })}
            
            {/* Render whiteout boxes */}
            {whiteoutBoxes
              .map((whiteoutBox, globalIndex) => {
                // Visa endast element för aktuell sida
                if (whiteoutBox.pageIndex !== undefined && whiteoutBox.pageIndex !== currentPage - 1) {
                  return null;
                }
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
                      const canvasRect = canvasRef.current.getBoundingClientRect();
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
            
            {/* Render patch boxes */}
            {patchBoxes
              .map((patchBox, globalIndex) => {
                // Visa endast element för aktuell sida
                if (patchBox.pageIndex !== undefined && patchBox.pageIndex !== currentPage - 1) {
                  return null;
                }
                return (
                  <PatchBox
                    key={`patch-${globalIndex}`}
                    patchBox={patchBox}
                    zoom={zoom}
                    pdfPage={pdfPage}
                    pdfPageNum={currentPage}
                    isSelected={selectedElement === globalIndex && selectedType === 'patch'}
                    tool={tool}
                    onUpdate={(updated) => {
                      const newBoxes = [...patchBoxes];
                      newBoxes[globalIndex] = updated;
                      setPatchBoxes(newBoxes);
                      // Spara till history när imageData uppdateras
                      saveToHistory(null, null, newBoxes);
                    }}
                  />
                );
              })}

            {/* Drawing preview */}
            {isDrawing && currentRect && (
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
  );
}

