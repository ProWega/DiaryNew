"use strict";

const { readFileSync } = require("fs");
const { join } = require("path");

/** Initial migration: applies the full schema.sql idempotently. */
exports.up = async (pgm) => {
  const sql = readFileSync(join(__dirname, "../sql/schema.sql"), "utf8");
  await pgm.db.query(sql);
};

/** Down: drop every table in dependency order. */
exports.down = async (pgm) => {
  await pgm.db.query(`
    DROP TABLE IF EXISTS
      organizer_workspaces,
      audit_log,
      ai_reports,
      comment_cluster_items,
      comment_clusters,
      typology_assignments,
      trajectory_metrics,
      survey_answers,
      survey_responses,
      survey_publications,
      survey_questions,
      surveys,
      risk_signals,
      curator_notes,
      daily_reflections,
      diary_entries,
      event_tags,
      program_events,
      program_days,
      programs,
      speakers,
      state_scale_levels,
      auth_magic_links,
      auth_sessions,
      session_users,
      groups,
      users,
      sessions
    CASCADE;
  `);
};
