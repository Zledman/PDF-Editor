package com.example.pdfserver.web;

import com.example.pdfserver.dto.ReplaceRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.contentstream.operator.Operator;
import org.apache.pdfbox.cos.COSArray;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSNumber;
import org.apache.pdfbox.cos.COSString;
import org.apache.pdfbox.pdfparser.PDFStreamParser;
import org.apache.pdfbox.pdfwriter.ContentStreamWriter;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.state.RenderingMode;
import org.apache.pdfbox.util.Matrix;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;

@RestController
@CrossOrigin(origins = "*")
public class ReplaceController {
  private final ObjectMapper mapper = new ObjectMapper();

  @PostMapping(value = "/replace-text", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<byte[]> replaceText(
      @RequestPart("file") MultipartFile file,
      @RequestPart("meta") String metaJson) throws IOException {
    ReplaceRequest req = mapper.readValue(metaJson, ReplaceRequest.class);
    byte[] pdfBytes = file.getBytes();

    try (PDDocument doc = PDDocument.load(pdfBytes)) {
      if (req != null && req.replacements != null) {
        for (ReplaceRequest.Replacement rp : req.replacements) {
          if (rp == null || rp.bbox == null)
            continue;
          int pageIndex = Math.max(0, (rp.page > 0 ? rp.page - 1 : 0));
          if (pageIndex >= doc.getNumberOfPages())
            continue;
          PDPage page = doc.getPage(pageIndex);

          System.out.println("Processing Page " + pageIndex);
          System.out
              .println("  Request BBox: " + rp.bbox.x + "," + rp.bbox.y + "," + rp.bbox.width + "," + rp.bbox.height);
          System.out.println("  MediaBox: " + page.getMediaBox());
          System.out.println("  CropBox: " + page.getCropBox());
          System.out.println("  Rotation: " + page.getRotation());

          boolean textRemoved = removeTextInBBox(doc, page, rp);
          // Lägg ny text ovanpå (utan vit bakgrund)
          writeNewText(doc, page, rp, textRemoved);
        }
      }

      ByteArrayOutputStream out = new ByteArrayOutputStream();
      doc.save(out);
      byte[] outBytes = out.toByteArray();
      return ResponseEntity.ok()
          .header(HttpHeaders.CONTENT_TYPE, "application/pdf")
          .body(outBytes);
    }
  }

  /** @return true om minst en text-operator faktiskt togs bort. */
  private boolean removeTextInBBox(PDDocument doc, PDPage page, ReplaceRequest.Replacement rp) throws IOException {
    PDFStreamParser parser = new PDFStreamParser(page);
    parser.parse();
    List<Object> tokens = parser.getTokens();

    List<Object> newTokens = new ArrayList<>();
    List<COSBase> args = new ArrayList<>();
    boolean removed = false;

    // Minimal text-state
    Matrix textMatrix = new Matrix();
    Matrix textLineMatrix = new Matrix();
    float fontSize = 12f;

    // Graphics state (CTM)
    java.util.Stack<Matrix> graphicsStack = new java.util.Stack<>();
    Matrix ctm = new Matrix(); // Identity default

    for (Object tok : tokens) {
      if (tok instanceof COSBase) {
        args.add((COSBase) tok);
        continue;
      }

      if (!(tok instanceof Operator)) {
        // okänd token; skriv igenom
        newTokens.add(tok);
        args.clear();
        continue;
      }

      Operator op = (Operator) tok;
      String name = op.getName();

      switch (name) {
        case "q" -> {
          graphicsStack.push(ctm.clone());
          flush(newTokens, args, op);
        }
        case "Q" -> {
          if (!graphicsStack.isEmpty()) {
            ctm = graphicsStack.pop();
          }
          flush(newTokens, args, op);
        }
        case "cm" -> {
          if (args.size() >= 6) {
            float a = num(args.get(0));
            float b = num(args.get(1));
            float c = num(args.get(2));
            float d = num(args.get(3));
            float e = num(args.get(4));
            float f = num(args.get(5));
            Matrix m = new Matrix(a, b, c, d, e, f);
            ctm = m.multiply(ctm);
          }
          flush(newTokens, args, op);
        }
        case "BT" -> {
          textMatrix = new Matrix();
          textLineMatrix = new Matrix();
          flush(newTokens, args, op);
        }
        case "ET" -> flush(newTokens, args, op);
        case "Tf" -> {
          if (args.size() >= 2 && args.get(1) instanceof COSNumber n) {
            fontSize = n.floatValue();
          }
          flush(newTokens, args, op);
        }
        case "Tm" -> {
          if (args.size() >= 6) {
            float a = num(args.get(0));
            float b = num(args.get(1));
            float c = num(args.get(2));
            float d = num(args.get(3));
            float e = num(args.get(4));
            float f = num(args.get(5));
            textMatrix = new Matrix(a, b, c, d, e, f);
            textLineMatrix = textMatrix.clone();
          }
          flush(newTokens, args, op);
        }
        case "Td", "TD" -> {
          if (args.size() >= 2) {
            float tx = num(args.get(0));
            float ty = num(args.get(1));
            textLineMatrix.translate(tx, ty);
            textMatrix = textLineMatrix.clone();
          }
          flush(newTokens, args, op);
        }
        case "T*" -> {
          textLineMatrix.translate(0, -fontSize);
          textMatrix = textLineMatrix.clone();
          flush(newTokens, args, op);
        }
        case "Tj" -> {
          COSString str = (args.size() >= 1 && args.get(0) instanceof COSString s) ? s : null;
          if (str == null || !isInBBox(page, textMatrix, ctm, fontSize, rp)) {
            flush(newTokens, args, op);
          } else {
            System.out.println("    REMOVING Tj: " + (str != null ? str.getString() : "null"));
            removed = true;
            args.clear(); // skip operand+op
          }
        }
        case "TJ" -> {
          COSArray arr = (args.size() >= 1 && args.get(0) instanceof COSArray a) ? a : null;
          if (arr == null) {
            flush(newTokens, args, op);
            break;
          }
          // Om textpositionen är i bbox: ta bort hela TJ (förenkling)
          if (!isInBBox(page, textMatrix, ctm, fontSize, rp)) {
            flush(newTokens, args, op);
          } else {
            System.out.println("    REMOVING TJ array");
            removed = true;
            args.clear();
          }
        }
        case "Do" -> {
          // XObject invocation - process Form XObjects recursively
          // Pass the current page CTM so XObject coordinates are properly transformed
          if (args.size() >= 1 && args.get(0) instanceof COSName xobjName) {
            PDResources resources = page.getResources();
            if (resources != null) {
              try {
                var xobj = resources.getXObject(xobjName);
                if (xobj instanceof PDFormXObject formXObj) {
                  System.out.println("    Processing Form XObject: " + xobjName.getName());
                  System.out.println("    Page CTM at Do: [" + ctm.getScaleX() + ", " + ctm.getShearY() +
                      ", " + ctm.getShearX() + ", " + ctm.getScaleY() +
                      ", " + ctm.getTranslateX() + ", " + ctm.getTranslateY() + "]");
                  if (removeTextFromFormXObject(doc, formXObj, page, rp, ctm)) {
                    removed = true;
                  }
                }
              } catch (Exception e) {
                System.out.println("    Error processing XObject " + xobjName + ": " + e.getMessage());
              }
            }
          }
          flush(newTokens, args, op);
        }
        default -> flush(newTokens, args, op);
      }
    }

    // Skriv en ny ensam content stream (ersätt befintliga)
    PDStream newStream = new PDStream(doc);
    try (var out = newStream.createOutputStream()) {
      ContentStreamWriter writer = new ContentStreamWriter(out);
      writer.writeTokens(newTokens);
    }
    page.setContents(newStream);
    return removed;
  }

  /** @return true om minst en text-operator togs bort ur XObject:et. */
  private boolean removeTextFromFormXObject(PDDocument doc, PDFormXObject formXObj, PDPage page,
      ReplaceRequest.Replacement rp, Matrix pageCTM) throws IOException {
    // Get XObject's transformation matrix (default is identity)
    Matrix xobjMatrix = formXObj.getMatrix();
    if (xobjMatrix == null) {
      xobjMatrix = new Matrix();
    }
    System.out.println("    XObject Matrix: [" + xobjMatrix.getScaleX() + ", " + xobjMatrix.getShearY() +
        ", " + xobjMatrix.getShearX() + ", " + xobjMatrix.getScaleY() +
        ", " + xobjMatrix.getTranslateX() + ", " + xobjMatrix.getTranslateY() + "]");

    PDFStreamParser parser = new PDFStreamParser(formXObj);
    parser.parse();
    List<Object> tokens = parser.getTokens();

    List<Object> newTokens = new ArrayList<>();
    List<COSBase> args = new ArrayList<>();

    Matrix textMatrix = new Matrix();
    Matrix textLineMatrix = new Matrix();
    float fontSize = 12f;
    java.util.Stack<Matrix> graphicsStack = new java.util.Stack<>();
    // Combine: XObject matrix × Page CTM
    Matrix ctm = xobjMatrix.multiply(pageCTM);

    boolean modified = false;

    for (Object tok : tokens) {
      if (tok instanceof COSBase) {
        args.add((COSBase) tok);
        continue;
      }
      if (!(tok instanceof Operator)) {
        newTokens.add(tok);
        args.clear();
        continue;
      }

      Operator op = (Operator) tok;
      String name = op.getName();

      switch (name) {
        case "q" -> {
          graphicsStack.push(ctm.clone());
          flush(newTokens, args, op);
        }
        case "Q" -> {
          if (!graphicsStack.isEmpty())
            ctm = graphicsStack.pop();
          flush(newTokens, args, op);
        }
        case "cm" -> {
          if (args.size() >= 6) {
            Matrix m = new Matrix(num(args.get(0)), num(args.get(1)), num(args.get(2)),
                num(args.get(3)), num(args.get(4)), num(args.get(5)));
            ctm = m.multiply(ctm);
          }
          flush(newTokens, args, op);
        }
        case "BT" -> {
          textMatrix = new Matrix();
          textLineMatrix = new Matrix();
          flush(newTokens, args, op);
        }
        case "ET" -> flush(newTokens, args, op);
        case "Tf" -> {
          if (args.size() >= 2 && args.get(1) instanceof COSNumber n)
            fontSize = n.floatValue();
          flush(newTokens, args, op);
        }
        case "Tm" -> {
          if (args.size() >= 6) {
            textMatrix = new Matrix(num(args.get(0)), num(args.get(1)), num(args.get(2)),
                num(args.get(3)), num(args.get(4)), num(args.get(5)));
            textLineMatrix = textMatrix.clone();
          }
          flush(newTokens, args, op);
        }
        case "Td", "TD" -> {
          if (args.size() >= 2) {
            textLineMatrix.translate(num(args.get(0)), num(args.get(1)));
            textMatrix = textLineMatrix.clone();
          }
          flush(newTokens, args, op);
        }
        case "T*" -> {
          textLineMatrix.translate(0, -fontSize);
          textMatrix = textLineMatrix.clone();
          flush(newTokens, args, op);
        }
        case "Tj" -> {
          COSString str = (args.size() >= 1 && args.get(0) instanceof COSString s) ? s : null;
          if (str == null || !isInBBox(page, textMatrix, ctm, fontSize, rp)) {
            flush(newTokens, args, op);
          } else {
            System.out.println("    REMOVING Tj from XObject: " + (str != null ? str.getString() : ""));
            modified = true;
            args.clear();
          }
        }
        case "TJ" -> {
          COSArray arr = (args.size() >= 1 && args.get(0) instanceof COSArray a) ? a : null;
          if (arr == null || !isInBBox(page, textMatrix, ctm, fontSize, rp)) {
            flush(newTokens, args, op);
          } else {
            System.out.println("    REMOVING TJ from XObject");
            modified = true;
            args.clear();
          }
        }
        default -> flush(newTokens, args, op);
      }
    }

    if (modified) {
      try (OutputStream out = formXObj.getStream().createOutputStream()) {
        ContentStreamWriter writer = new ContentStreamWriter(out);
        writer.writeTokens(newTokens);
      }
      System.out.println("    XObject content stream updated");
    }
    return modified;
  }

  private static void flush(List<Object> out, List<COSBase> args, Operator op) {
    out.addAll(args);
    out.add(op);
    args.clear();
  }

  private static float num(COSBase b) {
    return (b instanceof COSNumber n) ? n.floatValue() : 0f;
  }

  /**
   * Frontend skickar bbox i ett "top-left" koordinatsystem (y=0 i toppen).
   * PDF-content streams använder "bottom-left" (y=0 i botten).
   * Konvertera bbox->PDF innan jämförelse.
   */
  private static boolean isInBBox(PDPage page, Matrix textMatrix, Matrix ctm, float fontSize,
      ReplaceRequest.Replacement rp) {
    Matrix trm = textMatrix.multiply(ctm);
    float x = trm.getTranslateX();
    float y = trm.getTranslateY();

    // PDF coordinates
    float pageH = page.getMediaBox().getHeight(); // TODO: Handle rotation/cropbox
    float bx = rp.bbox.x;
    float by = pageH - (rp.bbox.y + rp.bbox.height);
    float bw = rp.bbox.width;
    float bh = rp.bbox.height;

    // Add tolerance (2 points X, 5 points Y) - small tolerance for precision
    float toleranceX = 2.0f;
    float toleranceY = 5.0f;

    boolean match = x >= (bx - toleranceX) &&
        x <= (bx + bw + toleranceX) &&
        y >= (by - toleranceY) &&
        y <= (by + bh + toleranceY);

    if (match) {
      System.out.println(
          "    HIT: Text at (" + x + ", " + y + ") inside PDF-BBox [" + bx + ", " + by + ", " + bw + ", " + bh + "]");
    } else {
      // Log EVERY text position to debug coordinate space
      System.out.println("    TEXT: (" + x + ", " + y + ") [" + (char) 0 + "...] vs BBox [" + bx + ", " + by + "]");
    }

    return match;
  }

  private static float[] parseHex(String hex) {
    if (hex == null)
      return new float[] { 0f, 0f, 0f };
    String s = hex.trim();
    if (s.startsWith("#"))
      s = s.substring(1);
    if (s.length() != 6)
      return new float[] { 0f, 0f, 0f };
    try {
      int r = Integer.parseInt(s.substring(0, 2), 16);
      int g = Integer.parseInt(s.substring(2, 4), 16);
      int b = Integer.parseInt(s.substring(4, 6), 16);
      return new float[] { r / 255f, g / 255f, b / 255f };
    } catch (Exception e) {
      return new float[] { 0f, 0f, 0f };
    }
  }

  /** Parse background color from "rgb(r,g,b)" or "#RRGGBB" format. Falls back to white. */
  private static float[] parseBgColor(String bgColor) {
    if (bgColor == null || bgColor.isEmpty()) return new float[] { 1f, 1f, 1f };
    String s = bgColor.trim();
    float[] result = null;
    // Handle "rgb(r,g,b)" format
    if (s.startsWith("rgb(") && s.endsWith(")")) {
      try {
        String inner = s.substring(4, s.length() - 1);
        String[] parts = inner.split(",");
        if (parts.length == 3) {
          float r = Float.parseFloat(parts[0].trim()) / 255f;
          float g = Float.parseFloat(parts[1].trim()) / 255f;
          float b = Float.parseFloat(parts[2].trim()) / 255f;
          result = new float[] { Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b)) };
        }
      } catch (Exception e) { /* fall through */ }
    }
    // Handle "#RRGGBB" format
    if (result == null && s.startsWith("#")) result = parseHex(s);
    if (result == null) return new float[] { 1f, 1f, 1f };
    // Snap near-white to pure white to avoid faint gray rectangles
    if (result[0] >= 0.97f && result[1] >= 0.97f && result[2] >= 0.97f) {
      return new float[] { 1f, 1f, 1f };
    }
    return result;
  }

  private static void writeNewText(PDDocument doc, PDPage page, ReplaceRequest.Replacement rp, boolean textRemoved)
      throws IOException {
    float size = rp.size > 0 ? rp.size : 12f;
    float[] rgb = parseHex(rp.color);

    // PDFBox kan inte "showText" med kontrolltecken (t.ex. \n). Hantera multi-line
    // explicit.
    String text = rp.text != null ? rp.text : "";
    text = text.replace("\r\n", "\n").replace("\r", "\n");
    // Byt ut övriga kontrolltecken (tab, etc) till mellanslag för att undvika
    // encode-crash.
    text = text.replaceAll("[\\u0000-\\u0009\\u000B-\\u001F]", " ");
    String[] lines = text.split("\n", -1);

    float pageH = page.getMediaBox().getHeight();

    try (PDPageContentStream cs = new PDPageContentStream(doc, page, PDPageContentStream.AppendMode.APPEND, true,
        true)) {
      // Rita en vit rektangel (whiteout) över originaltext-området som backup
      // ifall removeTextInBBox inte hittade alla text-operatorer.
      //
      // bbox:ens underkant ligger ~0.18×radhöjd under baslinjen (descender-utrymme).
      // Så långt ner behövs bara om originaltexten faktiskt finns kvar — annars äter
      // rektangeln upp t.ex. en ramlinje strax under texten. Togs texten bort på
      // riktigt räcker det att sluta i höjd med baslinjen.
      float padX = size * 0.1f;   // Liten horisontell marginal
      float padTop = size * 0.2f; // Lite uppåt för ascenders
      // Positivt = trimma upp mot baslinjen, negativt = extra marginal nedåt.
      float trimBot = textRemoved ? rp.bbox.height * 0.18f : -(size * 0.05f);
      float whiteX = rp.bbox.x - padX;
      float whiteY = pageH - (rp.bbox.y + rp.bbox.height) + trimBot;
      float whiteW = rp.bbox.width + 2 * padX;
      float whiteH = rp.bbox.height + padTop - trimBot;

      // Har klienten mätt upp en ramlinje strax under texten: klipp rektangeln
      // ovanför den, annars suddas linjen bort.
      if (rp.maskBottom != null) {
        float limitY = pageH - rp.maskBottom; // top-left -> bottom-left
        if (limitY > whiteY) {
          whiteH -= (limitY - whiteY);
          whiteY = limitY;
        }
      }
      if (whiteH > 0) {
        float[] bgRgb = parseBgColor(rp.bgColor);
        cs.setNonStrokingColor(bgRgb[0], bgRgb[1], bgRgb[2]);
        cs.addRect(whiteX, whiteY, whiteW, whiteH);
        cs.fill();
      }

      // Rita ny text ovanpå
      cs.beginText();
      try {
        cs.setRenderingMode(RenderingMode.FILL);
        PDType1Font pdfFont = (rp.font != null && rp.font.contains("Bold"))
            ? PDType1Font.HELVETICA_BOLD : PDType1Font.HELVETICA;
        cs.setFont(pdfFont, size);
        cs.setNonStrokingColor(rgb[0], rgb[1], rgb[2]);

        // Leading (radavstånd) i PDF user space.
        // Matcha UI: lineHeight ≈ fontSize (tajta rader)
        cs.setLeading(size * 1.0f);

        // Konvertera y från top-left (frontend) till bottom-left (PDF)
        // Baseline i pdfExport.js: height - rect.y - (fontSizePt * 0.85)
        float baselineY = pageH - rp.bbox.y - (size * 0.85f);
        cs.newLineAtOffset(rp.bbox.x, baselineY);

        if (lines.length == 0) {
          cs.showText("");
        } else {
          cs.showText(lines[0] != null ? lines[0] : "");
          for (int i = 1; i < lines.length; i++) {
            cs.newLine();
            cs.showText(lines[i] != null ? lines[i] : "");
          }
        }
      } finally {
        // Säkerställ endText även om showText kastar exception, så vi slipper varningen
        // i loggen.
        cs.endText();
      }
    }
  }
}
