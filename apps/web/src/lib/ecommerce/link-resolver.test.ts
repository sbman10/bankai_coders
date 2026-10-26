import { describe, expect, it } from "vitest";
import {
  resolveProductLink,
  InvalidMarketplaceUrlError,
  MarketplaceAccessError,
  PageRetrievalError,
} from "./link-resolver";

const SAMPLE_AMAZON_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>soundcore by Anker Q20i Hybrid Active Noise Cancelling Headphones</title>
</head>
<body>
  <span id="productTitle">soundcore by Anker Q20i Hybrid Active Noise Cancelling Headphones</span>
  <div id="bylineInfo_feature_div">
    <a id="bylineInfo" href="/stores/Soundcore">Visit the Soundcore Store</a>
  </div>
  <div id="apex_desktop">
    <span class="a-price a-text-price a-size-medium apexPriceToPay">
      <span class="a-offscreen">₹4,499</span>
      <span class="a-price-whole">4,499<span class="a-price-decimal">.</span></span>
    </span>
    <span class="a-price a-text-price" data-a-strike="true"><span class="a-offscreen">₹7,999</span></span>
  </div>
  <div id="merchant-info">
    Sold by <a id="sellerProfileTriggerId">ANKER OFFICIAL</a> and Delivered by Amazon.
  </div>
  <div id="wayfinding-breadcrumbs_feature_div">
    <ul class="a-unordered-list a-horizontal a-size-small">
      <li><a class="a-link-normal a-color-tertiary" href="#">Electronics</a></li>
      <li><a class="a-link-normal a-color-tertiary" href="#">Headphones</a></li>
      <li><a class="a-link-normal a-color-tertiary" href="#">Over-Ear</a></li>
    </ul>
  </div>
  <table id="productDetails_techSpec_section_1">
    <tr><th>Brand Name</th><td>Soundcore</td></tr>
    <tr><th>Model Name</th><td>Soundcore Q20i</td></tr>
    <tr><th>Model Number</th><td>A3004</td></tr>
    <tr><th>Warranty Description</th><td>1 Year Manufacturer Warranty</td></tr>
  </table>
  <script type="text/javascript">
    var data = {
      'colorImages': {
        'initial': [
          {
            "hiRes": "https://m.media-amazon.com/images/I/61RealPhotoHighRes._SL1500_.jpg",
            "thumb": "https://m.media-amazon.com/images/I/thumb.jpg",
            "large": "https://m.media-amazon.com/images/I/large.jpg"
          }
        ]
      }
    };
  </script>
</body>
</html>
`;

const SAMPLE_AMAZON_MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<body>
  <span id="productTitle">Simple Phone Cover</span>
  <span class="a-price-whole">299</span>
  <img id="landingImage" src="https://m.media-amazon.com/images/I/phonecover.jpg" />
</body>
</html>
`;

const SAMPLE_FLIPKART_HTML = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "boAt Airdopes 131 Bluetooth Headset",
      "image": [
        "https://rukmini1.flixcart.com/image/1500/1500/headphone/boat-131-main.png"
      ],
      "brand": {
        "@type": "Brand",
        "name": "boAt"
      },
      "category": "headphone",
      "offers": {
        "@type": "Offer",
        "price": 1199,
        "priceCurrency": "INR"
      }
    }
  ]
  </script>
</head>
<body>
  <div class="_1RLviY">
    <span>RetailNet</span>
  </div>
  <table>
    <tr><td>Model Name</td><td>Airdopes 131</td></tr>
    <tr><td>Domestic Warranty</td><td>1 Year Domestic Warranty</td></tr>
  </table>
</body>
</html>
`;

const SAMPLE_MEESHO_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Classic Men Cotton T-Shirt" />
  <meta property="og:image" content="https://images.meesho.com/images/products/12345/main.jpg" />
</head>
<body>
  <h1>Classic Men Cotton T-Shirt</h1>
  <div class="price">₹349</div>
  <script id="__NEXT_DATA__" type="application/json">
  {
    "props": {
      "pageProps": {
        "data": {
          "name": "Classic Men Cotton T-Shirt",
          "discountedPrice": 349,
          "supplier_name": "Fashion Hub",
          "images": ["https://images.meesho.com/images/products/12345/main.jpg"]
        }
      }
    }
  }
  </script>
</body>
</html>
`;

describe("resolveProductLink — Platform-Aware Accurate Extractor", () => {
  it("rejects invalid or unsupported URLs with exact error message", async () => {
    await expect(resolveProductLink("https://not-supported.com/product/123")).rejects.toThrow(
      "Please enter a valid Amazon, Flipkart or Meesho product URL."
    );
    await expect(resolveProductLink("not-a-url")).rejects.toThrow(
      "Please enter a valid Amazon, Flipkart or Meesho product URL."
    );
    await expect(resolveProductLink("")).rejects.toThrow(
      "Please enter a valid Amazon, Flipkart or Meesho product URL."
    );
  });

  it("extracts Amazon product data accurately without hallucination", async () => {
    const url = "https://www.amazon.in/dp/B0CKW4D336";
    const res = await resolveProductLink(url, { htmlOverride: SAMPLE_AMAZON_HTML });

    expect(res.platform).toBe("Amazon");
    expect(res.productUrl).toBe(url);
    expect(res.productName).toBe("soundcore by Anker Q20i Hybrid Active Noise Cancelling Headphones");
    expect(res.brand).toBe("Soundcore");
    expect(res.model).toBe("A3004");
    expect(res.seller).toBe("ANKER OFFICIAL");
    expect(res.currentPrice).toEqual({ amount: 4499, currency: "INR" });
    expect(res.warrantyDuration).toBe("1 Year Manufacturer Warranty");
    expect(res.category).toBe("Over-Ear");
    expect(res.primaryImage).toBe("https://m.media-amazon.com/images/I/61RealPhotoHighRes._SL1500_.jpg");

    expect(res.extractionStatus.productName).toBe("found");
    expect(res.extractionStatus.brand).toBe("found");
    expect(res.extractionStatus.model).toBe("found");
    expect(res.extractionStatus.seller).toBe("found");
    expect(res.extractionStatus.currentPrice).toBe("found");
    expect(res.extractionStatus.warrantyDuration).toBe("found");
    expect(res.extractionStatus.category).toBe("found");
    expect(res.extractionStatus.primaryImage).toBe("found");
  });

  it("leaves unavailable Amazon fields as null and not_found (no fake defaults)", async () => {
    const url = "https://www.amazon.in/dp/B0XYZ999";
    const res = await resolveProductLink(url, { htmlOverride: SAMPLE_AMAZON_MINIMAL_HTML });

    expect(res.platform).toBe("Amazon");
    expect(res.productName).toBe("Simple Phone Cover");
    expect(res.brand).toBeNull();
    expect(res.model).toBeNull();
    expect(res.seller).toBeNull();
    expect(res.warrantyDuration).toBeNull();
    expect(res.category).toBeNull();
    expect(res.currentPrice).toEqual({ amount: 299, currency: "INR" });
    expect(res.primaryImage).toBe("https://m.media-amazon.com/images/I/phonecover.jpg");

    expect(res.extractionStatus.brand).toBe("not_found");
    expect(res.extractionStatus.model).toBe("not_found");
    expect(res.extractionStatus.seller).toBe("not_found");
    expect(res.extractionStatus.warrantyDuration).toBe("not_found");
    expect(res.extractionStatus.category).toBe("not_found");
  });

  it("extracts Flipkart product data accurately from Schema.org and page elements", async () => {
    const url = "https://www.flipkart.com/boat-airdopes-131-bluetooth-headset/p/itmd92edd315d970";
    const res = await resolveProductLink(url, { htmlOverride: SAMPLE_FLIPKART_HTML });

    expect(res.platform).toBe("Flipkart");
    expect(res.productName).toBe("boAt Airdopes 131 Bluetooth Headset");
    expect(res.brand).toBe("boAt");
    expect(res.model).toBe("Airdopes 131");
    expect(res.seller).toBe("RetailNet");
    expect(res.currentPrice).toEqual({ amount: 1199, currency: "INR" });
    expect(res.warrantyDuration).toBe("1 Year Domestic Warranty");
    expect(res.category).toBe("headphone");
    expect(res.primaryImage).toBe("https://rukmini1.flixcart.com/image/1500/1500/headphone/boat-131-main.png");
  });

  it("extracts modern Flipkart layout with nonce script attributes, state specs, and high-res images", async () => {
    const modernHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <script type="application/ld+json" nonce="8137790759844882113" id="jsonLD">
      [{
        "name": "realme P1 5G (Phoenix Red, 128 GB)",
        "brand": { "name": "realme", "@type": "Brand" },
        "category": "mobile",
        "offers": { "price": 13999, "priceCurrency": "INR" },
        "image": ["https://rukminim2.flixcart.com/image/300/300/xif0q/mobile/y/9/0/-original-imahyuhfg2z4fvyh.jpeg"]
      }]
      </script>
      <script nonce="8137790759844882113">
      window.__INITIAL_STATE__ = {
        "multiWidgetState": {
          "widgetsData": {
            "slots": [
              {
                "data": { "seller": "Seller: BTPLD" }
              }
            ]
          }
        }
      };
      // Model and warranty text inside state
      window.__INITIAL_STATE__.specs = {
        "item": {
          "Model Number": { "text": ["P1 5G"] },
          "warranty": "1 Year Manufacturer Warranty for Device and 6 Months Manufacturer Warranty for Inbox Accessories"
        }
      };
      </script>
    </head>
    <body>
    </body>
    </html>
    `;

    const url = "https://www.flipkart.com/realme-p1-5g-phoenix-red-128-gb/p/itmae4447062b5b5";
    const res = await resolveProductLink(url, { htmlOverride: modernHtml });

    expect(res.platform).toBe("Flipkart");
    expect(res.productName).toBe("realme P1 5G (Phoenix Red, 128 GB)");
    expect(res.brand).toBe("realme");
    expect(res.model).toBe("P1 5G");
    expect(res.seller).toBe("BTPLD");
    expect(res.currentPrice).toEqual({ amount: 13999, currency: "INR" });
    expect(res.warrantyDuration).toBe("1 Year Manufacturer Warranty for Device and 6 Months Manufacturer Warranty for Inbox Accessories");
    expect(res.category).toBe("mobile");
    expect(res.primaryImage).toBe("https://rukminim2.flixcart.com/image/1500/1500/xif0q/mobile/y/9/0/-original-imahyuhfg2z4fvyh.jpeg");
  });

  it("extracts Meesho product details from SSR payload", async () => {
    const url = "https://www.meesho.com/s/p/dmlqa";
    const res = await resolveProductLink(url, { htmlOverride: SAMPLE_MEESHO_HTML });

    expect(res.platform).toBe("Meesho");
    expect(res.productName).toBe("Classic Men Cotton T-Shirt");
    expect(res.currentPrice).toEqual({ amount: 349, currency: "INR" });
    expect(res.seller).toBe("Fashion Hub");
    expect(res.brand).toBeNull();
    expect(res.model).toBeNull();
    expect(res.warrantyDuration).toBeNull();
    expect(res.primaryImage).toBe("https://images.meesho.com/images/products/12345/main.jpg");
  });

  it("throws MarketplaceAccessError when marketplace returns 403 anti-bot restriction", async () => {
    const mockFetch = async () => new Response("Access Denied", { status: 403 });
    const url = "https://www.meesho.com/s/p/blocked";
    await expect(resolveProductLink(url, { fetchImpl: mockFetch as unknown as typeof fetch })).rejects.toThrow(
      "This marketplace page couldn't be accessed automatically. You can enter the product details manually."
    );
  });

  it("throws PageRetrievalError when product page is not found or fails to load", async () => {
    const mockFetch = async () => new Response("Not Found", { status: 404 });
    const url = "https://www.amazon.in/dp/B0NONEXIST";
    await expect(resolveProductLink(url, { fetchImpl: mockFetch as unknown as typeof fetch })).rejects.toThrow(
      "We couldn't retrieve this product page. Please check the URL or enter the product details manually."
    );
  });

  it("filters out logos, placeholders, and tracking pixels from images", async () => {
    const htmlWithBadImages = `
      <span id="productTitle">Product with Logo</span>
      <img src="https://m.media-amazon.com/images/G/01/gno/sprites/nav-sprite-global-1x-hm-dsk-reorg._CB405937547_.png" />
      <img src="https://images.meesho.com/images/marketing/meesho-logo.png" />
      <img src="https://images-eu.ssl-images-amazon.com/images/G/31/x-locale/common/transparent-pixel.jpg" />
      <img id="landingImage" src="https://m.media-amazon.com/images/I/valid-main-photo.jpg" />
    `;
    const res = await resolveProductLink("https://www.amazon.in/dp/B0REAL", { htmlOverride: htmlWithBadImages });
    expect(res.primaryImage).toBe("https://m.media-amazon.com/images/I/valid-main-photo.jpg");
    expect(res.additionalImages).not.toContain(expect.stringContaining("sprite"));
    expect(res.additionalImages).not.toContain(expect.stringContaining("logo"));
    expect(res.additionalImages).not.toContain(expect.stringContaining("transparent-pixel"));
  });

  it("handles URLs entered without https:// scheme and amzn.in shortlinks", async () => {
    const resNoScheme = await resolveProductLink("amazon.in/dp/B0REAL", {
      htmlOverride: '<span id="productTitle">Item Without Scheme</span>',
    });
    expect(resNoScheme.platform).toBe("Amazon");
    expect(resNoScheme.productName).toBe("Item Without Scheme");

    const resAmzn = await resolveProductLink("https://amzn.in/d/bZ8Y7jA", {
      htmlOverride: '<link rel="canonical" href="https://www.amazon.in/dp/B0C3HCD34R" /><span id="productTitle">Shared Item</span>',
    });
    expect(resAmzn.platform).toBe("Amazon");
    expect(resAmzn.asin).toBe("B0C3HCD34R");
    expect(resAmzn.productName).toBe("Shared Item");
  });
});
