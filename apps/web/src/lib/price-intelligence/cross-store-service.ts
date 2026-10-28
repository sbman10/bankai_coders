import { defaultFirecrawlClient, type FirecrawlClient } from "../firecrawl/firecrawl-client";
import { amazonAdapter, AmazonAdapter } from "../platforms/amazon-adapter";
import { flipkartAdapter, FlipkartAdapter } from "../platforms/flipkart-adapter";
import { cromaAdapter, CromaAdapter } from "../platforms/croma-adapter";
import { meeshoAdapter, MeeshoAdapter } from "../platforms/meesho-adapter";
import { defaultCategoryRouter, type ProductCategory } from "./category-router";
import { defaultProductMatcher, type MatchResult } from "./product-matcher";
import { defaultAvailabilityValidator } from "./availability-validator";
import {
  defaultPriceComparisonEngine,
  type PriceComparisonSummary,
} from "./comparison-engine";
import { defaultPriceObservationStore } from "./price-observation-store";
import {
  detectBrandFromTitle,
  extractModelFromTitle,
  extractVariantAttributes,
} from "./canonical-identity";
import {
  recordScraperDiagnostic,
  validateExtractedIdentityAgainstUrl,
} from "./scraper-diagnostics";
import type { PlatformAdapter } from "../platforms/platform-adapter.interface";
import type {
  CanonicalProductIdentity,
  NormalizedProductQuote,
  ScrapedContent,
  SupportedStorePlatform,
} from "../platforms/platform.types";

export interface CandidateEvaluationInput {
  platform: SupportedStorePlatform;
  url: string;
  rawContent: ScrapedContent;
  title?: string;
  brand?: string;
  model?: string;
  modelNumber?: string;
}

export interface CandidateEvaluationResult {
  quote: NormalizedProductQuote;
  matchResult: MatchResult;
  isEligibleForComparison: boolean;
}

export interface CrossStoreAnalysisResult {
  sourceUrl: string;
  canonicalIdentity: CanonicalProductIdentity;
  detectedCategory: ProductCategory;
  relevantPlatformsToSearch: SupportedStorePlatform[];
  suggestedCrossStoreSearchQuery: string;
  sourceQuote: NormalizedProductQuote;
  candidateEvaluations: CandidateEvaluationResult[];
  comparisonSummary: PriceComparisonSummary | null;
  cached: boolean;
  timestamp: string;
}

export class CrossStorePriceIntelligenceService {
  private firecrawlClient: FirecrawlClient;
  private amazonAdapter: AmazonAdapter;
  private flipkartAdapter: FlipkartAdapter;
  private cromaAdapter: CromaAdapter;
  private meeshoAdapter: MeeshoAdapter;

  constructor(
    firecrawlClient = defaultFirecrawlClient,
    amazonAdapterInstance = amazonAdapter,
    flipkartAdapterInstance = flipkartAdapter,
    cromaAdapterInstance = cromaAdapter,
    meeshoAdapterInstance = meeshoAdapter
  ) {
    this.firecrawlClient = firecrawlClient;
    this.amazonAdapter = amazonAdapterInstance;
    this.flipkartAdapter = flipkartAdapterInstance;
    this.cromaAdapter = cromaAdapterInstance;
    this.meeshoAdapter = meeshoAdapterInstance;
  }

  getAdapterForPlatform(platform: SupportedStorePlatform): PlatformAdapter {
    switch (platform) {
      case "Amazon":
        return this.amazonAdapter;
      case "Flipkart":
        return this.flipkartAdapter;
      case "Croma":
        return this.cromaAdapter;
      case "Meesho":
        return this.meeshoAdapter;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  getAdapterForUrl(url: string): PlatformAdapter {
    if (this.amazonAdapter.canHandle(url)) return this.amazonAdapter;
    if (this.flipkartAdapter.canHandle(url)) return this.flipkartAdapter;
    if (this.cromaAdapter.canHandle(url)) return this.cromaAdapter;
    if (this.meeshoAdapter.canHandle(url)) return this.meeshoAdapter;
    throw new Error("URL is not supported. Supported platforms: Amazon, Flipkart, Croma, Meesho.");
  }

  getDomainForPlatform(platform: SupportedStorePlatform): string {
    switch (platform) {
      case "Amazon":
        return "amazon.in";
      case "Flipkart":
        return "flipkart.com";
      case "Croma":
        return "croma.com";
      case "Meesho":
        return "meesho.com";
      default:
        return "amazon.in";
    }
  }

  /**
   * Performs end-to-end analysis of a product URL across Amazon, Flipkart, Croma, and Meesho.
   * 1. Scrapes URL with strict caching & credit conservation
   * 2. Extracts canonical product identity and validates against URL to prevent wrong product returns
   * 3. Detects category and routes to relevant store platforms
   * 4. Extracts strict actual selling price and availability
   * 5. Evaluates candidate cross-store products (manual candidates or automatic search)
   * 6. Calculates Lowest, Median Price, Highest comparison for VERIFIED stores only
   */
  async analyzeProductUrl(
    url: string,
    options: {
      forceRefresh?: boolean;
      targetPlatforms?: SupportedStorePlatform[];
      candidates?: CandidateEvaluationInput[];
      recordObservation?: boolean;
      priceWatchId?: string | null;
      productId?: string | null;
      timeoutMs?: number;
    } = {}
  ): Promise<CrossStoreAnalysisResult> {
    const sourceAdapter = this.getAdapterForUrl(url);

    // 1. Scrape through server-side Firecrawl with strict caching
    const scrapeRes = await this.firecrawlClient.scrapeUrl(url, {
      forceRefresh: options.forceRefresh,
      timeoutMs: options.timeoutMs,
    });

    const scrapedContent: ScrapedContent = {
      markdown: scrapeRes.markdown,
      html: scrapeRes.html,
      statusCode: scrapeRes.statusCode,
    };

    // 2. Canonical Product Identity & Price Extraction via source adapter
    const canonicalIdentity = sourceAdapter.extractCanonicalIdentity(scrapedContent, url);
    const sourceQuote = sourceAdapter.normalize(scrapedContent, url);

    // 3. Diagnostic Check: URL vs Extracted Identity Protection
    const identityCheck = validateExtractedIdentityAgainstUrl(url, canonicalIdentity, scrapedContent);
    if (!identityCheck.isValid) {
      recordScraperDiagnostic({
        platform: canonicalIdentity.platform,
        inputUrl: url,
        normalizedUrl: canonicalIdentity.sourceUrl,
        acquisitionSuccess: true,
        extractionSuccess: false,
        productIdentifier: canonicalIdentity.productIdentifier,
        brand: canonicalIdentity.brand,
        model: canonicalIdentity.model,
        price: sourceQuote.price?.current,
        availability: sourceQuote.availability.status,
        failureReason: identityCheck.failureReason || "WRONG_PRODUCT_RETURNED",
      });
      throw new Error(`Scraper validation failed: ${identityCheck.message || identityCheck.failureReason}`);
    }

    recordScraperDiagnostic({
      platform: canonicalIdentity.platform,
      inputUrl: url,
      normalizedUrl: canonicalIdentity.sourceUrl,
      acquisitionSuccess: true,
      extractionSuccess: true,
      productIdentifier: canonicalIdentity.productIdentifier,
      brand: canonicalIdentity.brand,
      model: canonicalIdentity.model,
      variant: canonicalIdentity.variant as Record<string, any>,
      price: sourceQuote.price?.current,
      availability: sourceQuote.availability.status,
      matchConfidence: 100,
    });

    // 4. Category Detection & Relevant Platform Routing
    const detectedCategory: ProductCategory =
      (canonicalIdentity.category as ProductCategory) ||
      defaultCategoryRouter.detectCategory(canonicalIdentity.cleanTitle);
    const relevantPlatformsToSearch = defaultCategoryRouter.getRelevantPlatforms(
      detectedCategory,
      canonicalIdentity.platform
    );

    // 5. Targeted Search Query for Cross-Store Discovery
    const suggestedCrossStoreSearchQuery = sourceAdapter.buildSearchQuery(canonicalIdentity);

    // 6. Evaluate Candidates
    const candidateEvaluations: CandidateEvaluationResult[] = [];
    const quotesForComparison: NormalizedProductQuote[] = [sourceQuote];

    if (options.candidates && options.candidates.length > 0) {
      for (const cand of options.candidates) {
        const candAdapter = this.getAdapterForPlatform(cand.platform);
        const availability = defaultAvailabilityValidator.validate(cand.rawContent);
        const price = candAdapter.extractPrice(cand.rawContent);

        const candVariant = extractVariantAttributes(
          cand.title || "",
          `${cand.rawContent.markdown} ${cand.rawContent.html || ""}`
        );

        const candIdentity = candAdapter.extractCanonicalIdentity(cand.rawContent, cand.url);
        const candBrand = cand.brand || candIdentity.brand || detectBrandFromTitle(cand.title || "");
        const candModel = cand.model || candIdentity.model || (candBrand ? extractModelFromTitle(cand.title || "", candBrand) : null);

        const candQuote: NormalizedProductQuote = {
          platform: cand.platform,
          productUrl: cand.url,
          title: cand.title || candIdentity.cleanTitle || "Candidate Product",
          brand: candBrand,
          model: candModel,
          variant: candVariant,
          price,
          availability,
          seller: null,
          imageUrl: null,
          scrapedAt: new Date().toISOString(),
          rawConfidence: availability.confidence,
        };

        const matchResult = defaultProductMatcher.evaluateMatch(canonicalIdentity, {
          title: candQuote.title,
          brand: candQuote.brand,
          model: candQuote.model,
          modelNumber: cand.modelNumber,
          category: detectedCategory,
          variant: candVariant,
        });

        // Strict: Only VERIFIED_MATCH (>=90%), IN_STOCK, and valid price are eligible
        const isEligible =
          matchResult.isMatch &&
          matchResult.confidenceScore >= 90 &&
          availability.status === "IN_STOCK" &&
          price !== null;

        candidateEvaluations.push({
          quote: candQuote,
          matchResult,
          isEligibleForComparison: isEligible,
        });

        if (isEligible) {
          quotesForComparison.push(candQuote);

          if (options.recordObservation) {
            await defaultPriceObservationStore.recordObservation({
              priceWatchId: options.priceWatchId,
              productId: options.productId,
              platform: candQuote.platform,
              productUrl: candQuote.productUrl,
              title: candQuote.title,
              price: candQuote.price!.current,
              mrp: candQuote.price!.mrp,
              currency: candQuote.price!.currency,
              availability: candQuote.availability.status,
              availabilityEvidence: candQuote.availability.evidence,
              seller: candQuote.seller,
              matchConfidence: matchResult.confidenceScore,
            });
          }
        }
      }
    } else {
      // Automatic Multi-Platform Cross-Store Discovery across the supported platforms (Amazon, Flipkart, Meesho)
      const supportedPlatforms: SupportedStorePlatform[] = options.targetPlatforms || [
        "Amazon",
        "Flipkart",
        "Meesho",
      ];
      const targetPlatforms = relevantPlatformsToSearch.filter(
        (p) => supportedPlatforms.includes(p) && p !== canonicalIdentity.platform
      );

      for (const targetPlatform of targetPlatforms) {
        const targetAdapter = this.getAdapterForPlatform(targetPlatform);
        const targetDomain = this.getDomainForPlatform(targetPlatform);

        const brand = canonicalIdentity.brand;
        const model = canonicalIdentity.model;
        const cleanModel =
          model && brand && model.toLowerCase().startsWith(brand.toLowerCase())
            ? model.slice(brand.length).trim()
            : model || "";

        const specParts = [
          brand,
          cleanModel,
          canonicalIdentity.variant.capacity,
          canonicalIdentity.variant.connectivity,
          canonicalIdentity.variant.appliance_type,
          canonicalIdentity.variant.ram,
          canonicalIdentity.variant.storage,
          canonicalIdentity.variant.size,
          canonicalIdentity.variant.volume_or_weight,
          canonicalIdentity.variant.pack_size && canonicalIdentity.variant.pack_size > 1
            ? `Pack of ${canonicalIdentity.variant.pack_size}`
            : null,
        ].filter(Boolean);

        const targetedQuery = `site:${targetDomain} ${specParts.join(" ")}`.trim();

        try {
          const searchRes = await this.firecrawlClient.search(targetedQuery, {
            limit: 2,
            forceRefresh: options.forceRefresh,
          });

          const validResults = searchRes.results.filter((r) => targetAdapter.canHandle(r.url));

          for (const candItem of validResults) {
            try {
              const candScrape = await this.firecrawlClient.scrapeUrl(candItem.url, {
                forceRefresh: options.forceRefresh,
                timeoutMs: options.timeoutMs,
              });

              const candContent: ScrapedContent = {
                markdown: candScrape.markdown,
                html: candScrape.html,
                statusCode: candScrape.statusCode,
              };

              const candQuote = targetAdapter.normalize(candContent, candItem.url);

              const matchResult = defaultProductMatcher.evaluateMatch(canonicalIdentity, {
                title: candQuote.title,
                brand: candQuote.brand,
                model: candQuote.model,
                category: detectedCategory,
                variant: candQuote.variant,
              });

              const isEligible =
                matchResult.isMatch &&
                matchResult.confidenceScore >= 90 &&
                candQuote.availability.status === "IN_STOCK" &&
                candQuote.price !== null;

              candidateEvaluations.push({
                quote: candQuote,
                matchResult,
                isEligibleForComparison: isEligible,
              });

              if (isEligible) {
                quotesForComparison.push(candQuote);

                if (options.recordObservation && candQuote.price) {
                  await defaultPriceObservationStore.recordObservation({
                    priceWatchId: options.priceWatchId,
                    productId: options.productId,
                    platform: candQuote.platform,
                    productUrl: candQuote.productUrl,
                    title: candQuote.title,
                    price: candQuote.price.current,
                    mrp: candQuote.price.mrp,
                    currency: candQuote.price.currency,
                    availability: candQuote.availability.status,
                    availabilityEvidence: candQuote.availability.evidence,
                    seller: candQuote.seller,
                    matchConfidence: matchResult.confidenceScore,
                  });
                }
              }
            } catch {
              // Non-fatal for individual candidate
            }
          }
        } catch {
          // Non-fatal if search service fails
        }
      }
    }

    // 7. Compare Prices
    const comparisonSummary = defaultPriceComparisonEngine.compare(quotesForComparison);

    // 8. Record Observation if requested and source price was found
    if (options.recordObservation && sourceQuote.price) {
      await defaultPriceObservationStore.recordObservation({
        priceWatchId: options.priceWatchId,
        productId: options.productId,
        platform: sourceQuote.platform,
        productUrl: sourceQuote.productUrl,
        title: sourceQuote.title,
        price: sourceQuote.price.current,
        mrp: sourceQuote.price.mrp,
        currency: sourceQuote.price.currency,
        availability: sourceQuote.availability.status,
        availabilityEvidence: sourceQuote.availability.evidence,
        seller: sourceQuote.seller,
        matchConfidence: 100, // source product itself is 100% match
      });
    }

    return {
      sourceUrl: url,
      canonicalIdentity,
      detectedCategory,
      relevantPlatformsToSearch,
      suggestedCrossStoreSearchQuery,
      sourceQuote,
      candidateEvaluations,
      comparisonSummary,
      cached: scrapeRes.cached,
      timestamp: new Date().toISOString(),
    };
  }
}

export const crossStoreService = new CrossStorePriceIntelligenceService();
