/**
 * Attorney Ratings — Aggregated attorney rating verification
 * ToS-GATED: Aggregates from Martindale-Hubbell, Super Lawyers, etc.
 * Scraping these sources requires individual ToS review.
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "attorneyRatings" });

export interface AttorneyRating {
  source: string;
  rating?: string;
  peerReview?: string;
  clientReview?: number;
  available: boolean;
  lookupUrl: string;
}

export interface AttorneyRatingsResult {
  name: string;
  ratings: AttorneyRating[];
  status: "tos_blocked";
  message: string;
}

const RATING_SOURCES: Omit<AttorneyRating, "rating" | "peerReview" | "clientReview">[] = [
  { source: "Martindale-Hubbell", available: false, lookupUrl: "https://www.martindale.com/find-attorneys/" },
  { source: "Super Lawyers", available: false, lookupUrl: "https://www.superlawyers.com/" },
  { source: "Best Lawyers", available: false, lookupUrl: "https://www.bestlawyers.com/" },
  { source: "Avvo", available: false, lookupUrl: "https://www.avvo.com/" },
];

export async function getAttorneyRatings(name: string): Promise<AttorneyRatingsResult> {
  log.info({ name: name.slice(0, 3) + "***" }, "Attorney ratings requested (ToS-gated)");

  return {
    name,
    ratings: RATING_SOURCES.map((s) => ({ ...s })),
    status: "tos_blocked",
    message: "Attorney rating aggregation requires individual ToS review for each source. " +
      "Manual lookups available at the URLs provided for each rating source.",
  };
}

export function getRatingSources(): string[] {
  return RATING_SOURCES.map((s) => s.source);
}
