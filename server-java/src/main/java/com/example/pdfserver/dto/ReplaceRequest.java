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
  }

  public static class BBox {
    public float x;
    public float y;
    public float width;
    public float height;
  }
}






