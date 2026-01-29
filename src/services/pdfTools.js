import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Merge multiple PDFs (ArrayBuffers) into a single PDF Blob.
 * @param {ArrayBuffer[]} pdfBuffers
 * @returns {Promise<Blob>}
 */
export async function mergePdfBuffers(pdfBuffers) {
  const out = await PDFDocument.create();

  for (const buf of pdfBuffers) {
    if (!buf) continue;
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const indices = src.getPageIndices();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
  }

  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Parse page ranges from a string like "1-3, 5, 7-9".
 * Returns normalized, validated ranges (1-based, inclusive).
 * @param {string} input
 * @param {number} numPages
 * @returns {{start:number,end:number}[]}
 */
export function parsePageRanges(input, numPages) {
  const text = String(input || '').trim();
  if (!text) return [];
  const max = Math.max(0, Number(numPages) || 0);

  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const ranges = [];

  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error(`Invalid range: "${part}"`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`Invalid range: "${part}"`);
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (start < 1 || end < 1) throw new Error(`Pages must be >= 1: "${part}"`);
    if (max && end > max) throw new Error(`Page ${end} is out of bounds (max ${max})`);
    ranges.push({ start, end });
  }

  // Optional normalization: sort + merge overlaps
  ranges.sort((r1, r2) => (r1.start - r2.start) || (r1.end - r2.end));
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last) merged.push({ ...r });
    else if (r.start <= last.end + 1) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

/**
 * Split a PDF into multiple PDF Blobs by page ranges.
 * Each range becomes its own output PDF.
 * @param {ArrayBuffer} pdfBuffer
 * @param {{start:number,end:number}[]} ranges - 1-based inclusive
 * @returns {Promise<Blob[]>}
 */
export async function splitPdfByRanges(pdfBuffer, ranges) {
  const src = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const numPages = src.getPageCount();
  const safeRanges = (ranges || []).filter(Boolean);
  if (!safeRanges.length) throw new Error('No ranges provided');

  const outBlobs = [];
  for (const r of safeRanges) {
    if (r.start < 1 || r.end > numPages) throw new Error(`Range ${r.start}-${r.end} is out of bounds`);
    const out = await PDFDocument.create();
    const indices = [];
    for (let p = r.start; p <= r.end; p++) indices.push(p - 1);
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    outBlobs.push(new Blob([bytes], { type: 'application/pdf' }));
  }

  return outBlobs;
}

/**
 * Remove pages from a PDF and return a new PDF Blob.
 * @param {ArrayBuffer} pdfBuffer
 * @param {{start:number,end:number}[]} removeRanges - 1-based inclusive
 * @returns {Promise<Blob>}
 */
export async function removePagesFromPdf(pdfBuffer, removeRanges) {
  const src = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const numPages = src.getPageCount();
  const ranges = (removeRanges || []).filter(Boolean);
  if (!ranges.length) throw new Error('No pages selected');

  // Build set of pages to remove (1-based)
  const removeSet = new Set();
  for (const r of ranges) {
    if (r.start < 1 || r.end > numPages) throw new Error(`Range ${r.start}-${r.end} is out of bounds`);
    for (let p = r.start; p <= r.end; p++) removeSet.add(p);
  }
  if (removeSet.size >= numPages) throw new Error('Cannot remove all pages');

  const keepIndices = [];
  for (let p = 1; p <= numPages; p++) {
    if (!removeSet.has(p)) keepIndices.push(p - 1);
  }

  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keepIndices);
  pages.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Extract (keep) specific pages from a PDF and return a new PDF Blob.
 * @param {ArrayBuffer} pdfBuffer
 * @param {{start:number,end:number}[]} keepRanges - 1-based inclusive
 * @returns {Promise<Blob>}
 */
export async function extractPagesFromPdf(pdfBuffer, keepRanges) {
  const src = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const numPages = src.getPageCount();
  const ranges = (keepRanges || []).filter(Boolean);
  if (!ranges.length) throw new Error('No pages selected');

  const keepIndices = [];
  for (const r of ranges) {
    if (r.start < 1 || r.end > numPages) throw new Error(`Range ${r.start}-${r.end} is out of bounds`);
    for (let p = r.start; p <= r.end; p++) keepIndices.push(p - 1);
  }
  if (!keepIndices.length) throw new Error('No pages selected');

  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keepIndices);
  pages.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Reorder pages in a PDF and return a new PDF Blob.
 * @param {ArrayBuffer} pdfBuffer
 * @param {number[]} newOrder - array of 1-based page numbers in desired order
 * @returns {Promise<Blob>}
 */
export async function reorderPdfPages(pdfBuffer, newOrder) {
  const src = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const numPages = src.getPageCount();
  const order = (newOrder || []).map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (!order.length) throw new Error('No page order provided');
  if (order.length !== numPages) throw new Error('Page order must include every page exactly once');

  const seen = new Set();
  const indices = [];
  for (const p of order) {
    if (p < 1 || p > numPages) throw new Error(`Page ${p} is out of bounds (1-${numPages})`);
    if (seen.has(p)) throw new Error(`Duplicate page in order: ${p}`);
    seen.add(p);
    indices.push(p - 1);
  }

  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Create a PDF from a list of image files (JPG/PNG).
 * @param {{name:string, type?:string, buffer:ArrayBuffer}[]} images
 * @param {{pageSize?:'fit'|'a4', marginPt?:number}} options
 * @returns {Promise<Blob>}
 */
export async function imagesToPdf(images, options = {}) {
  const pageSize = options.pageSize || 'fit'; // 'fit' | 'a4'
  const marginPt = Number.isFinite(options.marginPt) ? options.marginPt : 24;

  const pdfDoc = await PDFDocument.create();

  // A4 in points (portrait)
  const A4 = { w: 595.28, h: 841.89 };

  for (const img of images || []) {
    if (!img?.buffer) continue;
    const bytes = new Uint8Array(img.buffer);
    const type = (img.type || '').toLowerCase();
    const isPng = type.includes('png') || (img.name || '').toLowerCase().endsWith('.png');

    let embedded;
    try {
      embedded = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    } catch (e) {
      // Retry alternate type if sniffing was wrong
      embedded = isPng ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
    }

    const imgW = embedded.width;
    const imgH = embedded.height;

    if (pageSize === 'a4') {
      const page = pdfDoc.addPage([A4.w, A4.h]);
      const maxW = Math.max(1, A4.w - marginPt * 2);
      const maxH = Math.max(1, A4.h - marginPt * 2);
      const scale = Math.min(maxW / imgW, maxH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const x = (A4.w - drawW) / 2;
      const y = (A4.h - drawH) / 2;
      page.drawImage(embedded, { x, y, width: drawW, height: drawH });
    } else {
      // fit: create a page matching the image aspect. Use a px->pt factor (approx 0.75 at 96DPI).
      const pxToPt = 0.75;
      const pageW = Math.max(1, imgW * pxToPt);
      const pageH = Math.max(1, imgH * pxToPt);
      const page = pdfDoc.addPage([pageW, pageH]);
      page.drawImage(embedded, { x: 0, y: 0, width: pageW, height: pageH });
    }
  }

  if ((images || []).length === 0) throw new Error('No images provided');
  const bytesOut = await pdfDoc.save();
  return new Blob([bytesOut], { type: 'application/pdf' });
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Compress a PDF by rasterizing pages to JPEG and rebuilding a new PDF.
 * Note: this reduces quality and removes selectable text (image-only PDF).
 * @param {ArrayBuffer} pdfBuffer
 * @param {{scale?:number, quality?:number, pageSize?:'original'|'a4', marginPt?:number}} options
 * @returns {Promise<Blob>}
 */
export async function compressPdfBuffer(pdfBuffer, options = {}) {
  const scale = Number.isFinite(options.scale) ? options.scale : 1.0; // render scale
  const quality = Number.isFinite(options.quality) ? options.quality : 0.75; // jpeg quality [0..1]
  const pageSize = options.pageSize || 'original'; // 'original' | 'a4'
  const marginPt = Number.isFinite(options.marginPt) ? options.marginPt : 24;

  if (!pdfBuffer) throw new Error('No PDF provided');

  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer, ignoreEncryption: true });
  const pdf = await loadingTask.promise;
  const out = await PDFDocument.create();

  const A4 = { w: 595.28, h: 841.89 };

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const jpegUrl = canvas.toDataURL('image/jpeg', Math.min(1, Math.max(0.05, quality)));
    const jpegBytes = dataUrlToUint8Array(jpegUrl);
    const embedded = await out.embedJpg(jpegBytes);

    // original size in PDF points from PDF.js
    const view = page.view; // [xMin,yMin,xMax,yMax] in points
    const originalW = Math.max(1, (view?.[2] ?? 0) - (view?.[0] ?? 0));
    const originalH = Math.max(1, (view?.[3] ?? 0) - (view?.[1] ?? 0));

    if (pageSize === 'a4') {
      const pdfPage = out.addPage([A4.w, A4.h]);
      const maxW = Math.max(1, A4.w - marginPt * 2);
      const maxH = Math.max(1, A4.h - marginPt * 2);
      const scaleFit = Math.min(maxW / originalW, maxH / originalH);
      const drawW = originalW * scaleFit;
      const drawH = originalH * scaleFit;
      const x = (A4.w - drawW) / 2;
      const y = (A4.h - drawH) / 2;
      pdfPage.drawImage(embedded, { x, y, width: drawW, height: drawH });
    } else {
      const pdfPage = out.addPage([originalW, originalH]);
      pdfPage.drawImage(embedded, { x: 0, y: 0, width: originalW, height: originalH });
    }
  }

  const bytesOut = await out.save();
  return new Blob([bytesOut], { type: 'application/pdf' });
}


