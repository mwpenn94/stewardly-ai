/**
 * Financial Data Service — Barrel Export
 *
 * Pass 121: Central entry point for the financial data adapter system.
 */

export * from "./types";
export * from "./registry";
export { parsePfmCsv } from "./pfmParser/csvParser";
