"use strict";

/**
 * File upload pipeline for the «Истоки» admin CMS.
 *
 * Storage strategy: local disk under `server/uploads/{audio,photos}/`.
 * Filenames are content-addressed (sha256 of the bytes) so re-uploading
 * the same file dedups and the URL is stable. The directory is served
 * publicly at `/uploads/...` by `express.static` (configured in
 * `server/index.cjs`); the resulting URL goes straight into
 * `istoki_podcasts.audio_url` or `istoki_stories.photo_url`.
 *
 * Replaceable later by an S3 adapter without touching callers — this
 * module exposes the same {url, sizeBytes, mime} contract.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const multer = require("multer");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const AUDIO_DIR = path.join(UPLOADS_ROOT, "audio");
const PHOTO_DIR = path.join(UPLOADS_ROOT, "photos");
const DOCUMENT_DIR = path.join(UPLOADS_ROOT, "documents");

const AUDIO_MIME = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg"]);
const PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

const AUDIO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function ensureDirs() {
  for (const dir of [UPLOADS_ROOT, AUDIO_DIR, PHOTO_DIR, DOCUMENT_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function extensionFor(mime, fallback) {
  switch (mime) {
    case "audio/mpeg":
    case "audio/mp3":
      return ".mp3";
    case "audio/wav":
      return ".wav";
    case "audio/ogg":
      return ".ogg";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return ".docx";
    case "text/plain":
      return ".txt";
    case "text/markdown":
      return ".md";
    default:
      return fallback;
  }
}

// Multer keeps the upload in memory so we can hash the bytes ourselves
// before writing — this gives us content-addressed filenames + dedup.
const memoryStorage = multer.memoryStorage();

function getKindConfig(kind) {
  if (kind === "audio") return { allowed: AUDIO_MIME, maxBytes: AUDIO_MAX_BYTES };
  if (kind === "document") return { allowed: DOCUMENT_MIME, maxBytes: DOCUMENT_MAX_BYTES };
  return { allowed: PHOTO_MIME, maxBytes: PHOTO_MAX_BYTES };
}

function createUploader({ kind }) {
  const { allowed, maxBytes } = getKindConfig(kind);

  return multer({
    storage: memoryStorage,
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter(_req, file, cb) {
      if (allowed.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          Object.assign(
            new Error(
              `Неподдерживаемый MIME для ${kind}: ${file.mimetype}. Разрешены: ${[...allowed].join(", ")}`,
            ),
            { status: 400 },
          ),
        );
      }
    },
  }).single("file");
}

const KIND_DIR = {
  audio: AUDIO_DIR,
  photo: PHOTO_DIR,
  document: DOCUMENT_DIR,
};

const KIND_URL_PREFIX = {
  audio: "audio",
  photo: "photos",
  document: "documents",
};

function persistUpload({ kind, file }) {
  ensureDirs();
  const targetDir = KIND_DIR[kind] || PHOTO_DIR;
  const hash = crypto.createHash("sha256").update(file.buffer).digest("hex").slice(0, 24);
  const ext = extensionFor(file.mimetype, path.extname(file.originalname || "") || "");
  const filename = `${hash}${ext}`;
  const fullPath = path.join(targetDir, filename);

  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, file.buffer);
  }

  const prefix = KIND_URL_PREFIX[kind] || KIND_URL_PREFIX.photo;
  const url = `/uploads/${prefix}/${filename}`;
  return {
    url,
    sizeBytes: file.size,
    mime: file.mimetype,
    filename,
  };
}

module.exports = {
  ensureUploadDirs: ensureDirs,
  uploadsRoot: UPLOADS_ROOT,
  audioUploader: createUploader({ kind: "audio" }),
  photoUploader: createUploader({ kind: "photo" }),
  documentUploader: createUploader({ kind: "document" }),
  persistUpload,
};
