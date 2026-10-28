import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { createClient } from "@/lib/supabase/server";
import { prototypeStore, type PrototypePriceObservation } from "@/lib/store/prototype-store";
import type { SupportedStorePlatform, AvailabilityStatus } from "../platforms/platform.types";

export interface PriceObservationRecord {
  id: string;
  user_id: string;
  price_watch_id: string | null;
  product_id: string | null;
  platform: SupportedStorePlatform | string;
  product_url: string;
  title: string | null;
  price: number;
  mrp: number | null;
  currency: string;
  availability: AvailabilityStatus;
  availability_evidence: string | null;
  seller: string | null;
  match_confidence: number | null;
  observed_at: string;
}

export interface RecordObservationInput {
  priceWatchId?: string | null;
  productId?: string | null;
  platform: SupportedStorePlatform | string;
  productUrl: string;
  title: string | null;
  price: number;
  mrp?: number | null;
  currency?: string;
  availability: AvailabilityStatus;
  availabilityEvidence?: string | null;
  seller?: string | null;
  matchConfidence?: number | null;
}

export interface PriceWatchStatsUpdate {
  current_price?: number;
  lowest_recorded_price?: number;
  median_recorded_price?: number;
  highest_recorded_price?: number;
  last_alerted_price?: number;
  last_alerted_at?: string;
  last_alerted_platform?: string;
  last_checked_at?: string;
}

export class PriceObservationStore {
  /**
   * Records a verified price observation in Supabase or PrototypeStore.
   */
  async recordObservation(input: RecordObservationInput, userId?: string): Promise<PriceObservationRecord> {
    if (
      input.price === null ||
      input.price === undefined ||
      typeof input.price !== "number" ||
      Number.isNaN(input.price) ||
      !Number.isFinite(input.price) ||
      input.price <= 0
    ) {
      throw new Error(`Invalid price observation: Price must be a positive number, got ${input.price}`);
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const effectiveUserId = userId || (await supabase.auth.getUser()).data.user?.id;
        if (!effectiveUserId) {
          throw new Error("User must be authenticated to record price observations in Supabase.");
        }

        const insertPayload = {
          user_id: effectiveUserId,
          price_watch_id: input.priceWatchId || null,
          product_id: input.productId || null,
          platform: input.platform,
          product_url: input.productUrl,
          title: input.title,
          price: input.price,
          mrp: input.mrp || null,
          currency: input.currency || "INR",
          availability: input.availability,
          availability_evidence: input.availabilityEvidence || null,
          seller: input.seller || null,
          match_confidence: input.matchConfidence || null,
        };

        const { data, error } = await supabase.from("price_observations").insert(insertPayload).select().single();
        if (error) {
          throw error;
        }
        return data as PriceObservationRecord;
      } catch {
        // Fallback to prototype store if database query fails or during prototype run
      }
    }

    const prototypeObs = prototypeStore.recordPriceObservation({
      priceWatchId: input.priceWatchId,
      productId: input.productId,
      platform: input.platform,
      productUrl: input.productUrl,
      title: input.title,
      price: input.price,
      currency: input.currency,
      mrp: input.mrp,
      availability: input.availability,
      availabilityEvidence: input.availabilityEvidence,
      seller: input.seller,
      matchConfidence: input.matchConfidence,
    });

    return prototypeObs as PriceObservationRecord;
  }

  /**
   * Retrieves recorded price observations for a given watch or product.
   */
  async getObservations(
    filter: { priceWatchId?: string; productId?: string },
    userId?: string
  ): Promise<PriceObservationRecord[]> {
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        let query = supabase.from("price_observations").select("*").order("observed_at", { ascending: false });

        if (filter.priceWatchId) {
          query = query.eq("price_watch_id", filter.priceWatchId);
        }
        if (filter.productId) {
          query = query.eq("product_id", filter.productId);
        }
        if (userId) {
          query = query.eq("user_id", userId);
        }

        const { data, error } = await query.limit(100);
        if (!error && data) {
          return data as PriceObservationRecord[];
        }
      } catch {
        // Fallback to prototype store
      }
    }

    const list = prototypeStore.getPriceObservations(filter);
    return list as PriceObservationRecord[];
  }

  /**
   * Updates price watch statistics (lowest, median, highest, last_checked_at)
   */
  async updateWatchStats(watchId: string, updates: PriceWatchStatsUpdate): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        await supabase.from("price_watches").update(updates).eq("id", watchId);
        return;
      } catch {
        // Fallback
      }
    }

    prototypeStore.updatePriceWatchStats(watchId, updates);
  }
}

export const defaultPriceObservationStore = new PriceObservationStore();
