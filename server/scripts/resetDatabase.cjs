const { hasPostgresConfig, resetSchema } = require("../db/postgres.cjs");

async function main() {
  if (!hasPostgresConfig()) {
    throw new Error("PostgreSQL is not configured. Fill .env first.");
  }

  await resetSchema();
  console.log("[db:reset] Database schema was reset.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
