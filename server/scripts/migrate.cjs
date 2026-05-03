"use strict";

require("dotenv").config();
const path = require("path");

const direction = process.argv[2] || "up";
const count = process.argv[3] ? Number(process.argv[3]) : undefined;

if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  console.error("[migrate] No database config found. Set DATABASE_URL or PGHOST in .env");
  process.exit(1);
}

// node-pg-migrate programmatic API
const migrate = require("node-pg-migrate").default;

migrate({
  databaseUrl: process.env.DATABASE_URL || {
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  },
  migrationsTable: "pgmigrations",
  dir: path.join(__dirname, "../migrations"),
  direction,
  count,
  verbose: true,
})
  .then(() => {
    console.log(`[migrate] ${direction} complete.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("[migrate] failed:", err.message);
    process.exit(1);
  });
