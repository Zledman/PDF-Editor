/**
 * OCR service for images using Tesseract.js
 * Extracts text with position, font size, and style info.
 */
import { createWorker } from 'tesseract.js';

/**
 * Run OCR on an image and return text boxes compatible with the PDF editor's text box format.
 * @param {string} imageDataUrl - data URL of the image
 * @param {number} imgWidth - image natural width in px
 * @param {number} imgHeight - image natural height in px
 * @param {function} onProgress - progress callback (0-100)
 * @returns {Promise<Array>} text boxes in editor format
 */
export async function ocrImage(imageDataUrl, imgWidth, imgHeight, onProgress) {
  const worker = await createWorker('swe+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  try {
    const result = await worker.recognize(imageDataUrl);
    const { data } = result;

    // Convert Tesseract words to text boxes, merging words on the same line
    const textBoxes = [];
    const lines = data.lines || [];

    for (const line of lines) {
      if (!line.words || line.words.length === 0) continue;
      const lineText = line.text?.trim();
      if (!lineText) continue;

      // Use line bbox for position
      const bbox = line.bbox;
      const x = bbox.x0;
      const y = bbox.y0;
      const width = bbox.x1 - bbox.x0;
      const height = bbox.y1 - bbox.y0;

      if (width <= 0 || height <= 0) continue;

      // Detect bold/italic from majority of words in the line
      let boldCount = 0;
      let italicCount = 0;
      let totalFontSize = 0;
      let fontSizeCount = 0;

      for (const word of line.words) {
        if (word.is_bold) boldCount++;
        if (word.is_italic) italicCount++;
        if (word.font_size > 0) {
          totalFontSize += word.font_size;
          fontSizeCount++;
        }
      }

      const isBold = boldCount > line.words.length / 2;
      const isItalic = italicCount > line.words.length / 2;

      // Estimate font size from Tesseract data or from bbox height
      // Tesseract font_size is in points but can be unreliable
      // Fall back to estimating from line height (height ≈ fontSize * 1.2)
      let fontSizePt;
      if (fontSizeCount > 0 && totalFontSize / fontSizeCount > 4) {
        fontSizePt = totalFontSize / fontSizeCount;
      } else {
        // Estimate: line height in image px → convert to points
        // Image pixels to PDF points: 1 point = 1 pixel at 72 DPI
        // Most images are 96 DPI or higher; we use the image as-is (1:1 px to pt)
        fontSizePt = height * 0.85; // line height to font size ratio
      }

      // Clamp font size to reasonable range
      fontSizePt = Math.max(6, Math.min(72, fontSizePt));

      // Store sub-items for bold detection refinement
      const subItems = line.words.map(word => ({
        text: word.text,
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
      }));

      textBoxes.push({
        text: lineText,
        rect: { x, y, width, height },
        originalRect: { x, y, width, height },
        fontSizePt,
        fontFamily: 'Helvetica',
        fontWeight: isBold ? 'bold' : 'normal',
        fontStyle: isItalic ? 'italic' : 'normal',
        color: '#000000',
        pageIndex: 0,
        isImported: true,
        isDirty: false,
        _subItems: subItems,
      });
    }

    return textBoxes;
  } finally {
    await worker.terminate();
  }
}
