const { ensureSchema, hasPostgresConfig, query } = require("../db/postgres.cjs");

const TABLES = [
  "sessions",
  "users",
  "groups",
  "session_users",
  "programs",
  "program_days",
  "program_events",
  "diary_entries",
  "surveys",
  "survey_questions",
  "organizer_workspaces",
];

async function main() {
  if (!hasPostgresConfig()) {
    throw new Error("PostgreSQL is not configured. Fill .env first.");
  }

  await ensureSchema();

  for (const tableName of TABLES) {
    const result = await query(`select count(*)::int as count from ${tableName}`);
    console.log(`${tableName}: ${result.rows[0].count}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
