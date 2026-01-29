package com.example.pdfserver.web;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@RestController
@CrossOrigin(origins = "*")
public class OcrController {

    @PostMapping(value = "/ocr-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> ocrPdf(
            @RequestPart("file") MultipartFile file,
            @RequestParam(name = "lang", defaultValue = "swe+eng") String lang) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
                    .body("No file uploaded".getBytes(StandardCharsets.UTF_8));
        }

        Path tempDir;
        try {
            tempDir = Files.createTempDirectory("ocr-");
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
                    .body(("Could not create temp directory: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }

        List<Path> pageImages = new ArrayList<>();
        List<Path> pagePdfs = new ArrayList<>();
        Path combinedPdf = null;

        try {
            // 1. Convert PDF pages to images using PDFBox
            byte[] pdfBytes = file.getBytes();
            try (PDDocument doc = PDDocument.load(pdfBytes)) {
                PDFRenderer renderer = new PDFRenderer(doc);
                int numPages = doc.getNumberOfPages();

                for (int i = 0; i < numPages; i++) {
                    // Render at 300 DPI for good OCR quality
                    BufferedImage image = renderer.renderImageWithDPI(i, 300);
                    Path imgPath = tempDir.resolve("page_" + i + ".png");
                    ImageIO.write(image, "png", imgPath.toFile());
                    pageImages.add(imgPath);
                }
            }

            // 2. Run Tesseract on each page to create PDF with text layer
            String tesseract = System.getenv().getOrDefault("PDF_TESSERACT_PATH", "tesseract");

            for (int i = 0; i < pageImages.size(); i++) {
                Path imgPath = pageImages.get(i);
                Path outBase = tempDir.resolve("out_" + i);
                Path outPdf = tempDir.resolve("out_" + i + ".pdf");

                List<String> cmd = new ArrayList<>();
                cmd.add(tesseract);
                cmd.add(imgPath.toAbsolutePath().toString());
                cmd.add(outBase.toAbsolutePath().toString());
                cmd.add("--dpi");
                cmd.add("300");
                cmd.add("-l");
                cmd.add(lang);
                cmd.add("pdf");

                Process p;
                try {
                    p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
                } catch (IOException e) {
                    String hint = "Tesseract not found. Install Tesseract and/or set PDF_TESSERACT_PATH.";
                    return ResponseEntity.internalServerError()
                            .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
                            .body((hint + "\n\n" + e.getMessage()).getBytes(StandardCharsets.UTF_8));
                }

                int code;
                try {
                    code = p.waitFor();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return ResponseEntity.internalServerError()
                            .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
                            .body("OCR interrupted".getBytes(StandardCharsets.UTF_8));
                }

                if (code != 0) {
                    String log = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                    return ResponseEntity.internalServerError()
                            .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
                            .body(("Tesseract failed (" + code + "):\n" + log).getBytes(StandardCharsets.UTF_8));
                }

                if (Files.exists(outPdf)) {
                    pagePdfs.add(outPdf);
                }
            }

            // 3. Merge all page PDFs into one
            if (pagePdfs.isEmpty()) {
                return ResponseEntity.internalServerError()
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
                        .body("No pages were OCR'd".getBytes(StandardCharsets.UTF_8));
            }

            combinedPdf = tempDir.resolve("combined.pdf");

            if (pagePdfs.size() == 1) {
                // Single page, just copy
                Files.copy(pagePdfs.get(0), combinedPdf);
            } else {
                // Merge multiple pages using PDFBox
                try (PDDocument merged = new PDDocument()) {
                    for (Path pagePdf : pagePdfs) {
                        try (PDDocument pageDoc = PDDocument.load(pagePdf.toFile())) {
                            for (int i = 0; i < pageDoc.getNumberOfPages(); i++) {
                                merged.addPage(pageDoc.getPage(i));
                            }
                        }
                    }
                    merged.save(combinedPdf.toFile());
                }
            }

            byte[] outBytes = Files.readAllBytes(combinedPdf);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, "application/pdf")
                    .body(outBytes);

        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
                    .body(("OCR failed: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        } finally {
            // Cleanup temp files
            for (Path p : pageImages) {
                try {
                    Files.deleteIfExists(p);
                } catch (Exception ignored) {
                }
            }
            for (Path p : pagePdfs) {
                try {
                    Files.deleteIfExists(p);
                } catch (Exception ignored) {
                }
            }
            if (combinedPdf != null) {
                try {
                    Files.deleteIfExists(combinedPdf);
                } catch (Exception ignored) {
                }
            }
            try {
                Files.deleteIfExists(tempDir);
            } catch (Exception ignored) {
            }
        }
    }
}
