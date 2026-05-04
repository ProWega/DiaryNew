"use strict";

/**
 * Privacy filter for diary entries and daily reflections.
 *
 * Single source of truth for the methodology rule «авторство принадлежит участнику».
 * Every curator/organizer-side read of diary content MUST go through one of these
 * functions. Never inspect `is_anonymous` or `is_hidden_from_curator` ad-hoc.
 *
 * Behavior:
 *  - For participant viewing own data: pass through unchanged.
 *  - For curator/organizer viewing others:
 *    * `is_hidden_from_curator=true` → entry is omitted entirely
 *    * `is_anonymous=true` → entry is returned with user identity scrubbed
 *  - For admin: pass through unchanged (admin needs to investigate, but flow
 *    is gated by audit log — see server/services/auditLog.cjs).
 *
 * See docs/architecture/methodology-mapping.md §1, rule 3.
 */

const CURATOR_ROLES = new Set(["curator", "organizer"]);

const ANONYMOUS_USER_FIELDS = ["user_id", "userId", "full_name", "fullName", "user"];

function shouldFilterFor(viewerRole) {
  return CURATOR_ROLES.has(viewerRole);
}

/**
 * Apply privacy rules to a single entry.
 * Returns null if the entry should be omitted entirely (hidden from curator).
 */
function applyToEntry(entry, viewerRole) {
  if (!entry) return null;
  if (!shouldFilterFor(viewerRole)) return entry;

  if (entry.is_hidden_from_curator || entry.isHiddenFromCurator) {
    return null;
  }

  if (entry.is_anonymous || entry.isAnonymous) {
    const scrubbed = { ...entry, anonymous: true };
    for (const field of ANONYMOUS_USER_FIELDS) {
      if (field in scrubbed) {
        scrubbed[field] = null;
      }
    }
    return scrubbed;
  }

  return entry;
}

/**
 * Apply privacy rules to a list of entries.
 * Hidden entries are dropped from the array; anonymous entries are scrubbed.
 */
function applyToList(entries, viewerRole) {
  if (!Array.isArray(entries)) return entries;
  if (!shouldFilterFor(viewerRole)) return entries;

  const result = [];
  for (const entry of entries) {
    const filtered = applyToEntry(entry, viewerRole);
    if (filtered !== null) result.push(filtered);
  }
  return result;
}

module.exports = {
  CURATOR_ROLES,
  ANONYMOUS_USER_FIELDS,
  applyToEntry,
  applyToList,
};
