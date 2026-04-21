const { ensureSchema, hasPostgresConfig } = require("../db/postgres.cjs");

async function main() {
  if (!hasPostgresConfig()) {
    throw new Error("PostgreSQL is not configured. Fill .env first.");
  }

  await ensureSchema();
  console.log("[db:schema] Schema is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
