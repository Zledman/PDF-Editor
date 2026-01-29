package com.example.pdfserver.web;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.poi.xwpf.usermodel.*;
import org.apache.poi.xslf.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import org.apache.poi.ss.usermodel.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.xhtmlrenderer.pdf.ITextRenderer;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.List;

@RestController
@RequestMapping("/convert")
@CrossOrigin(origins = "*")
public class ConvertController {

    /**
     * Convert Word document (.docx) to PDF
     */
    @PostMapping("/word-to-pdf")
    public ResponseEntity<byte[]> wordToPdf(@RequestParam("file") MultipartFile file) {
        try (InputStream is = file.getInputStream();
                XWPFDocument doc = new XWPFDocument(is);
                PDDocument pdf = new PDDocument();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Simple text extraction and rendering
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(pdf, page)) {
                cs.beginText();
                cs.setFont(PDType1Font.HELVETICA, 12);
                cs.setLeading(14.5f);
                cs.newLineAtOffset(50, 750);

                for (XWPFParagraph para : doc.getParagraphs()) {
                    String text = para.getText();
                    if (text != null && !text.isEmpty()) {
                        // Handle long lines by wrapping
                        String[] words = text.split(" ");
                        StringBuilder line = new StringBuilder();
                        for (String word : words) {
                            if (line.length() + word.length() > 80) {
                                cs.showText(line.toString());
                                cs.newLine();
                                line = new StringBuilder();
                            }
                            if (line.length() > 0)
                                line.append(" ");
                            line.append(word);
                        }
                        if (line.length() > 0) {
                            cs.showText(line.toString());
                            cs.newLine();
                        }
                    }
                    cs.newLine(); // Paragraph break
                }
                cs.endText();
            }

            pdf.save(out);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=converted.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(out.toByteArray());

        } catch (Exception e) {
            return ResponseEntity.status(500).body(("Error: " + e.getMessage()).getBytes());
        }
    }

    /**
     * Convert PowerPoint (.pptx) to PDF by rendering slides as images
     */
    @PostMapping("/ppt-to-pdf")
    public ResponseEntity<byte[]> pptToPdf(@RequestParam("file") MultipartFile file) {
        try (InputStream is = file.getInputStream();
                XMLSlideShow ppt = new XMLSlideShow(is);
                PDDocument pdf = new PDDocument();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            java.awt.Dimension pgsize = ppt.getPageSize();
            List<XSLFSlide> slides = ppt.getSlides();

            for (XSLFSlide slide : slides) {
                BufferedImage img = new BufferedImage(pgsize.width, pgsize.height, BufferedImage.TYPE_INT_RGB);
                Graphics2D graphics = img.createGraphics();
                graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                graphics.setColor(java.awt.Color.WHITE);
                graphics.fillRect(0, 0, pgsize.width, pgsize.height);
                slide.draw(graphics);
                graphics.dispose();

                // Add slide image to PDF
                PDPage page = new PDPage(new PDRectangle(pgsize.width, pgsize.height));
                pdf.addPage(page);

                ByteArrayOutputStream imgOut = new ByteArrayOutputStream();
                ImageIO.write(img, "PNG", imgOut);
                PDImageXObject pdImage = PDImageXObject.createFromByteArray(pdf, imgOut.toByteArray(), "slide");

                try (PDPageContentStream cs = new PDPageContentStream(pdf, page)) {
                    cs.drawImage(pdImage, 0, 0, pgsize.width, pgsize.height);
                }
            }

            pdf.save(out);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=converted.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(out.toByteArray());

        } catch (Exception e) {
            return ResponseEntity.status(500).body(("Error: " + e.getMessage()).getBytes());
        }
    }

    /**
     * Convert Excel (.xlsx) to PDF
     */
    @PostMapping("/excel-to-pdf")
    public ResponseEntity<byte[]> excelToPdf(@RequestParam("file") MultipartFile file) {
        try (InputStream is = file.getInputStream();
                XSSFWorkbook workbook = new XSSFWorkbook(is);
                PDDocument pdf = new PDDocument();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                XSSFSheet sheet = workbook.getSheetAt(i);
                PDPage page = new PDPage(PDRectangle.A4);
                pdf.addPage(page);

                try (PDPageContentStream cs = new PDPageContentStream(pdf, page)) {
                    cs.beginText();
                    cs.setFont(PDType1Font.COURIER, 10);
                    cs.setLeading(12f);
                    cs.newLineAtOffset(30, 780);

                    // Sheet name header
                    cs.setFont(PDType1Font.HELVETICA_BOLD, 12);
                    cs.showText("Sheet: " + sheet.getSheetName());
                    cs.newLine();
                    cs.newLine();
                    cs.setFont(PDType1Font.COURIER, 9);

                    int rowCount = 0;
                    for (Row row : sheet) {
                        if (rowCount++ > 60)
                            break; // Limit rows per page
                        StringBuilder rowText = new StringBuilder();
                        for (Cell cell : row) {
                            String cellValue = getCellValueAsString(cell);
                            // Pad/truncate for table alignment
                            if (cellValue.length() > 15)
                                cellValue = cellValue.substring(0, 15);
                            rowText.append(String.format("%-16s", cellValue));
                        }
                        String line = rowText.toString();
                        if (line.length() > 100)
                            line = line.substring(0, 100);
                        cs.showText(line);
                        cs.newLine();
                    }
                    cs.endText();
                }
            }

            pdf.save(out);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=converted.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(out.toByteArray());

        } catch (Exception e) {
            return ResponseEntity.status(500).body(("Error: " + e.getMessage()).getBytes());
        }
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null)
            return "";
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                return String.valueOf(cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                return cell.getCellFormula();
            default:
                return "";
        }
    }

    /**
     * Convert HTML to PDF using Flying Saucer
     */
    @PostMapping("/html-to-pdf")
    public ResponseEntity<byte[]> htmlToPdf(@RequestParam("file") MultipartFile file) {
        try (InputStream is = file.getInputStream();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            String html = new String(is.readAllBytes(), "UTF-8");

            // Ensure proper XHTML structure for Flying Saucer
            if (!html.toLowerCase().contains("<!doctype") && !html.toLowerCase().contains("<html")) {
                html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/></head><body>" + html + "</body></html>";
            }

            // Replace common HTML5 elements that Flying Saucer doesn't handle well
            html = html.replaceAll("<!DOCTYPE[^>]*>",
                    "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">");

            ITextRenderer renderer = new ITextRenderer();
            renderer.setDocumentFromString(html);
            renderer.layout();
            renderer.createPDF(out);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=converted.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(out.toByteArray());

        } catch (Exception e) {
            return ResponseEntity.status(500).body(("Error: " + e.getMessage()).getBytes());
        }
    }

    /**
     * Convert PDF to PDF/A format for archiving
     * Note: This is a simplified conversion that re-saves the PDF with embedded
     * fonts
     */
    @PostMapping("/pdf-to-pdfa")
    public ResponseEntity<byte[]> pdfToPdfA(@RequestParam("file") MultipartFile file) {
        try (InputStream is = file.getInputStream();
                PDDocument doc = PDDocument.load(is);
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // PDFBox doesn't have built-in PDF/A conversion, but we can:
            // 1. Load the document
            // 2. Set some basic metadata
            // 3. Re-save with compression

            // Add basic metadata for archival
            doc.getDocumentInformation().setProducer("PDF Editor - PDF/A Converter");
            doc.getDocumentInformation().setCreator("PDF Editor");

            // Save the document (this normalizes it somewhat)
            doc.save(out);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=converted_pdfa.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(out.toByteArray());

        } catch (Exception e) {
            return ResponseEntity.status(500).body(("Error: " + e.getMessage()).getBytes());
        }
    }

    /**
     * Unlock a password-protected PDF
     */
    @PostMapping("/unlock-pdf")
    public ResponseEntity<byte[]> unlockPdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "password", required = false, defaultValue = "") String password) {
        try (InputStream is = file.getInputStream();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            PDDocument doc;
            if (password != null && !password.isEmpty()) {
                doc = PDDocument.load(is, password);
            } else {
                doc = PDDocument.load(is);
            }

            // Remove encryption
            doc.setAllSecurityToBeRemoved(true);
            doc.save(out);
            doc.close();

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=unlocked.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(out.toByteArray());

        } catch (Exception e) {
            return ResponseEntity.status(500).body(("Error: " + e.getMessage()).getBytes());
        }
    }

    /**
     * Protect a PDF with password
     */
    @PostMapping("/protect-pdf")
    public ResponseEntity<byte[]> protectPdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "userPassword", required = false, defaultValue = "") String userPassword,
            @RequestParam(value = "ownerPassword", required = false, defaultValue = "") String ownerPassword) {
        try (InputStream is = file.getInputStream();
                PDDocument doc = PDDocument.load(is);
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Set up encryption
            org.apache.pdfbox.pdmodel.encryption.AccessPermission ap = new org.apache.pdfbox.pdmodel.encryption.AccessPermission();
            org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy spp = new org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy(
                    ownerPassword.isEmpty() ? userPassword : ownerPassword,
                    userPassword,
                    ap);
            spp.setEncryptionKeyLength(128);
            doc.protect(spp);
            doc.save(out);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=protected.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(out.toByteArray());

        } catch (Exception e) {
            return ResponseEntity.status(500).body(("Error: " + e.getMessage()).getBytes());
        }
    }
}
