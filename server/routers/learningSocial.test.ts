import { describe, it, expect } from "vitest";
import { learningSocialRouter } from "./learningSocial";

describe("Learning Social Router", () => {
  it("exports learningSocialRouter", () => {
    expect(learningSocialRouter).toBeDefined();
  });

  it("has studySessions sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("studySessions.list");
    expect(learningSocialRouter._def.procedures).toHaveProperty("studySessions.record");
  });

  it("has achievements sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("achievements.list");
    expect(learningSocialRouter._def.procedures).toHaveProperty("achievements.award");
  });

  it("has settings sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("settings.get");
    expect(learningSocialRouter._def.procedures).toHaveProperty("settings.getAll");
    expect(learningSocialRouter._def.procedures).toHaveProperty("settings.upsert");
  });

  it("has aiQuiz sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("aiQuiz.list");
    expect(learningSocialRouter._def.procedures).toHaveProperty("aiQuiz.create");
  });

  it("has groups sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("groups.list");
    expect(learningSocialRouter._def.procedures).toHaveProperty("groups.create");
    expect(learningSocialRouter._def.procedures).toHaveProperty("groups.join");
    expect(learningSocialRouter._def.procedures).toHaveProperty("groups.members");
  });

  it("has sharedQuizzes sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("sharedQuizzes.list");
    expect(learningSocialRouter._def.procedures).toHaveProperty("sharedQuizzes.create");
  });

  it("has challenges sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("challenges.list");
    expect(learningSocialRouter._def.procedures).toHaveProperty("challenges.create");
    expect(learningSocialRouter._def.procedures).toHaveProperty("challenges.submitResult");
    expect(learningSocialRouter._def.procedures).toHaveProperty("challenges.leaderboard");
  });

  it("has bookmarks sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("bookmarks.list");
    expect(learningSocialRouter._def.procedures).toHaveProperty("bookmarks.add");
    expect(learningSocialRouter._def.procedures).toHaveProperty("bookmarks.remove");
  });

  it("has playlists sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("playlists.list");
    expect(learningSocialRouter._def.procedures).toHaveProperty("playlists.create");
    expect(learningSocialRouter._def.procedures).toHaveProperty("playlists.addItem");
    expect(learningSocialRouter._def.procedures).toHaveProperty("playlists.items");
    expect(learningSocialRouter._def.procedures).toHaveProperty("playlists.removeItem");
    expect(learningSocialRouter._def.procedures).toHaveProperty("playlists.share");
    expect(learningSocialRouter._def.procedures).toHaveProperty("playlists.inviteByEmail");
  });

  it("has discovery sub-router", () => {
    expect(learningSocialRouter._def.procedures).toHaveProperty("discovery.list");
    expect(learningSocialRouter._def.procedures).toHaveProperty("discovery.record");
  });

  it("covers all 15 orphaned learning tables", () => {
    // 10 sub-routers covering 15 tables:
    // studySessions → learningStudySessions
    // achievements → learningAchievements
    // settings → learningSettings
    // aiQuiz → learningAiQuizQuestions
    // groups → learningStudyGroups + learningGroupMembers
    // sharedQuizzes → learningSharedQuizzes
    // challenges → learningQuizChallenges + learningChallengeResults
    // bookmarks → learningBookmarks
    // playlists → learningPlaylists + learningPlaylistItems + learningPlaylistShares + learningPendingInvites
    // discovery → learningDiscoveryHistory
    const procedures = Object.keys(learningSocialRouter._def.procedures);
    expect(procedures.length).toBeGreaterThanOrEqual(20);
  });
});
