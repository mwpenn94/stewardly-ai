/**
 * Alert Threshold Configuration Tests
 * Verifies that sync lag thresholds are set to reasonable values (not the old 30/50 defaults)
 * and that the notification cooldown is properly configured.
 */
import { describe, it, expect } from "vitest";
import mysql from "mysql2/promise";

const TIMEOUT = 15_000;

describe("Alert Threshold Configuration", () => {
  it("sync_lag_minutes thresholds should be >= 120/480 (not old 30/50 defaults)", async () => {
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [rows] = await conn.execute(
        "SELECT * FROM location_alert_thresholds WHERE metric_name = 'sync_lag_minutes'"
      );
      const thresholds = rows as any[];
      
      for (const t of thresholds) {
        // Warning should be at least 120 minutes (was 30)
        expect(t.warning_threshold).toBeGreaterThanOrEqual(120);
        // Critical should be at least 480 minutes (was 50)
        expect(t.critical_threshold).toBeGreaterThanOrEqual(480);
        // Critical must be > warning
        expect(t.critical_threshold).toBeGreaterThan(t.warning_threshold);
      }
    } finally {
      await conn.end();
    }
  }, TIMEOUT);

  it("location_alert_thresholds table should have last_notified_at column for DB-backed cooldown", async () => {
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [cols] = await conn.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'location_alert_thresholds' AND COLUMN_NAME = 'last_notified_at'"
      );
      expect((cols as any[]).length).toBe(1);
    } finally {
      await conn.end();
    }
  }, TIMEOUT);

  it("no threshold should have absurdly low values (< 1 for sync_lag_minutes)", async () => {
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [rows] = await conn.execute(
        "SELECT * FROM location_alert_thresholds WHERE metric_name = 'sync_lag_minutes' AND (warning_threshold < 1 OR critical_threshold < 1)"
      );
      expect((rows as any[]).length).toBe(0);
    } finally {
      await conn.end();
    }
  }, TIMEOUT);

  it("data_freshness_hours thresholds should be reasonable (warning >= 2, critical >= 6)", async () => {
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [rows] = await conn.execute(
        "SELECT * FROM location_alert_thresholds WHERE metric_name = 'data_freshness_hours'"
      );
      for (const t of (rows as any[])) {
        expect(t.warning_threshold).toBeGreaterThanOrEqual(2);
        expect(t.critical_threshold).toBeGreaterThanOrEqual(6);
      }
    } finally {
      await conn.end();
    }
  }, TIMEOUT);
});
