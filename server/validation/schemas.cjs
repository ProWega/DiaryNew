const { z } = require("zod");

const ROLES = ["participant", "curator", "organizer", "admin"];
const USER_STATUSES = ["active", "disabled"];
const ASSIGNMENT_STATUSES = ["active", "disabled"];
const MAGIC_PURPOSES = ["login", "invite"];
const CONFIDENCE_VALUES = ["low", "high"];

// Methodology «Дневник пути» — see docs/architecture/methodology-mapping.md
const GROUP_LAD_VALUES = ["with_group", "alongside", "apart"];
const JOURNEY_STAGE_VALUES = ["search", "verification", "support", "transmission"];
const SUMMARY_AXIS_VALUES = ["mind", "heart", "will"];

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
    // Methodology Phase 2 — see docs/architecture/methodology-mapping.md §2.3
    groupLad: z.enum(GROUP_LAD_VALUES).optional().nullable(),
    isAnonymous: z.boolean().optional(),
    isHiddenFromCurator: z.boolean().optional(),
  })
  .strict();

// PATCH /api/participant/sessions/:sessionId/reflections/:dayId
const updateReflectionSchema = z
  .object({
    answers: z.record(z.string().max(64), z.string().max(2000)).optional(),
    // Legacy keys (q1/q2/q3) — kept for backwards compatibility during the migration.
    q1: optionalText(2000),
    q2: optionalText(2000),
    q3: optionalText(2000),
    // Methodology axes (Ум/Сердце/Воля) — preferred shape for new clients.
    mind: optionalText(2000),
    heart: optionalText(2000),
    will: optionalText(2000),
    freeText: optionalText(4000),
    // Methodology Phase 2 — privacy flags
    isAnonymous: z.boolean().optional(),
    isHiddenFromCurator: z.boolean().optional(),
  })
  .strict();

// PATCH /api/participant/sessions/:sessionId/journey-stage — v4: sets etap puti
// + careful mode at session_user level. Both fields optional individually so
// participant can update one without resetting the other.
const updateJourneyStageSchema = z
  .object({
    journeyStage: z.enum(JOURNEY_STAGE_VALUES).nullable().optional(),
    isCarefulMode: z.boolean().optional(),
  })
  .strict();

// POST /api/participant/diary/return-points/:sessionId/:touchpointIndex
// Phase 5.1 — записывает «дополнение к смене» в одной из 5 точек возврата.
const submitReturnEntrySchema = z
  .object({
    content: requiredText(4000),
    isAnonymous: z.boolean().optional(),
    isHiddenFromCurator: z.boolean().optional(),
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

// ── Истоки v2 (Phase B admin CMS) ─────────────────────────────────
const ISO_DATE = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Дата в формате YYYY-MM-DD" });

const upsertIstokiRegionSchema = z
  .object({
    code: requiredText(64).regex(/^[a-z0-9-]+$/, {
      message: "Код может содержать только латиницу, цифры и дефис",
    }),
    isoCode: trimmed(8).optional().nullable(),
    name: requiredText(200),
    geographicHint: optionalText(200),
    orderIdx: z.number().int().min(0).optional().default(0),
    isPublished: z.boolean().optional().default(true),
  })
  .strict();

const upsertIstokiPodcastSchema = z
  .object({
    id: trimmed(64).optional(),
    title: requiredText(300),
    description: optionalText(2000),
    audioUrl: requiredText(500),
    durationSec: z
      .number()
      .int()
      .min(0)
      .max(60 * 60 * 24)
      .optional()
      .default(0),
    recordedAt: ISO_DATE.optional().nullable(),
    speakerName: trimmed(200).optional().nullable(),
    orderIdx: z.number().int().min(0).optional().default(0),
  })
  .strict();

const upsertIstokiStorySchema = z
  .object({
    id: trimmed(64).optional(),
    participantName: requiredText(200),
    ageOrRole: requiredText(200),
    beforeText: requiredText(2000),
    afterText: requiredText(2000),
    manifestoQuote: requiredText(1000),
    photoUrl: requiredText(500),
    regionContextHint: trimmed(200).optional().nullable(),
    orderIdx: z.number().int().min(0).optional().default(0),
  })
  .strict();

const upsertIstokiChronicleSchema = z
  .object({
    id: trimmed(64).optional(),
    eventDate: ISO_DATE,
    eventTitle: requiredText(300),
    participantsCount: z.number().int().min(0).optional().default(0),
    keyInsights: z.array(trimmed(500)).max(20).optional().default([]),
    orderIdx: z.number().int().min(0).optional().default(0),
  })
  .strict();

const ALLOWED_ISTOKI_EVENT_TYPES = [
  "region.opened",
  "podcast.played",
  "podcast.progress",
  "story.viewed",
  "chronicle.viewed",
];

const istokiEventSchema = z
  .object({
    type: z.enum(ALLOWED_ISTOKI_EVENT_TYPES),
    regionCode: trimmed(80).nullable().optional(),
    entityId: trimmed(120).nullable().optional(),
    payload: z.record(z.string(), z.any()).optional(),
  })
  .strict();

const istokiEventsBatchSchema = z
  .object({
    events: z.array(istokiEventSchema).min(1).max(50),
  })
  .strict();

// ── Istoki v2 Phase F: public submissions + moderation ────────────

const submitterEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .email({ message: "Укажите корректный email" });
const submitterName = requiredText(120);
const istokiRegionCode = requiredText(80);
const externalUrl = requiredText(500); // expected to be a public URL — kept loose

const podcastDraftSchema = z
  .object({
    title: requiredText(300),
    description: optionalText(2000),
    audioUrl: externalUrl,
    durationSec: z
      .number()
      .int()
      .min(0)
      .max(60 * 60 * 24)
      .optional()
      .default(0),
    recordedAt: ISO_DATE.optional().nullable(),
    speakerName: trimmed(200).optional().nullable(),
  })
  .strict();

const storyDraftSchema = z
  .object({
    participantName: requiredText(200),
    ageOrRole: requiredText(200),
    beforeText: requiredText(2000),
    afterText: requiredText(2000),
    manifestoQuote: requiredText(1000),
    photoUrl: externalUrl,
    regionContextHint: trimmed(200).optional().nullable(),
  })
  .strict();

const chronicleDraftSchema = z
  .object({
    eventDate: ISO_DATE,
    eventTitle: requiredText(300),
    participantsCount: z.number().int().min(0).optional().default(0),
    keyInsights: z.array(trimmed(500)).max(20).optional().default([]),
  })
  .strict();

const submissionCommonShape = {
  regionCode: istokiRegionCode,
  submitterName,
  submitterEmail,
};

const createIstokiSubmissionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("podcast"),
      ...submissionCommonShape,
      draft: podcastDraftSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("story"),
      ...submissionCommonShape,
      draft: storyDraftSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("chronicle"),
      ...submissionCommonShape,
      draft: chronicleDraftSchema,
    })
    .strict(),
]);

const moderationApproveSchema = z
  .object({
    note: trimmed(1000).optional().nullable(),
  })
  .strict();

const moderationRejectSchema = z
  .object({
    note: requiredText(1000),
  })
  .strict();

module.exports = {
  GROUP_LAD_VALUES,
  JOURNEY_STAGE_VALUES,
  SUMMARY_AXIS_VALUES,
  consumeMagicLinkSchema,
  createMagicLinkSchema,
  createUserSchema,
  registerParticipantSchema,
  updateJourneyStageSchema,
  submitReturnEntrySchema,
  setupAdminSchema,
  updateDiaryEntrySchema,
  updateReflectionSchema,
  updateUserSchema,
  updateUserStatusSchema,
  upsertUserAssignmentSchema,
  upsertIstokiRegionSchema,
  upsertIstokiPodcastSchema,
  upsertIstokiStorySchema,
  upsertIstokiChronicleSchema,
  istokiEventSchema,
  istokiEventsBatchSchema,
  createIstokiSubmissionSchema,
  moderationApproveSchema,
  moderationRejectSchema,
};
