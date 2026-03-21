/**
 * Task #33 — Product Disqualification Service
 * Evaluates products against user suitability dimensions,
 * auto-disqualifies unsuitable products with explanations.
 */
import { getDb } from "../db";
import { productSuitabilityEvaluations } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

interface SuitabilityDimension {
  name: string;
  userValue: number;
  productMin: number;
  productMax: number;
  weight: number;
}

export async function evaluateProductSuitability(
  productId: number,
  userId: number,
  dimensions: SuitabilityDimension[]
): Promise<{
  id: number;
  score: number;
  status: "qualified" | "marginal" | "disqualified" | "needs_review";
  qualifying: string[];
  disqualifying: string[];
}> {
  const qualifying: string[] = [];
  const disqualifying: string[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    totalWeight += dim.weight;
    if (dim.userValue >= dim.productMin && dim.userValue <= dim.productMax) {
      qualifying.push(dim.name);
      totalScore += dim.weight;
    } else {
      disqualifying.push(dim.name);
    }
  }

  const score = totalWeight > 0 ? totalScore / totalWeight : 0;
  let status: "qualified" | "marginal" | "disqualified" | "needs_review" = "qualified";
  if (score < 0.4) status = "disqualified";
  else if (score < 0.7) status = "marginal";
  else if (disqualifying.length > 0) status = "needs_review";

  const db = (await getDb())!;
  const [result] = await db.insert(productSuitabilityEvaluations).values({
    productId,
    userId,
    suitabilityScore: score,
    qualifyingDimensions: qualifying,
    disqualifyingDimensions: disqualifying,
    status,
  }).$returningId();

  return { id: result.id, score, status, qualifying, disqualifying };
}

export async function getProductEvaluations(userId: number) {
  const db = (await getDb())!;
  return db.select().from(productSuitabilityEvaluations)
    .where(eq(productSuitabilityEvaluations.userId, userId))
    .orderBy(desc(productSuitabilityEvaluations.evaluationDate));
}
