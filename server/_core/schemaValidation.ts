/**
 * Startup Schema Validation
 * 
 * Compares the Drizzle schema column definitions against the actual database
 * columns at server boot. Logs warnings for any mismatches so they surface
 * before runtime INSERT/SELECT errors.
 * 
 * Handles the dual naming convention: Drizzle schema defines SQL column names
 * as snake_case (e.g., "user_id"), but some tables were created with camelCase
 * column names (e.g., "userId"). The validator checks both variants.
 * 
 * Non-blocking: validation failures are logged as warnings, not thrown.
 * The server still starts even if mismatches are found.
 */

import { logger } from "./logger";

interface SchemaTable {
  tableName: string;
  columns: string[];
}

/**
 * Convert snake_case to camelCase.
 * e.g., "user_id" → "userId", "agent_instance_id" → "agentInstanceId"
 */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Extract table→column mappings from the Drizzle schema file.
 * Parses the TypeScript source to find mysqlTable() declarations
 * and their column name strings.
 */
function parseSchemaFile(schemaContent: string): SchemaTable[] {
  const tables: SchemaTable[] = [];

  // Match: export const X = mysqlTable("table_name", { ...columns... })
  const tableRegex = /export\s+const\s+\w+\s*=\s*mysqlTable\(\s*["']([^"']+)["']\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;

  let match;
  while ((match = tableRegex.exec(schemaContent)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];

    // Match column declarations: propName: type("dbColumnName", ...)
    // Includes all Drizzle column types + the mysqlBoolean alias
    const colRegex = /\w+\s*:\s*(?:int|varchar|text|boolean|mysqlEnum|json|float|double|bigint|timestamp|datetime|decimal|date|mysqlBoolean)\s*\(\s*["']([^"']+)["']/g;
    const columns: string[] = [];
    let colMatch;
    while ((colMatch = colRegex.exec(columnsBlock)) !== null) {
      columns.push(colMatch[1]);
    }

    if (columns.length > 0) {
      tables.push({ tableName, columns });
    }
  }

  return tables;
}

/**
 * Validate the database schema against the Drizzle schema definitions.
 * Called once at server startup. Logs warnings for mismatches.
 */
export async function validateDatabaseSchema(): Promise<void> {
  const startTime = Date.now();

  try {
    // Dynamic imports to avoid circular dependencies
    const fs = await import("fs");
    const path = await import("path");
    const mysql = await import("mysql2/promise");

    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      logger.warn({ operation: "schemaValidation" }, "DATABASE_URL not set — skipping schema validation");
      return;
    }

    // Read the Drizzle schema file
    const schemaPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../drizzle/schema.ts");
    if (!fs.existsSync(schemaPath)) {
      logger.warn({ operation: "schemaValidation" }, "drizzle/schema.ts not found — skipping schema validation");
      return;
    }

    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const schemaTables = parseSchemaFile(schemaContent);

    // Connect to the database
    const url = new URL(DATABASE_URL);
    const conn = await mysql.createConnection({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      ssl: { rejectUnauthorized: false },
      connectTimeout: 5000,
    });

    const dbName = url.pathname.slice(1);

    // Get all actual DB columns
    const [rows] = await conn.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [dbName]
    );

    // Group by table
    const dbTableCols: Record<string, Set<string>> = {};
    for (const row of rows as any[]) {
      if (!dbTableCols[row.TABLE_NAME]) dbTableCols[row.TABLE_NAME] = new Set();
      dbTableCols[row.TABLE_NAME].add(row.COLUMN_NAME);
    }

    // Compare — check both snake_case and camelCase variants
    let missingTables = 0;
    let missingColumns = 0;
    let camelCaseMatches = 0;
    const issues: string[] = [];

    for (const { tableName, columns } of schemaTables) {
      const dbCols = dbTableCols[tableName];

      if (!dbCols) {
        missingTables++;
        issues.push(`Table "${tableName}" defined in schema but missing from database`);
        continue;
      }

      for (const col of columns) {
        const camelVariant = snakeToCamel(col);
        if (dbCols.has(col)) {
          // Exact match — fine
        } else if (col !== camelVariant && dbCols.has(camelVariant)) {
          // camelCase match — column exists with different naming convention
          // This is expected for tables created before snake_case standardization
          camelCaseMatches++;
        } else {
          // Truly missing
          missingColumns++;
          issues.push(`Column "${tableName}.${col}" defined in schema but missing from database`);
        }
      }
    }

    await conn.end();

    const durationMs = Date.now() - startTime;

    if (issues.length === 0) {
      const msg = camelCaseMatches > 0
        ? `Schema validation passed — ${schemaTables.length} tables verified in ${durationMs}ms (${camelCaseMatches} columns matched via camelCase convention)`
        : `Schema validation passed — ${schemaTables.length} tables verified in ${durationMs}ms`;
      logger.info(
        {
          operation: "schemaValidation",
          tablesChecked: schemaTables.length,
          camelCaseMatches,
          durationMs,
        },
        msg
      );
    } else {
      logger.warn(
        {
          operation: "schemaValidation",
          missingTables,
          missingColumns,
          camelCaseMatches,
          totalIssues: issues.length,
          durationMs,
          issues: issues.slice(0, 20), // cap at 20 to avoid log flooding
        },
        `Schema validation found ${issues.length} issue(s) — ${missingTables} missing table(s), ${missingColumns} missing column(s). ${camelCaseMatches} columns matched via camelCase convention. Run migrations to fix.`
      );

      // Log first 10 issues individually for visibility
      for (const issue of issues.slice(0, 10)) {
        logger.warn({ operation: "schemaValidation" }, `  → ${issue}`);
      }
      if (issues.length > 10) {
        logger.warn(
          { operation: "schemaValidation" },
          `  ... and ${issues.length - 10} more issue(s). Check full list in structured log.`
        );
      }
    }
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logger.error(
      {
        operation: "schemaValidation",
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      },
      `Schema validation failed after ${durationMs}ms — ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
