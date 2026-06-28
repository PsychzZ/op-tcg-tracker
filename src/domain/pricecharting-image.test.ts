import { describe, it, expect } from "vitest";
import { extractPcImageUrl, resizePcImage } from "./pricecharting-image";

const html = `<div><img src="https://www.pricecharting.com/x/images.pricecharting.com/cgkhlc2svnn5bl6r/120.jpg"></div>`;

describe("extractPcImageUrl", () => {
  it("extracts the product image as a full GCS URL at the requested size", () => {
    expect(extractPcImageUrl(html)).toBe(
      "https://commondatastorage.googleapis.com/images.pricecharting.com/cgkhlc2svnn5bl6r/1600.jpg",
    );
    expect(extractPcImageUrl(html, 320)).toBe(
      "https://commondatastorage.googleapis.com/images.pricecharting.com/cgkhlc2svnn5bl6r/320.jpg",
    );
  });
  it("returns null when no image is present", () => {
    expect(extractPcImageUrl("<div>no image</div>")).toBeNull();
  });
});

describe("resizePcImage", () => {
  const url = "https://commondatastorage.googleapis.com/images.pricecharting.com/cgkhlc2svnn5bl6r/1600.jpg";
  it("swaps the size segment of a PriceCharting URL", () => {
    expect(resizePcImage(url, 320)).toBe(
      "https://commondatastorage.googleapis.com/images.pricecharting.com/cgkhlc2svnn5bl6r/320.jpg",
    );
  });
  it("leaves non-PriceCharting URLs unchanged and handles null", () => {
    expect(resizePcImage("/api/card-image/OP09-004", 320)).toBe("/api/card-image/OP09-004");
    expect(resizePcImage(null, 320)).toBeNull();
  });
});
