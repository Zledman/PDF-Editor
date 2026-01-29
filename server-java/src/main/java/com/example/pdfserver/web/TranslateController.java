package com.example.pdfserver.web;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

@RestController
@CrossOrigin(origins = "*")
public class TranslateController {

    private static final String OLLAMA_URL = "http://localhost:11434/api/generate";

    @PostMapping(value = "/translate-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> translatePdf(
            @RequestPart("file") MultipartFile file,
            @RequestParam(name = "targetLang", defaultValue = "en") String targetLang) {

        if (file == null || file.isEmpty()) {
            return badRequest("No file uploaded");
        }

        try {
            // 1. Extract text from PDF
            byte[] pdfBytes = file.getBytes();
            String extractedText;

            try (PDDocument doc = PDDocument.load(pdfBytes)) {
                PDFTextStripper stripper = new PDFTextStripper();
                extractedText = stripper.getText(doc);
            }

            if (extractedText == null || extractedText.trim().isEmpty()) {
                return badRequest("No text found in PDF. The PDF might be image-based. Try OCR first.");
            }

            // 2. Split text into chunks (Llama 3 has context limits)
            // We'll translate in chunks of ~2000 characters
            String translatedText = translateWithOllama(extractedText, targetLang);

            if (translatedText == null || translatedText.isEmpty()) {
                return serverError("Translation returned empty result");
            }

            // 3. Create new PDF with translated text
            byte[] resultPdf = createPdfFromText(translatedText);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, "application/pdf")
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=translated.pdf")
                    .body(resultPdf);

        } catch (Exception e) {
            e.printStackTrace();
            return serverError("Translation failed: " + e.getMessage());
        }
    }

    /**
     * Translate text and return JSON (for side-by-side view).
     */
    @PostMapping(value = "/translate-text", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> translateText(@RequestBody TranslateTextRequest request) {
        if (request.text == null || request.text.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body("{\"error\": \"No text provided\"}");
        }

        try {
            String result;
            if ("summary".equals(request.mode)) {
                result = summarizeWithOllama(request.text, request.targetLang);
            } else {
                result = translateWithOllama(request.text, request.targetLang);
            }
            String jsonResponse = "{\"translatedText\": " + escapeJsonString(result) + "}";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body(jsonResponse);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body("{\"error\": \"" + e.getMessage().replace("\"", "'") + "\"}");
        }
    }

    /**
     * Chat about PDF content.
     */
    @PostMapping(value = "/chat-pdf", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> chatPdf(@RequestBody ChatPdfRequest request) {
        if (request.question == null || request.question.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body("{\"error\": \"No question provided\"}");
        }

        try {
            String langName = getLanguageName(request.targetLang);
            String prompt = String.format(
                    "Based on the following document text, answer this question in %s. Be concise and helpful.\n\nDocument:\n%s\n\nQuestion: %s\n\nAnswer:",
                    langName,
                    request.text != null ? request.text.substring(0, Math.min(3000, request.text.length())) : "",
                    request.question);

            String response = callOllamaRaw(prompt);
            String jsonResponse = "{\"response\": " + escapeJsonString(response) + "}";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body(jsonResponse);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body("{\"error\": \"" + e.getMessage().replace("\"", "'") + "\"}");
        }
    }

    // Request DTOs
    public static class TranslateTextRequest {
        public String text;
        public String targetLang = "en";
        public String mode = "full"; // "summary" or "full"
    }

    public static class ChatPdfRequest {
        public String text;
        public String question;
        public String targetLang = "en";
    }

    /**
     * Summarize document text by extracting key information.
     */
    private String summarizeWithOllama(String text, String targetLang) throws IOException {
        String langName = getLanguageName(targetLang);

        // Limit text to prevent context overflow
        String limitedText = text.length() > 4000 ? text.substring(0, 4000) : text;

        String prompt = String.format(
                "You are a document summarizer. Analyze the following document and create a clear, structured summary in %s.\n\n"
                        +
                        "FORMAT RULES:\n" +
                        "- Use this exact format for each key piece of information:\n" +
                        "**Label:** Value\n\n" +
                        "- Put each item on its OWN LINE with a blank line between items\n" +
                        "- Extract: document type, names, dates, amounts, addresses, reference numbers, important terms\n"
                        +
                        "- Be concise but complete\n" +
                        "- Return ONLY the formatted summary, no explanations\n\n" +
                        "Example output format:\n" +
                        "**Document Type:** Invoice\n\n" +
                        "**Invoice Number:** 12345\n\n" +
                        "**Customer:** John Doe, Stockholm\n\n" +
                        "**Date:** 2025-01-15\n\n" +
                        "**Total Amount:** 5,000.00 SEK\n\n" +
                        "Now analyze this document:\n\n%s",
                langName, limitedText.trim());

        return callOllamaRaw(prompt);
    }

    private String translateWithOllama(String text, String targetLang) throws IOException {
        // Split text into manageable chunks
        int chunkSize = 1500;
        StringBuilder result = new StringBuilder();

        String[] paragraphs = text.split("\n\n");
        StringBuilder currentChunk = new StringBuilder();

        for (String paragraph : paragraphs) {
            if (currentChunk.length() + paragraph.length() > chunkSize && currentChunk.length() > 0) {
                // Translate current chunk
                String translated = callOllama(currentChunk.toString(), targetLang);
                result.append(translated).append("\n\n");
                currentChunk = new StringBuilder();
            }
            currentChunk.append(paragraph).append("\n\n");
        }

        // Translate remaining text
        if (currentChunk.length() > 0) {
            String translated = callOllama(currentChunk.toString(), targetLang);
            result.append(translated);
        }

        return result.toString().trim();
    }

    private String callOllama(String text, String targetLang) throws IOException {
        String langName = getLanguageName(targetLang);

        String prompt = String.format(
                "You are a translator. Translate the following text to %s.\\n\\n" +
                        "STRICT RULES:\\n" +
                        "- Output ONLY the translated text\\n" +
                        "- Do NOT add any introduction like 'Here is the translation'\\n" +
                        "- Do NOT add any notes, explanations, or comments\\n" +
                        "- Do NOT mention if text is cut off or incomplete\\n" +
                        "- Preserve paragraph structure with blank lines between sections\\n" +
                        "- Start directly with the translated content\\n\\n" +
                        "Text to translate:\\n%s",
                langName, text.trim());

        // Build JSON body using proper escaping
        String jsonBody = "{\"model\": \"llama3\", \"prompt\": " + escapeJsonString(prompt) + ", \"stream\": false}";

        URL url = new URL(OLLAMA_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(120000); // 2 minutes for translation

        try (OutputStream os = conn.getOutputStream()) {
            os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
        }

        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            InputStream errorStream = conn.getErrorStream();
            String error = errorStream != null ? new String(errorStream.readAllBytes(), StandardCharsets.UTF_8)
                    : "Unknown error";
            throw new IOException("Ollama returned " + responseCode + ": " + error);
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }

            // Parse JSON response to get "response" field using indexOf (safer than regex
            // for long strings)
            String jsonResponse = response.toString();
            String translatedText = extractJsonField(jsonResponse, "response");

            if (translatedText != null) {
                return fixUnicodeEscapes(translatedText);
            }

            throw new IOException("Could not parse Ollama response: "
                    + jsonResponse.substring(0, Math.min(500, jsonResponse.length())));
        }
    }

    /**
     * Call Ollama with a raw prompt (no translation formatting).
     */
    private String callOllamaRaw(String prompt) throws IOException {
        String jsonBody = "{\"model\": \"llama3\", \"prompt\": " + escapeJsonString(prompt) + ", \"stream\": false}";

        URL url = new URL(OLLAMA_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(120000);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
        }

        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            InputStream errorStream = conn.getErrorStream();
            String error = errorStream != null ? new String(errorStream.readAllBytes(), StandardCharsets.UTF_8)
                    : "Unknown error";
            throw new IOException("Ollama returned " + responseCode + ": " + error);
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }

            String jsonResponse = response.toString();
            String result = extractJsonField(jsonResponse, "response");
            return result != null ? fixUnicodeEscapes(result) : "";
        }
    }

    /**
     * Fix common Unicode escape sequences that appear in text.
     */
    private String fixUnicodeEscapes(String text) {
        if (text == null)
            return "";
        // Replace common Unicode escapes
        return text
                .replace("u0026", "&")
                .replace("\\u0026", "&")
                .replace("u003c", "<")
                .replace("\\u003c", "<")
                .replace("u003e", ">")
                .replace("\\u003e", ">")
                .replace("u0027", "'")
                .replace("\\u0027", "'")
                .replace("u0022", "\"")
                .replace("\\u0022", "\"");
    }

    /**
     * Extract a string field from JSON without using regex (to avoid catastrophic
     * backtracking).
     */
    private String extractJsonField(String json, String fieldName) {
        String searchKey = "\"" + fieldName + "\":";
        int keyIndex = json.indexOf(searchKey);
        if (keyIndex == -1) {
            searchKey = "\"" + fieldName + "\" :";
            keyIndex = json.indexOf(searchKey);
        }
        if (keyIndex == -1)
            return null;

        int valueStart = json.indexOf("\"", keyIndex + searchKey.length());
        if (valueStart == -1)
            return null;
        valueStart++; // Move past the opening quote

        StringBuilder sb = new StringBuilder();
        boolean escaped = false;
        for (int i = valueStart; i < json.length(); i++) {
            char c = json.charAt(i);
            if (escaped) {
                switch (c) {
                    case 'n':
                        sb.append('\n');
                        break;
                    case 'r':
                        sb.append('\r');
                        break;
                    case 't':
                        sb.append('\t');
                        break;
                    case '"':
                        sb.append('"');
                        break;
                    case '\\':
                        sb.append('\\');
                        break;
                    default:
                        sb.append(c);
                }
                escaped = false;
            } else if (c == '\\') {
                escaped = true;
            } else if (c == '"') {
                // End of string
                return sb.toString();
            } else {
                sb.append(c);
            }
        }
        return null;
    }

    private String getLanguageName(String code) {
        switch (code.toLowerCase()) {
            case "en":
                return "English";
            case "sv":
                return "Swedish";
            case "de":
                return "German";
            case "fr":
                return "French";
            case "es":
                return "Spanish";
            case "it":
                return "Italian";
            case "nl":
                return "Dutch";
            case "pl":
                return "Polish";
            case "pt":
                return "Portuguese";
            case "fi":
                return "Finnish";
            case "da":
                return "Danish";
            case "no":
                return "Norwegian";
            default:
                return "English";
        }
    }

    /**
     * Properly escape a string for JSON encoding.
     */
    private String escapeJsonString(String s) {
        if (s == null)
            return "null";
        StringBuilder sb = new StringBuilder();
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\b':
                    sb.append("\\b");
                    break;
                case '\f':
                    sb.append("\\f");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                default:
                    if (c < ' ') {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
        return sb.toString();
    }

    /**
     * Clean text of control characters that can't be rendered by standard PDF
     * fonts.
     */
    private String cleanTextForPdf(String text) {
        if (text == null)
            return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            // Keep printable ASCII, newlines, tabs, and common extended characters
            if (c == '\n' || c == '\t' || (c >= 32 && c < 127) || (c >= 160 && c <= 255)) {
                sb.append(c);
            } else if (c == '\r') {
                // Skip carriage returns (CR) - they cause encoding errors
                continue;
            } else if (c >= 256) {
                // Replace non-Latin characters with placeholder
                sb.append('?');
            }
            // Skip other control characters
        }
        return sb.toString();
    }

    private byte[] createPdfFromText(String text) throws IOException {
        // Clean text of control characters that fonts can't render
        text = cleanTextForPdf(text);

        try (PDDocument doc = new PDDocument()) {
            PDType1Font font = PDType1Font.HELVETICA;
            float fontSize = 12;
            float margin = 50;
            float leading = 1.5f * fontSize;

            PDRectangle pageSize = PDRectangle.A4;
            float width = pageSize.getWidth() - 2 * margin;

            String[] lines = text.split("\n");

            PDPage currentPage = new PDPage(pageSize);
            doc.addPage(currentPage);
            PDPageContentStream contentStream = new PDPageContentStream(doc, currentPage);
            contentStream.beginText();
            contentStream.setFont(font, fontSize);
            contentStream.setLeading(leading);
            contentStream.newLineAtOffset(margin, pageSize.getHeight() - margin);

            float currentY = pageSize.getHeight() - margin;

            for (String line : lines) {
                // Word wrap
                String[] words = line.split(" ");
                StringBuilder currentLine = new StringBuilder();

                for (String word : words) {
                    String testLine = currentLine.length() > 0 ? currentLine + " " + word : word;
                    float textWidth = font.getStringWidth(testLine) / 1000 * fontSize;

                    if (textWidth > width && currentLine.length() > 0) {
                        // Write current line and start new one
                        writeLine(contentStream, currentLine.toString(), font);
                        currentY -= leading;

                        // Check if we need a new page
                        if (currentY < margin + leading) {
                            contentStream.endText();
                            contentStream.close();

                            currentPage = new PDPage(pageSize);
                            doc.addPage(currentPage);
                            contentStream = new PDPageContentStream(doc, currentPage);
                            contentStream.beginText();
                            contentStream.setFont(font, fontSize);
                            contentStream.setLeading(leading);
                            contentStream.newLineAtOffset(margin, pageSize.getHeight() - margin);
                            currentY = pageSize.getHeight() - margin;
                        }

                        currentLine = new StringBuilder(word);
                    } else {
                        currentLine = new StringBuilder(testLine);
                    }
                }

                // Write remaining text in line
                if (currentLine.length() > 0) {
                    writeLine(contentStream, currentLine.toString(), font);
                    currentY -= leading;
                }

                // Check if we need a new page
                if (currentY < margin + leading) {
                    contentStream.endText();
                    contentStream.close();

                    currentPage = new PDPage(pageSize);
                    doc.addPage(currentPage);
                    contentStream = new PDPageContentStream(doc, currentPage);
                    contentStream.beginText();
                    contentStream.setFont(font, fontSize);
                    contentStream.setLeading(leading);
                    contentStream.newLineAtOffset(margin, pageSize.getHeight() - margin);
                    currentY = pageSize.getHeight() - margin;
                }
            }

            contentStream.endText();
            contentStream.close();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        }
    }

    private void writeLine(PDPageContentStream contentStream, String text, PDType1Font font) throws IOException {
        // Filter out characters not supported by Helvetica
        StringBuilder filtered = new StringBuilder();
        for (char c : text.toCharArray()) {
            try {
                font.encode(String.valueOf(c));
                filtered.append(c);
            } catch (Exception e) {
                filtered.append('?');
            }
        }
        contentStream.showText(filtered.toString());
        contentStream.newLine();
    }

    private ResponseEntity<byte[]> badRequest(String message) {
        return ResponseEntity.badRequest()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
                .body(message.getBytes(StandardCharsets.UTF_8));
    }

    private ResponseEntity<byte[]> serverError(String message) {
        return ResponseEntity.internalServerError()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
                .body(message.getBytes(StandardCharsets.UTF_8));
    }
}
