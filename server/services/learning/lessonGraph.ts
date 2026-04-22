/**
 * P1-2: Lesson Graph + Mastery Gating Service
 *
 * Implements a DAG (directed acyclic graph) of chapter prerequisites.
 * Chapters can depend on other chapters with a minimum mastery score threshold.
 * Users can only access chapters whose prerequisites they've met.
 */
import { getDb } from "../../db";
import { chapterPrerequisites, learningChapters, learningMasteryProgress } from "../../../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────

export interface ChapterNode {
  chapterId: number;
  title: string;
  trackId: number;
  sortOrder: number;
  prerequisites: { chapterId: number; title: string; minMasteryScore: number }[];
  isUnlocked: boolean;
  currentMastery: number;
}

export interface LessonGraphResult {
  chapters: ChapterNode[];
  unlockedCount: number;
  lockedCount: number;
  totalCount: number;
}

// ─── Core Functions ──────────────────────────────────────────────────────

/**
 * Get the full lesson graph for a track, with unlock status per user.
 */
export async function getLessonGraph(userId: number, trackId: number): Promise<LessonGraphResult> {
  const db = (await getDb())!;
  // 1. Get all chapters in this track
  const chapters = await db
    .select()
    .from(learningChapters)
    .where(and(eq(learningChapters.trackId, trackId), eq(learningChapters.status, "published")))
    .orderBy(learningChapters.sortOrder);

  if (chapters.length === 0) {
    return { chapters: [], unlockedCount: 0, lockedCount: 0, totalCount: 0 };
  }

  const chapterIds = chapters.map((c) => c.id);

  // 2. Get all prerequisites for these chapters
  const prereqs = chapterIds.length > 0
    ? await db!
        .select()
        .from(chapterPrerequisites)
        .where(inArray(chapterPrerequisites.chapterId, chapterIds))
    : [];

  // 3. Get user mastery for all chapters (using chapter-level mastery)
  const masteryRows = await db!
    .select({
      itemKey: learningMasteryProgress.itemKey,
      confidence: learningMasteryProgress.confidence,
    })
    .from(learningMasteryProgress)
    .where(eq(learningMasteryProgress.userId, userId));

  // Build mastery lookup: chapter_id -> confidence
  const masteryMap = new Map<number, number>();
  for (const row of masteryRows) {
    // itemKey format: "chapter:123" or "flashcard:456"
    if (row.itemKey.startsWith("chapter:")) {
      const id = parseInt(row.itemKey.split(":")[1], 10);
      if (!isNaN(id)) masteryMap.set(id, row.confidence);
    }
  }

  // Build prerequisite lookup
  const prereqMap = new Map<number, typeof prereqs>();
  for (const p of prereqs) {
    const list = prereqMap.get(p.chapterId) || [];
    list.push(p);
    prereqMap.set(p.chapterId, list);
  }

  // Chapter title lookup
  const titleMap = new Map<number, string>();
  for (const c of chapters) titleMap.set(c.id, c.title);

  // 4. Compute unlock status for each chapter
  const nodes: ChapterNode[] = chapters.map((ch) => {
    const chPrereqs = prereqMap.get(ch.id) || [];
    const prerequisites = chPrereqs.map((p) => ({
      chapterId: p.prerequisiteChapterId,
      title: titleMap.get(p.prerequisiteChapterId) || `Chapter ${p.prerequisiteChapterId}`,
      minMasteryScore: p.minMasteryScore,
    }));

    // A chapter is unlocked if ALL prerequisites are met
    const isUnlocked = chPrereqs.every((p) => {
      const userMastery = masteryMap.get(p.prerequisiteChapterId) || 0;
      return userMastery >= p.minMasteryScore;
    });

    const currentMastery = masteryMap.get(ch.id) || 0;

    return {
      chapterId: ch.id,
      title: ch.title,
      trackId: ch.trackId,
      sortOrder: ch.sortOrder,
      prerequisites,
      isUnlocked,
      currentMastery,
    };
  });

  const unlockedCount = nodes.filter((n) => n.isUnlocked).length;
  const lockedCount = nodes.filter((n) => !n.isUnlocked).length;

  return {
    chapters: nodes,
    unlockedCount,
    lockedCount,
    totalCount: nodes.length,
  };
}

/**
 * Check if a specific chapter is unlocked for a user.
 */
export async function isChapterUnlocked(userId: number, chapterId: number): Promise<boolean> {
  const db = (await getDb())!;
  const prereqs = await db!
    .select()
    .from(chapterPrerequisites)
    .where(eq(chapterPrerequisites.chapterId, chapterId));

  if (prereqs.length === 0) return true; // No prerequisites = always unlocked

  for (const p of prereqs) {
    const mastery = await db!
      .select({ confidence: learningMasteryProgress.confidence })
      .from(learningMasteryProgress)
      .where(
        and(
          eq(learningMasteryProgress.userId, userId),
          eq(learningMasteryProgress.itemKey, `chapter:${p.prerequisiteChapterId}`),
        ),
      );

    const userMastery = mastery[0]?.confidence || 0;
    if (userMastery < p.minMasteryScore) return false;
  }

  return true;
}

/**
 * Add a prerequisite relationship between chapters.
 */
export async function addPrerequisite(
  chapterId: number,
  prerequisiteChapterId: number,
  minMasteryScore = 0.7,
): Promise<void> {
  const db = (await getDb())!;
  // Validate no circular dependency
  const wouldCreateCycle = await detectCycle(prerequisiteChapterId, chapterId);
  if (wouldCreateCycle) {
    throw new Error(`Adding prerequisite would create a circular dependency: ${prerequisiteChapterId} -> ${chapterId}`);
  }

  await db!.insert(chapterPrerequisites).values({
    chapterId,
    prerequisiteChapterId,
    minMasteryScore,
  });
}

/**
 * Remove a prerequisite relationship.
 */
export async function removePrerequisite(chapterId: number, prerequisiteChapterId: number): Promise<void> {
  const db = (await getDb())!;
  await db!
    .delete(chapterPrerequisites)
    .where(
      and(
        eq(chapterPrerequisites.chapterId, chapterId),
        eq(chapterPrerequisites.prerequisiteChapterId, prerequisiteChapterId),
      ),
    );
}

/**
 * Detect if adding an edge from `from` to `to` would create a cycle.
 * Uses BFS from `to` to see if we can reach `from`.
 */
async function detectCycle(from: number, to: number): Promise<boolean> {
  const db = (await getDb())!;
  const visited = new Set<number>();
  const queue = [to];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === from) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await db!
      .select({ prereqId: chapterPrerequisites.prerequisiteChapterId })
      .from(chapterPrerequisites)
      .where(eq(chapterPrerequisites.chapterId, current));

    for (const d of deps) queue.push(d.prereqId);
  }

  return false;
}

/**
 * Get all chapters that are immediately unlockable (user is close to meeting prereqs).
 */
export async function getNextUnlockable(userId: number, trackId: number): Promise<ChapterNode[]> {
  const graph = await getLessonGraph(userId, trackId);
  return graph.chapters.filter((ch) => {
    if (ch.isUnlocked) return false;
    // Check if user is within 80% of meeting all prereqs
    return ch.prerequisites.every((p) => {
      const prereqNode = graph.chapters.find((n) => n.chapterId === p.chapterId);
      return (prereqNode?.currentMastery || 0) >= p.minMasteryScore * 0.8;
    });
  });
}
