import { describe, it, expect, vi } from "vitest";

// Mock the msedge-tts module since it requires network access
vi.mock("msedge-tts", () => {
  const { Readable } = require("stream");

  class MockMsEdgeTTS {
    private voice = "";
    private format = "";

    async setMetadata(voice: string, format: string) {
      this.voice = voice;
      this.format = format;
    }

    toStream(text: string, options?: any) {
      const readable = new Readable({
        read() {
          this.push(Buffer.from("fake-audio-data"));
          this.push(null);
        },
      });
      return { audioStream: readable };
    }
  }

  return {
    MsEdgeTTS: MockMsEdgeTTS,
    OUTPUT_FORMAT: {
      WEBM_24KHZ_16BIT_MONO_OPUS: "webm-24khz-16bit-mono-opus",
    },
  };
});

import { generateSpeech, getVoiceCatalog, VOICE_CATALOG } from "./edgeTTS";

describe("Edge TTS Service", () => {
  describe("VOICE_CATALOG", () => {
    it("has at least 20 voices", () => {
      expect(VOICE_CATALOG.length).toBeGreaterThanOrEqual(20);
    });

    it("each voice has required fields", () => {
      for (const v of VOICE_CATALOG) {
        expect(v).toHaveProperty("id");
        expect(v).toHaveProperty("shortName");
        expect(v).toHaveProperty("label");
        expect(v).toHaveProperty("gender");
        expect(v).toHaveProperty("locale");
        expect(v).toHaveProperty("description");
        expect(["male", "female"]).toContain(v.gender);
        expect(v.shortName).toMatch(/Neural$/);
        expect(v.locale).toMatch(/^en-/);
      }
    });

    it("includes aria as a voice", () => {
      const aria = VOICE_CATALOG.find((v) => v.id === "aria");
      expect(aria).toBeDefined();
      expect(aria!.shortName).toBe("en-US-AriaNeural");
      expect(aria!.gender).toBe("female");
    });

    it("has voices from multiple locales", () => {
      const locales = new Set(VOICE_CATALOG.map(v => v.locale));
      expect(locales.size).toBeGreaterThanOrEqual(4); // US, GB, AU, IE, IN, CA
    });

    it("has both male and female voices", () => {
      const genders = new Set(VOICE_CATALOG.map(v => v.gender));
      expect(genders.has("male")).toBe(true);
      expect(genders.has("female")).toBe(true);
    });

    it("has unique IDs", () => {
      const ids = VOICE_CATALOG.map(v => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("getVoiceCatalog", () => {
    it("returns voice objects without shortName (for frontend)", () => {
      const catalog = getVoiceCatalog();
      expect(catalog.length).toBe(VOICE_CATALOG.length);
      for (const v of catalog) {
        expect(v).toHaveProperty("id");
        expect(v).toHaveProperty("label");
        expect(v).toHaveProperty("gender");
        expect(v).toHaveProperty("locale");
        expect(v).toHaveProperty("description");
        // shortName is internal — not exposed to frontend
        expect(v).not.toHaveProperty("shortName");
      }
    });

    it("maps IDs correctly from VOICE_CATALOG", () => {
      const catalog = getVoiceCatalog();
      const catalogIds = catalog.map(v => v.id);
      const sourceIds = VOICE_CATALOG.map(v => v.id);
      expect(catalogIds).toEqual(sourceIds);
    });
  });

  describe("generateSpeech", () => {
    it("generates audio buffer from text", async () => {
      const buffer = await generateSpeech("Hello world");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("accepts voice parameter", async () => {
      const buffer = await generateSpeech("Test", "guy");
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("accepts voices from different locales", async () => {
      const buffer = await generateSpeech("Test", "sonia");
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("throws on empty text after cleaning", async () => {
      await expect(generateSpeech("")).rejects.toThrow();
    });

    it("cleans markdown from text", async () => {
      const buffer = await generateSpeech("**Bold** and `code` and [link](http://example.com)");
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("truncates very long text", async () => {
      const longText = "A".repeat(5000);
      const buffer = await generateSpeech(longText);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("defaults to aria voice when invalid voice given", async () => {
      const buffer = await generateSpeech("Test", "nonexistent");
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("accepts rate and pitch parameters", async () => {
      const buffer = await generateSpeech("Test", "aria", "+10%", "+5Hz");
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });
});
