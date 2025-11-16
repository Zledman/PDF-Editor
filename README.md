README

Bygg en PDF-redigerare som en modern webapp (React + Vite + pdf-lib + PDF.js) med följande funktioner:

1. **Arkitektur**
   - All data lagras i pt (points), aldrig i px.
   - Gemensam modul `textLayoutConstants.js` med:
     - `LINE_HEIGHT_FACTOR = 1.2`
     - `MIN_FONT_PT = 6`
   - `coordMap.js` för pt↔px-konvertering.

2. **Viewer (React-komponenter)**
   - `TransparentTextBox.jsx`: lägg till, flytta, ändra storlek på text.
     - Fontstorlek respekterar `MIN_FONT_PT`.
     - Line-height beräknas med `LINE_HEIGHT_FACTOR`.
     - Diagnostik via `console.table` (overlay vs stored vs export).
   - `WhiteoutBox.jsx`: rita vita rektanglar som täcker text.
   - `PatchBox.jsx`: nytt verktyg ("klonings-whiteout").
     - Knapp i toolbaren aktiverar patch-läge.
     - Användaren markerar ett område (sourceRect).
     - Rendera området till canvas via PDF.js → base64 imageData.
     - Placera imageData på ny plats (targetRect).
     - Exportera som inbäddad bild i PDF.

3. **Export (pdf-lib)**
   - `pdfExport.js` (frontend) och `pdfService.js` (backend).
   - Text: `drawText` med pt-värden (x, baseline, fontSizePt).
   - Whiteout: `drawRectangle` med pt-värden.
   - Patch: `drawImage` med imageData och targetRectPt.
   - Samma font som viewer bäddas in (t.ex. Helvetica eller TTF).

4. **Projektstruktur**

/src /components TransparentTextBox.jsx WhiteoutBox.jsx PatchBox.jsx /utils coordMap.js textLayoutConstants.js /services pdfExport.js pdfService.js


5. **Mål**
- Stabil pt‑först‑modell: viewer och export alltid synkade.
- Text kan förminskas ned till `MIN_FONT_PT`.
- Whiteout fungerar symmetriskt.
- Patch‑verktyg låter användaren kopiera en bit av PDF och placera den på annan plats.
- Exporten ger pixelperfekt resultat utan px/pt‑mismatch.

## Installation och körning

1. Installera dependencies:
```bash
npm install
```

2. Starta utvecklingsservern:
```bash
npm run dev
```

3. Öppna webbläsaren och gå till den URL som visas (vanligtvis http://localhost:5173)

4. Ladda en PDF-fil via "Välj fil"-knappen

5. Använd verktygen:
   - **Text**: Klicka och dra för att skapa en textbox, dubbelklicka för att redigera
   - **Whiteout**: Klicka och dra för att skapa en vit rektangel som täcker text
   - **Patch**: 
     - Klicka på "Patch"-knappen
     - Markera ett område på PDF:en (source)
     - Klicka på ny plats för att placera kopian (target)
   - **Exportera PDF**: Klicka på "Exportera PDF" för att ladda ner den redigerade PDF:en

## Bygga för produktion

```bash
npm run build
```

De byggda filerna finns i `dist/`-mappen.