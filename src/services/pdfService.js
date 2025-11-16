// Backend service för PDF-hantering
// Detta kan användas för server-side processing om det behövs

/**
 * Laddar PDF från URL eller fil
 * @param {string|File} source - URL eller File-objekt
 * @returns {Promise<ArrayBuffer>} PDF data
 */
export async function loadPDF(source) {
  if (source instanceof File) {
    return await source.arrayBuffer();
  } else if (typeof source === 'string') {
    const response = await fetch(source);
    return await response.arrayBuffer();
  } else {
    throw new Error('Ogiltig PDF-källa');
  }
}

/**
 * Validerar PDF-struktur
 * @param {ArrayBuffer} pdfData
 * @returns {Promise<boolean>}
 */
export async function validatePDF(pdfData) {
  try {
    const uint8Array = new Uint8Array(pdfData);
    const header = String.fromCharCode(...uint8Array.slice(0, 4));
    return header === '%PDF';
  } catch {
    return false;
  }
}

