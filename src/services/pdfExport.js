import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { LINE_HEIGHT_FACTOR } from '../utils/textLayoutConstants';

/**
 * Exporterar redigerad PDF med alla ändringar
 * @param {Object} pdfData - Original PDF data
 * @param {Array} textBoxes - Array av textbox-objekt {rect: {x,y,width,height}, text, fontSizePt, fontFamily, color}
 * @param {Array} whiteoutBoxes - Array av whiteout-objekt {rect: {x,y,width,height}}
 * @param {Array} patchBoxes - Array av patch-objekt {sourceRect, targetRect, imageData}
 * @returns {Promise<Uint8Array>} Redigerad PDF som Uint8Array
 */
export async function exportPDF(pdfData, textBoxes = [], whiteoutBoxes = [], patchBoxes = []) {
  // pdfData ska redan vara en kopia (skapad när PDF laddades)
  // Men för säkerhets skull skapar vi en ny kopia via Uint8Array
  // Detta säkerställer att vi alltid har en frisk ArrayBuffer
  let pdfDataCopy;
  try {
    // Skapa en ny kopia via Uint8Array (detta fungerar även om original är detached)
    const uint8Array = new Uint8Array(pdfData);
    pdfDataCopy = uint8Array.slice().buffer; // slice() skapar en ny kopia
  } catch (error) {
    // Om det misslyckas, försök direkt
    if (pdfData instanceof ArrayBuffer) {
      pdfDataCopy = pdfData;
    } else {
      throw new Error('Kunde inte kopiera PDF-data: ' + error.message);
    }
  }
  
  // Försök först att ladda med pdf-lib direkt
  let pdfDoc;
  let useImageBasedExport = false;
  try {
    // Försök först med ignoreEncryption och minimal parsing för att undvika korrupta objekt
    pdfDoc = await PDFDocument.load(pdfDataCopy, { 
      ignoreEncryption: true,
      updateMetadata: false,
      parseSpeed: 0 // Snabbast parsing, minst validering
    });
    
    // Testa om vi kan läsa sidor
    try {
      pdfDoc.getPages();
    } catch (error) {
      // Om vi inte kan läsa sidor, använd bildbaserad export
      useImageBasedExport = true;
    }
  } catch (error) {
    // Om laddning misslyckas, använd bildbaserad export
    useImageBasedExport = true;
  }
  
  // Om pdf-lib inte kan hantera PDF:en, använd bildbaserad export med PDF.js
  if (useImageBasedExport) {
    return await exportPDFAsImages(pdfDataCopy, textBoxes, whiteoutBoxes, patchBoxes);
  }
  
  // Hämta sidor
  const pages = pdfDoc.getPages();

  // Processa varje sida
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    // Filtrera element för denna sida (om element har pageIndex, annars använd alla)
    const pageTextBoxes = textBoxes.filter(tb => tb.pageIndex === undefined || tb.pageIndex === pageIndex);
    const pageWhiteoutBoxes = whiteoutBoxes.filter(wb => wb.pageIndex === undefined || wb.pageIndex === pageIndex);
    const pagePatchBoxes = patchBoxes.filter(pb => pb.pageIndex === undefined || pb.pageIndex === pageIndex);

    // Rita whiteout först (bakgrund)
    for (const whiteout of pageWhiteoutBoxes) {
      const rect = whiteout.rect;
      page.drawRectangle({
        x: rect.x,
        y: height - rect.y - rect.height, // PDF har y=0 längst ner, så vi inverterar
        width: rect.width,
        height: rect.height,
        color: rgb(1, 1, 1), // Vit
        opacity: 1.0
      });
    }

    // Rita patches (bilder)
    for (const patch of pagePatchBoxes) {
      console.log('Exporting patch:', { 
        hasImageData: !!patch.imageData, 
        hasTargetRect: !!patch.targetRect,
        imageDataType: patch.imageData ? typeof patch.imageData : 'none',
        imageDataLength: patch.imageData ? patch.imageData.length : 0,
        targetRect: patch.targetRect
      });
      
      if (patch.imageData && patch.targetRect) {
        try {
          // patch.imageData är en base64 data URL (t.ex. "data:image/png;base64,...")
          // Konvertera base64 data URL till Uint8Array
          let imageBytes;
          if (patch.imageData.startsWith('data:')) {
            // Ta bort data URL prefix (t.ex. "data:image/png;base64,")
            const base64String = patch.imageData.split(',')[1];
            if (!base64String) {
              console.error('Kunde inte hitta base64-data i imageData');
              continue;
            }
            // Konvertera base64 till binary string
            const binaryString = atob(base64String);
            // Konvertera binary string till Uint8Array
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            imageBytes = bytes;
          } else {
            // Om det inte är en data URL, försök ladda med fetch
            imageBytes = await fetch(patch.imageData).then(res => res.arrayBuffer());
          }
          
          let image;
          
          // Försök ladda som PNG eller JPEG
          try {
            image = await pdfDoc.embedPng(imageBytes);
            console.log('Patch-bild laddad som PNG');
          } catch (pngError) {
            try {
              image = await pdfDoc.embedJpg(imageBytes);
              console.log('Patch-bild laddad som JPEG');
            } catch (jpgError) {
              console.error('Kunde inte ladda patch-bild som PNG eller JPEG:', { pngError, jpgError });
              continue; // Hoppa över denna patch om bilden inte kan laddas
            }
          }

          const targetRect = patch.targetRect;
          console.log('Ritar patch på position:', {
            x: targetRect.x,
            y: height - targetRect.y - targetRect.height,
            width: targetRect.width,
            height: targetRect.height,
            pageHeight: height
          });
          
          page.drawImage(image, {
            x: targetRect.x,
            y: height - targetRect.y - targetRect.height,
            width: targetRect.width,
            height: targetRect.height
          });
          console.log('Patch ritad framgångsrikt');
        } catch (error) {
          console.error('Fel vid export av patch:', error);
        }
      } else {
        console.warn('Patch saknar imageData eller targetRect:', patch);
      }
    }

    // Rita text sist (överst)
    for (const textBox of pageTextBoxes) {
      const rect = textBox.rect;
      const fontSizePt = textBox.fontSizePt || 12;
      const fontFamily = textBox.fontFamily || 'Helvetica';
      const text = textBox.text || '';
      const color = textBox.color || '#000000';

      // Bädda in font om det behövs
      let font;
      try {
        if (fontFamily === 'Helvetica' || fontFamily.includes('Helvetica')) {
          font = await pdfDoc.embedFont('Helvetica');
        } else {
          // Försök använda standardfont
          font = await pdfDoc.embedFont('Helvetica');
        }
      } catch (error) {
        font = await pdfDoc.embedFont('Helvetica');
      }

      // Konvertera hex-färg till RGB
      const rgbColor = hexToRgb(color);

      // Beräkna baseline-y (PDF har y=0 längst ner, rect.y är från toppen)
      // rect.y är från toppen av PDF-sidan, så vi inverterar: height - rect.y
      // Texten börjar från toppen av rektangeln (rect.y) i redigering
      // drawText använder baseline, som är ungefär 80-85% av fontstorleken från toppen av texten
      // För att matcha redigering: baseline ska vara på rect.y + ungefär 85% av fontstorleken
      const baselineY = height - rect.y - (fontSizePt * 0.85);

      page.drawText(text, {
        x: rect.x,
        y: baselineY,
        size: fontSizePt,
        font: font,
        color: rgbColor
      });
    }
  }

  return await pdfDoc.save();
}

/**
 * Exporterar PDF genom att rendera varje sida som bild (för korrupta PDF:er)
 */
async function exportPDFAsImages(pdfData, textBoxes = [], whiteoutBoxes = [], patchBoxes = []) {
  // Ladda PDF med PDF.js (kan hantera korrupta PDF:er bättre)
  const loadingTask = pdfjsLib.getDocument({ data: pdfData, ignoreEncryption: true });
  const pdfDocJs = await loadingTask.promise;
  const numPages = pdfDocJs.numPages;
  
  // Skapa ny PDF med pdf-lib
  const newPdfDoc = await PDFDocument.create();
  
  // Processa varje sida
  for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
    const page = await pdfDocJs.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 2.0 }); // Högre upplösning för bättre kvalitet
    
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
    
    // Filtrera element för denna sida
    const pageTextBoxes = textBoxes.filter(tb => tb.pageIndex === undefined || tb.pageIndex === pageIndex);
    const pageWhiteoutBoxes = whiteoutBoxes.filter(wb => wb.pageIndex === undefined || wb.pageIndex === pageIndex);
    const pagePatchBoxes = patchBoxes.filter(pb => pb.pageIndex === undefined || pb.pageIndex === pageIndex);
    
    // Rita whiteout
    for (const whiteout of pageWhiteoutBoxes) {
      const rect = whiteout.rect;
      pdfPage.drawRectangle({
        x: rect.x,
        y: height - rect.y - rect.height,
        width: rect.width,
        height: rect.height,
        color: rgb(1, 1, 1),
        opacity: 1.0
      });
    }
    
    // Rita patches
    for (const patch of pagePatchBoxes) {
      if (patch.imageData && patch.targetRect) {
        try {
          let imageBytes;
          if (patch.imageData.startsWith('data:')) {
            const base64String = patch.imageData.split(',')[1];
            if (!base64String) continue;
            const binaryString = atob(base64String);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            imageBytes = bytes;
          } else {
            imageBytes = await fetch(patch.imageData).then(res => res.arrayBuffer());
          }
          
          let patchImage;
          try {
            patchImage = await newPdfDoc.embedPng(imageBytes);
          } catch (pngError) {
            try {
              patchImage = await newPdfDoc.embedJpg(imageBytes);
            } catch (jpgError) {
              continue;
            }
          }
          
          const targetRect = patch.targetRect;
          pdfPage.drawImage(patchImage, {
            x: targetRect.x,
            y: height - targetRect.y - targetRect.height,
            width: targetRect.width,
            height: targetRect.height
          });
        } catch (error) {
          console.error('Fel vid export av patch:', error);
        }
      }
    }
    
    // Rita text
    for (const textBox of pageTextBoxes) {
      const rect = textBox.rect;
      const fontSizePt = textBox.fontSizePt || 12;
      const fontFamily = textBox.fontFamily || 'Helvetica';
      const text = textBox.text || '';
      const color = textBox.color || '#000000';
      
      let font;
      try {
        font = await newPdfDoc.embedFont('Helvetica');
      } catch (error) {
        font = await newPdfDoc.embedFont('Helvetica');
      }
      
      const rgbColor = hexToRgb(color);
      const baselineY = height - rect.y - (fontSizePt * 0.85);
      
      pdfPage.drawText(text, {
        x: rect.x,
        y: baselineY,
        size: fontSizePt,
        font: font,
        color: rgbColor
      });
    }
  }
  
  return await newPdfDoc.save();
}

/**
 * Konverterar hex-färg till rgb-objekt för pdf-lib
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? rgb(
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
      )
    : rgb(0, 0, 0);
}

