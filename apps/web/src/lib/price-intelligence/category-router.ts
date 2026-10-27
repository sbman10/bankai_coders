import type { SupportedStorePlatform } from "../platforms/platform.types";

export type ProductCategory =
  | "Mobiles & Tablets"
  | "Laptops & Computers"
  | "Audio & Headphones"
  | "Wearables & Watches"
  | "Televisions & Home Entertainment"
  | "Home Appliances"
  | "Beauty & Personal Care"
  | "Fashion & Apparel"
  | "Gaming"
  | "General Electronics"
  | "General";

export interface CategoryRoutingConfig {
  [category: string]: SupportedStorePlatform[];
}

export const DEFAULT_CATEGORY_ROUTING: CategoryRoutingConfig = {
  "Mobiles & Tablets": ["Amazon", "Flipkart", "Croma", "Meesho"],
  "Laptops & Computers": ["Amazon", "Flipkart", "Croma"],
  "Audio & Headphones": ["Amazon", "Flipkart", "Croma", "Meesho"],
  "Wearables & Watches": ["Amazon", "Flipkart", "Croma", "Myntra"],
  "Televisions & Home Entertainment": ["Amazon", "Flipkart", "Croma"],
  "Home Appliances": ["Amazon", "Flipkart", "Croma", "Meesho"],
  "Beauty & Personal Care": ["Amazon", "Flipkart", "Meesho", "Nykaa"],
  "Fashion & Apparel": ["Amazon", "Flipkart", "Meesho", "Myntra"],
  "Gaming": ["Amazon", "Flipkart", "Croma"],
  "General Electronics": ["Amazon", "Flipkart", "Croma", "Meesho"],
  "General": ["Amazon", "Flipkart", "Croma"],
};

export class CategoryRouter {
  private routing: CategoryRoutingConfig;

  constructor(customRouting?: CategoryRoutingConfig) {
    this.routing = customRouting || DEFAULT_CATEGORY_ROUTING;
  }

  /**
   * Infers the product category from title, breadcrumb, or specifications.
   */
  detectCategory(title: string, breadcrumb?: string | null): ProductCategory {
    const text = `${title} ${breadcrumb || ""}`.toLowerCase();

    // 1. Beauty & Personal Care
    if (
      /\b(shampoo|conditioner|face\s*wash|serum|cream|moisturizer|lotion|sunscreen|lipstick|perfume|cologne|makeup|skincare|haircare)\b/i.test(
        text
      )
    ) {
      return "Beauty & Personal Care";
    }

    // 2. Fashion & Apparel
    if (
      /\b(t-shirt|shirt|jeans|trousers|dress|shoes|sneakers|kurta|saree|jacket|hoodie|clothing|apparel|footwear|night\s*suit|nightsuit|sleepwear|nightdress|pajama|pyjama|suit|pants|topwear|bottomwear)\b/i.test(
        text
      )
    ) {
      return "Fashion & Apparel";
    }

    // 3. Laptops & Computers
    if (/\b(laptop|macbook|notebook|desktop|pc|thinkpad|ideapad|chromebook|all-in-one\s*pc)\b/i.test(text)) {
      return "Laptops & Computers";
    }

    // 4. Mobiles & Tablets
    if (
      /\b(smartphone|smartphones|mobile|mobiles|mobile\s*phone|phone|phones|5g|4g|iphone|galaxy\s*s\d+|ipad|tablet|tab|cellular)\b/i.test(
        text
      )
    ) {
      return "Mobiles & Tablets";
    }

    // 5. Audio & Headphones
    if (
      /\b(headphone|headphones|earphone|earphones|earbuds|airpods|tws|neckband|bluetooth\s*speaker|soundbar)\b/i.test(
        text
      )
    ) {
      return "Audio & Headphones";
    }

    // 6. Wearables & Smartwatches
    if (/\b(smartwatch|smart\s*watch|fitness\s*band|smart\s*band|apple\s*watch)\b/i.test(text)) {
      return "Wearables & Watches";
    }

    // 7. Televisions
    if (/\b(smart\s*tv|television|oled\s*tv|qled\s*tv|4k\s*tv|led\s*tv)\b/i.test(text)) {
      return "Televisions & Home Entertainment";
    }

    // 8. Appliances
    if (
      /\b(refrigerator|fridge|washing\s*machine|microwave|air\s*conditioner|ac|water\s*purifier|vacuum|front\s*load|top\s*load|swirl\s*wash|dish\s*washer|dishwasher)\b/i.test(
        text
      )
    ) {
      return "Home Appliances";
    }

    // 9. Gaming
    if (/\b(playstation|ps5|ps4|xbox|nintendo|gaming\s*console|controller|gamepad)\b/i.test(text)) {
      return "Gaming";
    }

    // 10. General electronics
    if (/\b(charger|cable|power\s*bank|adapter|router|monitor|keyboard|mouse)\b/i.test(text)) {
      return "General Electronics";
    }

    return "General";
  }

  /**
   * Returns the list of relevant platforms to search for this product category,
   * avoiding wasted queries to irrelevant platforms.
   */
  getRelevantPlatforms(category: ProductCategory, excludePlatform?: SupportedStorePlatform): SupportedStorePlatform[] {
    const list = this.routing[category] || this.routing["General"];
    if (!excludePlatform) {
      return [...list];
    }
    return list.filter((p) => p !== excludePlatform);
  }
}

export const defaultCategoryRouter = new CategoryRouter();
