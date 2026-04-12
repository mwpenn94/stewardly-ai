/**
 * Estate — tRPC router.
 *
 * Shipped by Pass 7 of the hybrid build loop — PARITY-ESTATE-0001.
 *
 * Thin wrapper over the pure estate document parser in
 * `server/services/estate/documentParser.ts`. All parsing happens in
 * the pure module so tests run offline; this router only validates
 * the payload and returns the result.
 *
 * Access: `protectedProcedure` because document text often contains
 * PII (names, specific bequest details).
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  parseEstateDocument,
  renderEstateMarkdown,
} from "../services/estate/documentParser";

export const estateRouter = router({
  /**
   * Pure offline document parser — no LLM, no OCR. Accepts a plain
   * text document (caller is responsible for OCR'ing first) and
   * returns structured {testators, executors, trustees, beneficiaries,
   * specificBequests, guardians, governingState, warnings} plus a
   * rendered markdown summary.
   */
  parseDocumentOffline: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(200_000),
      }),
    )
    .query(({ input }) => {
      const parsed = parseEstateDocument(input.text);
      const markdown = renderEstateMarkdown(parsed);
      return { parsed, markdown };
    }),
});
