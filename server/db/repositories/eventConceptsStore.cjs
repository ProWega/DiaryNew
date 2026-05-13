"use strict";

/**
 * Репозиторий концепций мероприятий (`program_event_concepts`).
 *
 * Хранит и оригинальный файл (на диске под `/uploads/documents/`), и
 * извлечённый текст (для быстрой инъекции в LLM-контекст). UNIQUE
 * (event_id, storage_filename) предотвращает повторную загрузку одного
 * и того же файла на одно событие (storage_filename = sha256-prefix).
 */

const { query } = require("../postgres.cjs");
const { createId } = require("./common.cjs");

async function insertConcept({
  sessionId,
  eventId,
  sourceFilename,
  storageFilename,
  mime,
  sizeBytes,
  extractedText,
  extractedChars,
  uploadedBy,
}) {
  const id = createId("event-concept");
  const result = await query(
    `insert into program_event_concepts
       (id, session_id, event_id, source_filename, storage_filename, mime,
        size_bytes, extracted_text, extracted_chars, uploaded_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (event_id, storage_filename)
       do update set
         source_filename = excluded.source_filename,
         mime            = excluded.mime,
         size_bytes      = excluded.size_bytes,
         extracted_text  = excluded.extracted_text,
         extracted_chars = excluded.extracted_chars,
         uploaded_by     = excluded.uploaded_by,
         uploaded_at     = now()
     returning id, source_filename, storage_filename, mime, size_bytes,
               extracted_text, extracted_chars, uploaded_by, uploaded_at`,
    [
      id,
      sessionId,
      eventId,
      sourceFilename,
      storageFilename,
      mime,
      sizeBytes,
      extractedText,
      extractedChars,
      uploadedBy,
    ],
  );
  return mapRow(result.rows[0]);
}

async function listByEvent(eventId) {
  const result = await query(
    `select c.id, c.event_id, c.source_filename, c.storage_filename, c.mime,
            c.size_bytes, c.extracted_chars, c.uploaded_by, c.uploaded_at,
            u.full_name as uploaded_by_name
       from program_event_concepts c
       left join users u on u.id = c.uploaded_by
       where c.event_id = $1
       order by c.uploaded_at desc`,
    [eventId],
  );
  return result.rows.map((row) => ({
    ...mapRow(row),
    uploadedByName: row.uploaded_by_name || null,
  }));
}

async function listBySession(sessionId) {
  const result = await query(
    `select id, event_id, source_filename, storage_filename, mime, size_bytes,
            extracted_text, extracted_chars, uploaded_by, uploaded_at
       from program_event_concepts
       where session_id = $1
       order by uploaded_at desc`,
    [sessionId],
  );
  return result.rows.map(mapRow);
}

async function getById(id) {
  const result = await query(
    `select id, session_id, event_id, source_filename, storage_filename, mime,
            size_bytes, extracted_text, extracted_chars, uploaded_by, uploaded_at
       from program_event_concepts
       where id = $1
       limit 1`,
    [id],
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    ...mapRow(row),
    sessionId: row.session_id,
  };
}

async function deleteById(id) {
  await query(`delete from program_event_concepts where id = $1`, [id]);
}

async function countByEvent(eventId) {
  const result = await query(
    `select count(*)::int as count from program_event_concepts where event_id = $1`,
    [eventId],
  );
  return result.rows[0]?.count || 0;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    sourceFilename: row.source_filename,
    storageFilename: row.storage_filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    extractedText: row.extracted_text,
    extractedChars: row.extracted_chars,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

module.exports = {
  insertConcept,
  listByEvent,
  listBySession,
  getById,
  deleteById,
  countByEvent,
};
