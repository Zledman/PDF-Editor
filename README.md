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
     - Knapp i toolbaren aktiverar kopiera område-läge.
     - Användaren markerar ett område (sourceRect).
     - Rendera området till canvas via PDF.js → base64 imageData.
     - Placera imageData på ny plats (targetRect).
     - Exportera som inbäddad bild i PDF.

3. **Export (pdf-lib)**
   - `pdfExport.js` (frontend) och `pdfService.js` (backend).
   - Text: `drawText` med pt-värden (x, baseline, fontSizePt).
   - Whiteout: `drawRectangle` med pt-värden.
   - Kopiera område: `drawImage` med imageData och targetRectPt.
   - Samma font som viewer bäddas in (t.ex. Helvetica eller TTF).

4. **Projektstruktur**

/src /components TransparentTextBox.jsx WhiteoutBox.jsx PatchBox.jsx /utils coordMap.js textLayoutConstants.js /services pdfExport.js pdfService.js


5. **Mål**
- Stabil pt‑först‑modell: viewer och export alltid synkade.
- Text kan förminskas ned till `MIN_FONT_PT`.
- Whiteout fungerar symmetriskt.
- Kopiera område-verktyget låter användaren kopiera en bit av PDF och placera den på annan plats.
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

### (Valfritt) Starta Java-servern (text replace + server-compress)
Det finns en Spring Boot-server i `server-java` som kör på port **8082** och exponerar:
- `POST /replace-text` (PDFBox) – används vid export när importerad text ersätts
- `POST /compress-pdf` (Ghostscript) – “riktig” PDF-komprimering på servern

Starta den med:
```bash
npm run dev:server
```

#### Ghostscript (krävs för `/compress-pdf`)
- Installera Ghostscript (Windows): hämta från Ghostscript releases.
- Antingen:
  - Lägg `gswin64c.exe` i PATH, **eller**
  - Sätt env-var: `PDF_GS_PATH` till full sökväg till `gswin64c.exe` (rekommenderat).

Exempel (PowerShell):
```powershell
setx PDF_GS_PATH "C:\Program Files\gs\gs10.xx.x\bin\gswin64c.exe"
```

Starta om `npm run dev:server` efter att du satt env-var (så processen får den).

##### Snabbtest (ska ge 200 och skriva ut en PDF)
- curl:
```bash
curl -v -F "file=@C:\path\to\input.pdf" "http://localhost:8082/compress-pdf?preset=ebook" --output out.pdf
```
- PowerShell:
```powershell
$uri = "http://localhost:8082/compress-pdf?preset=ebook"
$form = @{ file = Get-Item "C:\path\to\input.pdf" }
Invoke-WebRequest -Method Post -Uri $uri -Form $form -OutFile "out.pdf"
```

#### Frontend env-vars (valfritt)
- `VITE_COMPRESS_SERVER_URL` (default: `http://localhost:8082/compress-pdf`)
- `VITE_COMPRESS_SERVER_REQUIRED`
  - `false` (dev): försök server först, fallback till browser
  - `true` (prod): kräver server (ingen fallback)

3. Öppna webbläsaren och gå till den URL som visas (vanligtvis http://localhost:5173)

4. Ladda en PDF-fil via "Välj fil"-knappen

5. Använd verktygen:
   - **Text**: Klicka på PDF:en för att skapa en textbox och börja skriva direkt
   - **Whiteout**: Klicka och dra för att skapa en vit rektangel som täcker text
   - **Kopiera område**: 
     - Klicka på "Kopiera område"-knappen
     - Markera ett område på PDF:en (source)
     - Klicka på ny plats för att placera kopian (target)
   - **Exportera PDF**: Klicka på "Exportera PDF" för att ladda ner den redigerade PDF:en

## Bygga för produktion

```bash
npm run build
```

De byggda filerna finns i `dist/`-mappen.