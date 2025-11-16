// Konvertering mellan pt (points) och px (pixels)
// PDF.js viewport.scale hanterar redan konverteringen från PDF-koordinater till canvas-pixels
// Så vi använder zoom direkt som scale-faktor

/**
 * Konverterar pt till px baserat på zoom-nivå
 * @param {number} pt - värde i points (PDF-koordinater)
 * @param {number} zoom - zoom-faktor (samma som PDF.js viewport.scale)
 * @returns {number} värde i pixels (canvas-koordinater)
 */
export function ptToPx(pt, zoom = 1.0) {
  // PDF.js viewport.scale konverterar direkt från PDF points till canvas pixels
  // Så vi använder zoom direkt
  return pt * zoom;
}

/**
 * Konverterar px till pt baserat på zoom-nivå
 * @param {number} px - värde i pixels (canvas-koordinater)
 * @param {number} zoom - zoom-faktor (samma som PDF.js viewport.scale)
 * @returns {number} värde i points (PDF-koordinater)
 */
export function pxToPt(px, zoom = 1.0) {
  return px / zoom;
}

/**
 * Konverterar ett rektangel-objekt från pt till px
 * @param {{x: number, y: number, width: number, height: number}} rectPt
 * @param {number} zoom
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function rectPtToPx(rectPt, zoom = 1.0) {
  return {
    x: ptToPx(rectPt.x, zoom),
    y: ptToPx(rectPt.y, zoom),
    width: ptToPx(rectPt.width, zoom),
    height: ptToPx(rectPt.height, zoom)
  };
}

/**
 * Konverterar ett rektangel-objekt från px till pt
 * @param {{x: number, y: number, width: number, height: number}} rectPx
 * @param {number} zoom
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function rectPxToPt(rectPx, zoom = 1.0) {
  return {
    x: pxToPt(rectPx.x, zoom),
    y: pxToPt(rectPx.y, zoom),
    width: pxToPt(rectPx.width, zoom),
    height: pxToPt(rectPx.height, zoom)
  };
}

