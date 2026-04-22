const dotenv = require("dotenv");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");

dotenv.config();

let pool;

function hasPostgresConfig() {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.PGHOST ||
      process.env.PGUSER ||
      process.env.PGDATABASE,
  );
}

function shouldUseSsl() {
  const value = String(process.env.PGSSL || "").toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "require";
}

function getPool() {
  if (!hasPostgresConfig()) {
    return null;
  }

  if (!pool) {
    const ssl = shouldUseSsl() ? { rejectUnauthorized: false } : false;

    pool = process.env.DATABASE_URL
      ? new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl,
        })
      : new Pool({
          host: process.env.PGHOST,
          port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
          database: process.env.PGDATABASE,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          ssl,
        });
  }

  return pool;
}

async function query(text, params = []) {
  const activePool = getPool();

  if (!activePool) {
    throw new Error("PostgreSQL is not configured");
  }

  return activePool.query(text, params);
}

async function ensureSchema() {
  if (!hasPostgresConfig()) {
    return false;
  }

  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf8");
  await query(schema);

  return true;
}

async function resetSchema() {
  if (!hasPostgresConfig()) {
    return false;
  }

  await query(`
    drop table if exists
      auth_magic_links,
      auth_sessions,
      audit_log,
      ai_reports,
      curator_notes,
      risk_signals,
      comment_cluster_items,
      comment_clusters,
      typology_assignments,
      trajectory_metrics,
      survey_answers,
      survey_responses,
      survey_publications,
      survey_questions,
      surveys,
      daily_reflections,
      diary_entries,
      event_tags,
      program_events,
      program_days,
      programs,
      speakers,
      state_scale_levels,
      session_users,
      groups,
      users,
      sessions,
      organizer_workspaces
    cascade;
  `);

  await ensureSchema();
  return true;
}

module.exports = {
  ensureSchema,
  getPool,
  hasPostgresConfig,
  query,
  resetSchema,
};
