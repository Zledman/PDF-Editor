package com.example.pdfserver.dto;

import java.util.List;

public class ReplaceRequest {
  public List<Replacement> replacements;

  public static class Replacement {
    public int page; // 1-based
    public BBox bbox;
    public String text;
    public String font;
    public float size;
    public String color; // "#RRGGBB"
    public String bgColor; // "rgb(r,g,b)" or "#RRGGBB" — background color for whiteout rect
    // Y (top-left-system, samma som bbox) för en ramlinje strax under texten.
    // Whiteout-rektangeln får inte nå nedanför denna. null = ingen linje uppmätt.
    public Float maskBottom;
  }

  public static class BBox {
    public float x;
    public float y;
    public float width;
    public float height;
  }
}






