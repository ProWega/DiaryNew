const { z } = require("zod");

const ROLES = ["participant", "curator", "organizer", "admin"];
const USER_STATUSES = ["active", "disabled"];
const ASSIGNMENT_STATUSES = ["active", "disabled"];
const MAGIC_PURPOSES = ["login", "invite"];
const CONFIDENCE_VALUES = ["low", "high"];

const trimmed = (max) =>
  z
    .string()
    .trim()
    .max(max, { message: `Не более ${max} символов` });
const requiredText = (max) => trimmed(max).min(1, { message: "Обязательное поле" });
const optionalEmail = z
  .string()
  .trim()
  .email({ message: "Некорректный email" })
  .max(254)
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value.toLowerCase() : ""));
const optionalPhone = trimmed(40).optional().default("");
const optionalText = (max) => trimmed(max).optional().default("");
const id = (max = 128) => requiredText(max);

// POST /api/auth/magic-links
const createMagicLinkSchema = z
  .object({
    purpose: z.enum(MAGIC_PURPOSES).optional().default("login"),
    targetUserId: trimmed(128).optional().nullable(),
    sessionId: trimmed(128).optional().nullable(),
    role: z.enum(ROLES).optional().default("participant"),
    groupId: trimmed(128).optional().nullable(),
    fullName: optionalText(200),
    ttlMinutes: z
      .number()
      .int()
      .positive()
      .max(60 * 24 * 7)
      .optional(),
  })
  .strict();

// POST /api/auth/magic-links/consume
const consumeMagicLinkSchema = z
  .object({
    token: requiredText(512),
  })
  .strict();

// POST /api/setup/admin
const setupAdminSchema = z
  .object({
    setupToken: requiredText(256),
    fullName: requiredText(200),
    email: optionalEmail,
    phone: optionalPhone,
  })
  .strict();

// POST /api/participants/register
const registerParticipantSchema = z
  .object({
    fullName: requiredText(200),
    sessionId: id(),
  })
  .strict();

// PATCH /api/participant/sessions/:sessionId/diary/:entryId
// Note: dayId is pulled from the body (the route destructures `{ dayId, ...patch }`).
const updateDiaryEntrySchema = z
  .object({
    dayId: id(),
    stateId: trimmed(128).optional().nullable(),
    comment: optionalText(2000),
    confidence: z.enum(CONFIDENCE_VALUES).optional(),
    reflectionAnswers: z.record(z.string().max(64), z.string().max(2000)).optional(),
    allowIncompleteReflection: z.boolean().optional(),
  })
  .strict();

// PATCH /api/participant/sessions/:sessionId/reflections/:dayId
const updateReflectionSchema = z
  .object({
    answers: z.record(z.string().max(64), z.string().max(2000)).optional(),
    q1: optionalText(2000),
    q2: optionalText(2000),
    q3: optionalText(2000),
    freeText: optionalText(4000),
  })
  .strict();

// POST /api/admin/users
const createUserSchema = z
  .object({
    id: trimmed(128).optional(),
    fullName: requiredText(200),
    full_name: trimmed(200).optional(),
    role: z.enum(ROLES).optional().default("participant"),
    email: optionalEmail,
    phone: optionalPhone,
    age: z.number().int().min(0).max(120).optional().nullable(),
    gender: trimmed(40).optional(),
    status: z.enum(USER_STATUSES).optional().default("active"),
    meta: z.record(z.string().max(64), z.unknown()).optional(),
  })
  .passthrough();

// PATCH /api/admin/users/:userId
const updateUserSchema = z
  .object({
    fullName: trimmed(200).optional(),
    role: z.enum(ROLES).optional(),
    email: optionalEmail,
    phone: optionalPhone.optional(),
    age: z.number().int().min(0).max(120).optional().nullable(),
    gender: trimmed(40).optional(),
    status: z.enum(USER_STATUSES).optional(),
    meta: z.record(z.string().max(64), z.unknown()).optional(),
  })
  .passthrough();

// PATCH /api/admin/users/:userId/status
const updateUserStatusSchema = z
  .object({
    status: z.enum(USER_STATUSES),
  })
  .strict();

// POST /api/admin/users/:userId/assignments
const upsertUserAssignmentSchema = z
  .object({
    sessionId: id(),
    role: z.enum(ROLES).optional().default("participant"),
    groupId: trimmed(128).optional().nullable(),
    status: z.enum(ASSIGNMENT_STATUSES).optional().default("active"),
  })
  .strict();

module.exports = {
  consumeMagicLinkSchema,
  createMagicLinkSchema,
  createUserSchema,
  registerParticipantSchema,
  setupAdminSchema,
  updateDiaryEntrySchema,
  updateReflectionSchema,
  updateUserSchema,
  updateUserStatusSchema,
  upsertUserAssignmentSchema,
};
