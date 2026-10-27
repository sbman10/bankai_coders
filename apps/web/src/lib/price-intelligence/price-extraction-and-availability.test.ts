import { describe, it, expect } from "vitest";
import { AmazonAdapter } from "../platforms/amazon-adapter";
import { AvailabilityValidator } from "./availability-validator";

describe("Strict Price & Availability Extraction", () => {
  const adapter = new AmazonAdapter();
  const validator = new AvailabilityValidator();

  it("extracts ACTUAL selling price and MRP, filtering out EMI, bank offers, and delivery fees", () => {
    // Simulated Amazon page snippet with selling price, MRP, EMI, and bank offers
    const htmlSnippet = `
      <div id="corePriceDisplay_desktop_feature_div">
        <span class="a-price a-text-price a-size-medium apexPriceToPay">
          <span class="a-offscreen">₹18,999.00</span>
        </span>
        <span class="a-price a-text-price a-size-base" data-a-strike="true">
          <span class="a-offscreen">₹24,999.00</span>
        </span>
      </div>
      <div id="bankOffers">
        <span>Save up to ₹1,000 with Bank Offer</span>
      </div>
      <div id="emiDetails">
        <span>EMI starts at ₹1,583/month</span>
      </div>
      <div id="deliveryMessage">
        <span>+ ₹40 delivery fee</span>
      </div>
    `;

    const priceInfo = adapter.extractPrice({ html: htmlSnippet, markdown: "" });
    expect(priceInfo).not.toBeNull();
    expect(priceInfo?.current).toBe(18999);
    expect(priceInfo?.mrp).toBe(24999);
    expect(priceInfo?.discount_percent).toBe(24);
    // CRITICAL: Must NEVER be EMI (1583) or Bank offer (1000)
    expect(priceInfo?.current).not.toBe(1583);
    expect(priceInfo?.current).not.toBe(1000);
    expect(priceInfo?.current).not.toBe(40);
  });

  it("identifies IN_STOCK when positive purchase buttons or in-stock status exist", () => {
    const htmlWithCart = `
      <div id="availability">
        <span class="a-size-medium a-color-success">In stock.</span>
      </div>
      <input id="add-to-cart-button" name="submit.add-to-cart" type="submit" value="Add to Cart" />
      <input id="buy-now-button" name="submit.buy-now" type="submit" value="Buy Now" />
    `;

    const avail = adapter.extractAvailability({ html: htmlWithCart, markdown: "" });
    expect(avail.status).toBe("IN_STOCK");
    expect(avail.confidence).toBeGreaterThan(0.9);
    expect(validator.isPurchasable(avail.status)).toBe(true);
  });

  it("identifies OUT_OF_STOCK when explicitly marked 'Currently unavailable'", () => {
    const htmlOutOfStock = `
      <div id="availability">
        <span class="a-color-price a-text-bold">Currently unavailable.</span>
        <span>We don't know when or if this item will be back in stock.</span>
      </div>
    `;

    const avail = adapter.extractAvailability({ html: htmlOutOfStock, markdown: "" });
    expect(avail.status).toBe("OUT_OF_STOCK");
    expect(avail.confidence).toBeGreaterThan(0.9);
    expect(validator.isPurchasable(avail.status)).toBe(false);
  });

  it("identifies NOT_FOUND when page returns 404", () => {
    const avail = adapter.extractAvailability({
      html: "<h1>Looking for something? We're sorry.</h1>",
      markdown: "Page not found",
      statusCode: 404,
    });
    expect(avail.status).toBe("NOT_FOUND");
    expect(validator.isPurchasable(avail.status)).toBe(false);
  });

  it("identifies UNKNOWN when page has no purchase button or stock indicator, and NEVER marks it available", () => {
    const htmlAmbiguous = `
      <div>Product Description: An informative article about this device.</div>
    `;

    const avail = adapter.extractAvailability({ html: htmlAmbiguous, markdown: "" });
    expect(avail.status).toBe("UNKNOWN");
    expect(validator.isPurchasable(avail.status)).toBe(false);
  });
});
