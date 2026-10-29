import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import * as imageSearch from "@/lib/ecommerce/image-search";

describe("GET /api/products/search-image", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when query parameter is missing or empty", async () => {
    const req = new Request("http://localhost:3000/api/products/search-image");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Query parameter 'q' is required.");
  });

  it("returns 200 with found image url and title", async () => {
    vi.spyOn(imageSearch, "searchProductImage").mockResolvedValueOnce({
      imageUrl: "https://m.media-amazon.com/images/I/71cRONPYuVL._SL1500_.jpg",
      title: "Kobo Dumbbell Pad",
      source: "retail_search",
    });

    const req = new Request("http://localhost:3000/api/products/search-image?q=adjustable+dumbbell+pad");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.imageUrl).toBe("https://m.media-amazon.com/images/I/71cRONPYuVL._SL1500_.jpg");
  });

  it("returns 200 with imageUrl null if no image was found", async () => {
    vi.spyOn(imageSearch, "searchProductImage").mockResolvedValueOnce(null);

    const req = new Request("http://localhost:3000/api/products/search-image?q=xyzobscureproduct");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.imageUrl).toBeNull();
  });
});

