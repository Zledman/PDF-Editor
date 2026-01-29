package com.example.pdfserver.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@RestController
@CrossOrigin(origins = "*")
public class CompressController {

  @PostMapping(value = "/compress-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<byte[]> compressPdf(
      @RequestPart("file") MultipartFile file,
      @RequestParam(name = "preset", defaultValue = "ebook") String preset
  ) {
    if (file == null || file.isEmpty()) {
      return ResponseEntity.badRequest()
          .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
          .body("No file uploaded".getBytes(StandardCharsets.UTF_8));
    }

    // Ghostscript PDFSETTINGS presets:
    // /screen (smallest), /ebook, /printer, /prepress (highest quality)
    final String pdfSettings = switch ((preset == null ? "" : preset).toLowerCase()) {
      case "screen" -> "/screen";
      case "printer" -> "/printer";
      case "prepress" -> "/prepress";
      default -> "/ebook";
    };

    Path in;
    Path out;
    try {
      in = Files.createTempFile("compress-in-", ".pdf");
      out = Files.createTempFile("compress-out-", ".pdf");
    } catch (IOException e) {
      return ResponseEntity.internalServerError()
          .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
          .body(("Could not create temp files: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
    }

    try {
      Files.write(in, file.getBytes());

      // On Windows, Ghostscript console executable is typically "gswin64c.exe".
      // Set env var PDF_GS_PATH to an absolute path to avoid PATH issues.
      String gs = System.getenv().getOrDefault("PDF_GS_PATH", "gswin64c");

      List<String> cmd = new ArrayList<>();
      cmd.add(gs);
      cmd.add("-sDEVICE=pdfwrite");
      cmd.add("-dCompatibilityLevel=1.4");
      cmd.add("-dNOPAUSE");
      cmd.add("-dQUIET");
      cmd.add("-dBATCH");
      cmd.add("-dSAFER");
      cmd.add("-dDetectDuplicateImages=true");
      cmd.add("-dCompressFonts=true");
      cmd.add("-dPDFSETTINGS=" + pdfSettings);
      cmd.add("-sOutputFile=" + out.toAbsolutePath());
      cmd.add(in.toAbsolutePath().toString());

      Process p;
      try {
        p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
      } catch (IOException e) {
        String hint = "Ghostscript not found. Install Ghostscript and/or set PDF_GS_PATH (e.g. to gswin64c.exe).";
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
            .body("Compress interrupted".getBytes(StandardCharsets.UTF_8));
      }

      if (code != 0) {
        String log = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        return ResponseEntity.internalServerError()
            .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
            .body(("Ghostscript failed (" + code + "):\n" + log).getBytes(StandardCharsets.UTF_8));
      }

      byte[] outBytes = Files.readAllBytes(out);
      return ResponseEntity.ok()
          .header(HttpHeaders.CONTENT_TYPE, "application/pdf")
          .body(outBytes);
    } catch (IOException e) {
      return ResponseEntity.internalServerError()
          .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_PLAIN_VALUE)
          .body(("Compress failed: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
    } finally {
      try {
        Files.deleteIfExists(in);
      } catch (Exception ignored) {
      }
      try {
        Files.deleteIfExists(out);
      } catch (Exception ignored) {
      }
    }
  }
}


