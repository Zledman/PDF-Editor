import * as pdfjsLib from 'pdfjs-dist';
import { exportPDF } from './pdfExport';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';
import PptxGenJS from 'pptxgenjs';

/**
 * Exporterar PDF med alla redigeringar
 */
export async function exportAsPDF(pdfData, textBoxes, whiteoutBoxes, patchBoxes) {
  const exported = await exportPDF(pdfData, textBoxes, whiteoutBoxes, patchBoxes);
  return { blob: new Blob([exported], { type: 'application/pdf' }), extension: 'pdf' };
}

/**
 * Exporterar varje sida som PNG-bilder
 */
export async function exportAsPNG(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes, currentPage = null) {
  const pages = [];
  const pagesToExport = currentPage ? [currentPage] : Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);
  
  for (const pageNum of pagesToExport) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    
    // Rendera PDF-sidan
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Rita whiteout-boxes
    const pageWhiteoutBoxes = whiteoutBoxes.filter(wb => 
      wb.pageIndex === undefined || wb.pageIndex === pageNum - 1
    );
    for (const whiteout of pageWhiteoutBoxes) {
      const scale = 2.0;
      const rect = {
        x: whiteout.rect.x * scale,
        y: whiteout.rect.y * scale,
        width: whiteout.rect.width * scale,
        height: whiteout.rect.height * scale
      };
      context.fillStyle = '#FFFFFF';
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    // Rita patch-boxes
    const pagePatchBoxes = patchBoxes.filter(pb => 
      pb.pageIndex === undefined || pb.pageIndex === pageNum - 1
    );
    for (const patch of pagePatchBoxes) {
      if (patch.imageData && patch.targetRect) {
        try {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = patch.imageData;
          });
          
          const scale = 2.0;
          const rect = {
            x: patch.targetRect.x * scale,
            y: patch.targetRect.y * scale,
            width: patch.targetRect.width * scale,
            height: patch.targetRect.height * scale
          };
          
          context.drawImage(img, rect.x, rect.y, rect.width, rect.height);
        } catch (error) {
          console.error('Fel vid rendering av patch:', error);
        }
      }
    }

    // Rita text-boxes
    const pageTextBoxes = textBoxes.filter(tb => 
      tb.pageIndex === undefined || tb.pageIndex === pageNum - 1
    );
    for (const textBox of pageTextBoxes) {
      if (textBox.text) {
        const scale = 2.0;
        const fontSize = (textBox.fontSizePt || 12) * scale;
        const x = textBox.rect.x * scale;
        const y = textBox.rect.y * scale + fontSize * 0.8; // Baseline offset
        
        context.font = `${textBox.fontStyle || 'normal'} ${textBox.fontWeight || 'normal'} ${fontSize}px ${textBox.fontFamily || 'Helvetica'}`;
        context.fillStyle = textBox.color || '#000000';
        context.fillText(textBox.text, x, y);
      }
    }

    const dataUrl = canvas.toDataURL('image/png');
    pages.push({ dataUrl, pageNum });
  }
  
  return { pages, extension: 'png', mimeType: 'image/png' };
}

/**
 * Exporterar varje sida som JPG-bilder
 */
export async function exportAsJPG(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes, currentPage = null) {
  const pngResult = await exportAsPNG(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes, currentPage);
  
  // Konvertera PNG till JPG
  const jpgPages = [];
  for (const { dataUrl, pageNum } of pngResult.pages) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0);
    
    const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    jpgPages.push({ dataUrl: jpgDataUrl, pageNum });
  }
  
  return { pages: jpgPages, extension: 'jpg', mimeType: 'image/jpeg' };
}

/**
 * Exporterar som Excel-fil med textinnehåll
 */
export async function exportAsExcel(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes) {
  const workbook = XLSX.utils.book_new();
  
  // Skapa ett ark med metadata
  const metadata = [
    ['PDF Export Information'],
    [''],
    ['Antal sidor:', pdfDoc.numPages],
    ['Antal textrutor:', textBoxes.length],
    ['Antal whiteout-rutor:', whiteoutBoxes.length],
    ['Antal patch-rutor:', patchBoxes.length],
    [''],
    ['Textinnehåll:']
  ];
  
  // Lägg till alla textrutor
  textBoxes.forEach((textBox, index) => {
    metadata.push([
      `Textruta ${index + 1}`,
      textBox.text || '',
      `Sida: ${(textBox.pageIndex !== undefined ? textBox.pageIndex + 1 : 'Alla')}`,
      `Position: (${textBox.rect.x.toFixed(2)}, ${textBox.rect.y.toFixed(2)})`,
      `Storlek: ${textBox.fontSizePt || 12}pt`
    ]);
  });
  
  const worksheet = XLSX.utils.aoa_to_sheet(metadata);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PDF Content');
  
  // Generera Excel-fil
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return { blob: new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), extension: 'xlsx' };
}

/**
 * Exporterar som Word-dokument
 */
export async function exportAsWord(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes) {
  const children = [];
  
  // Lägg till titel
  children.push(
    new Paragraph({
      text: 'PDF Export',
      heading: 'Heading1',
      alignment: AlignmentType.CENTER
    })
  );
  
  children.push(
    new Paragraph({
      text: `Antal sidor: ${pdfDoc.numPages}`,
      spacing: { after: 200 }
    })
  );
  
  // Lägg till textinnehåll
  if (textBoxes.length > 0) {
    children.push(
      new Paragraph({
        text: 'Textinnehåll:',
        heading: 'Heading2',
        spacing: { before: 400, after: 200 }
      })
    );
    
    textBoxes.forEach((textBox, index) => {
      if (textBox.text) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Textruta ${index + 1}: `,
                bold: true
              }),
              new TextRun({
                text: textBox.text
              })
            ],
            spacing: { after: 200 }
          })
        );
      }
    });
  }
  
  // Skapa dokument
  const doc = new Document({
    sections: [{
      children: children
    }]
  });
  
  const blob = await Packer.toBlob(doc);
  return { blob, extension: 'docx' };
}

/**
 * Exporterar som PowerPoint-presentation
 */
export async function exportAsPPTX(pdfDoc, textBoxes, whiteoutBoxes, patchBoxes) {
  const pptx = new PptxGenJS();
  
  // Exportera varje sida som en bild i presentationen
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    
    // Rendera PDF-sidan
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Rita whiteout-boxes
    const pageWhiteoutBoxes = whiteoutBoxes.filter(wb => 
      wb.pageIndex === undefined || wb.pageIndex === pageNum - 1
    );
    for (const whiteout of pageWhiteoutBoxes) {
      const scale = 1.5;
      const rect = {
        x: whiteout.rect.x * scale,
        y: whiteout.rect.y * scale,
        width: whiteout.rect.width * scale,
        height: whiteout.rect.height * scale
      };
      context.fillStyle = '#FFFFFF';
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    // Rita patch-boxes
    const pagePatchBoxes = patchBoxes.filter(pb => 
      pb.pageIndex === undefined || pb.pageIndex === pageNum - 1
    );
    for (const patch of pagePatchBoxes) {
      if (patch.imageData && patch.targetRect) {
        try {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = patch.imageData;
          });
          
          const scale = 1.5;
          const rect = {
            x: patch.targetRect.x * scale,
            y: patch.targetRect.y * scale,
            width: patch.targetRect.width * scale,
            height: patch.targetRect.height * scale
          };
          
          context.drawImage(img, rect.x, rect.y, rect.width, rect.height);
        } catch (error) {
          console.error('Fel vid rendering av patch:', error);
        }
      }
    }

    // Rita text-boxes
    const pageTextBoxes = textBoxes.filter(tb => 
      tb.pageIndex === undefined || tb.pageIndex === pageNum - 1
    );
    for (const textBox of pageTextBoxes) {
      if (textBox.text) {
        const scale = 1.5;
        const fontSize = (textBox.fontSizePt || 12) * scale;
        const x = textBox.rect.x * scale;
        const y = textBox.rect.y * scale + fontSize * 0.8;
        
        context.font = `${textBox.fontStyle || 'normal'} ${textBox.fontWeight || 'normal'} ${fontSize}px ${textBox.fontFamily || 'Helvetica'}`;
        context.fillStyle = textBox.color || '#000000';
        context.fillText(textBox.text, x, y);
      }
    }

    // Konvertera canvas till bild
    const dataUrl = canvas.toDataURL('image/png');
    
    // Lägg till slide med bilden
    const slide = pptx.addSlide();
    slide.addImage({
      data: dataUrl,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%'
    });
    slide.addText(`Sida ${pageNum}`, {
      x: 0.5,
      y: 0.1,
      w: 1,
      h: 0.3,
      fontSize: 14,
      color: '363636'
    });
  }
  
  // Generera presentation
  // pptxgenjs v4 använder write() som returnerar en Promise
  const blob = await pptx.write({ outputType: 'blob' });
  return { blob, extension: 'pptx' };
}

