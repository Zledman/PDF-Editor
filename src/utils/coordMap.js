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

/**
 * Konverterar en punkt från pt till px baserat på zoom-nivå
 * @param {{x: number, y: number}} pointPt - punkt i points (PDF-koordinater)
 * @param {number} zoom - zoom-faktor
 * @returns {{x: number, y: number}} punkt i pixels (canvas-koordinater)
 */
export function pointPtToPx(pointPt, zoom = 1.0) {
  return {
    x: ptToPx(pointPt.x, zoom),
    y: ptToPx(pointPt.y, zoom)
  };
}

/**
 * Konverterar en punkt från px till pt baserat på zoom-nivå
 * @param {{x: number, y: number}} pointPx - punkt i pixels (canvas-koordinater)
 * @param {number} zoom - zoom-faktor
 * @returns {{x: number, y: number}} punkt i points (PDF-koordinater)
 */
export function pointPxToPt(pointPx, zoom = 1.0) {
  return {
    x: pxToPt(pointPx.x, zoom),
    y: pxToPt(pointPx.y, zoom)
  };
}

/**
 * Kontrollerar om en punkt är nära en rektangels kant (används för pan-verktyget)
 * @param {number} px - X-koordinat för punkten
 * @param {number} py - Y-koordinat för punkten
 * @param {number} rectX - X-koordinat för rektangelns övre vänstra hörn
 * @param {number} rectY - Y-koordinat för rektangelns övre vänstra hörn
 * @param {number} rectWidth - Rektangelns bredd
 * @param {number} rectHeight - Rektangelns höjd
 * @param {number} tolerance - Tolerans i pixels (standard: 5px)
 * @returns {boolean} true om punkten är nära kanten
 */
export function isPointNearRectBorder(px, py, rectX, rectY, rectWidth, rectHeight, tolerance = 5) {
  // Kontrollera om punkten är inom rektangeln
  if (px < rectX || px > rectX + rectWidth || py < rectY || py > rectY + rectHeight) {
    return false;
  }
  
  // Kontrollera om punkten är nära någon av kanterna
  const distToLeft = px - rectX;
  const distToRight = (rectX + rectWidth) - px;
  const distToTop = py - rectY;
  const distToBottom = (rectY + rectHeight) - py;
  
  return distToLeft <= tolerance || distToRight <= tolerance || distToTop <= tolerance || distToBottom <= tolerance;
}

/**
 * Kontrollerar om en punkt är nära en cirkels omkrets (används för pan-verktyget)
 * @param {number} px - X-koordinat för punkten
 * @param {number} py - Y-koordinat för punkten
 * @param {number} centerX - X-koordinat för cirkelns centrum
 * @param {number} centerY - Y-koordinat för cirkelns centrum
 * @param {number} radius - Cirkelns radie
 * @param {number} tolerance - Tolerans i pixels (standard: 5px)
 * @returns {boolean} true om punkten är nära omkretsen
 */
export function isPointNearCircleBorder(px, py, centerX, centerY, radius, tolerance = 5) {
  const distanceFromCenter = Math.sqrt(Math.pow(px - centerX, 2) + Math.pow(py - centerY, 2));
  const distanceFromBorder = Math.abs(distanceFromCenter - radius);
  return distanceFromBorder <= tolerance;
}

