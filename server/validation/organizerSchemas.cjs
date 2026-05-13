"use strict";

const { z } = require("zod");

// Re-use the same helpers as schemas.cjs (inline to keep this file self-contained)
const trimmed = (max) =>
  z
    .string()
    .trim()
    .max(max, { message: `Не более ${max} символов` });

const requiredText = (max) => trimmed(max).min(1, { message: "Обязательное поле" });

const optionalText = (max) => trimmed(max).optional().default("");

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

// POST /api/organizer/sessions
// PATCH /api/organizer/sessions/:sessionId
// Fields pulled by pickOrganizerSessionPayload; admins may also send organizerId.
// NB: schema is intentionally NOT .strict() — the frontend sends a full session
// draft (id, registrationPolicy, participantsCount, etc.) and the handler picks
// only the allowed keys via pickOrganizerSessionPayload. Strict here would 400
// the request before the handler gets a chance to filter.
const createSessionSchema = z.object({
  name: requiredText(300),
  description: optionalText(2000),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  registrationStartsAt: z.string().optional().nullable(),
  registrationEndsAt: z.string().optional().nullable(),
  registrationCapacity: z.number().int().min(0).optional().nullable(),
  registrationStatus: z.enum(["draft", "open", "closed", "archived"]).optional(),
  // Admin-only field (ignored for non-admins by the handler)
  organizerId: trimmed(128).optional().nullable(),
});

const updateSessionSchema = createSessionSchema
  .omit({ name: true })
  .extend({ name: requiredText(300).optional() });

// PATCH /api/organizer/sessions/:sessionId/registration
// Delegates to updateRegistration() which handles the same registration fields.
const updateRegistrationSchema = z
  .object({
    registrationStatus: z.enum(["draft", "open", "closed", "archived"]).optional(),
    registrationStartsAt: z.string().optional().nullable(),
    registrationEndsAt: z.string().optional().nullable(),
    registrationCapacity: z.number().int().min(0).optional().nullable(),
    registrationPolicy: z.record(z.unknown()).optional(),
  })
  .strict();

// PATCH /api/organizer/sessions/:sessionId/settings
// Поддерживает participantEventAccessMode (settings) и llm-секцию
// (отдельный jsonb-блок, нормализуется через services/llmSettings.cjs).
const MODEL_ENUM = z.enum([
  "claude-haiku-4-5",
  "claude-sonnet-4-5",
  "claude-opus-4-7",
  "gpt-5-mini",
  "gpt-5",
  "gpt-4o-mini",
  "gpt-4o",
]);

const llmSettingsPatchSchema = z
  .object({
    defaultModel: MODEL_ENUM.optional(),
    allowedModels: z.array(MODEL_ENUM).optional(),
    maxTokensPerCall: z.number().int().min(64).max(8000).optional(),
    curatorDailyTokenBudget: z.number().int().min(0).max(10_000_000).optional(),
    curatorChatEnabled: z.boolean().optional(),
    conceptExtractionLimit: z.number().int().min(1000).max(50000).optional(),
  })
  .strict();

const updateSessionSettingsSchema = z
  .object({
    participantEventAccessMode: z.enum(["always", "from_start_time"]).optional(),
    llm: llmSettingsPatchSchema.optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Group management
// ---------------------------------------------------------------------------

// POST /api/organizer/sessions/:sessionId/groups
const createGroupSchema = z
  .object({
    name: requiredText(200),
    description: optionalText(1000),
  })
  .strict();

// PATCH /api/organizer/sessions/:sessionId/groups/:groupId
const updateGroupSchema = z
  .object({
    name: requiredText(200).optional(),
    description: optionalText(1000),
  })
  .strict();

// PATCH /api/organizer/sessions/:sessionId/groups/:groupId/curator
const assignCuratorSchema = z
  .object({
    curatorId: trimmed(128).optional().nullable().default(""),
  })
  .strict();

// POST /api/organizer/sessions/:sessionId/groups/:groupId/participants
const assignParticipantsSchema = z
  .object({
    participantIds: z
      .array(z.string().min(1).max(128))
      .min(1, { message: "Выберите хотя бы одного участника" }),
  })
  .strict();

// ---------------------------------------------------------------------------
// Program management
// ---------------------------------------------------------------------------

// eventContext sub-object used in create/update program
const eventContextSchema = z
  .object({
    title: optionalText(300),
    eventType: optionalText(100),
    venue: optionalText(200),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    participantCount: z.number().int().min(0).optional(),
    description: optionalText(2000),
  })
  .optional();

// POST /api/organizer/sessions/:sessionId/programs
const createProgramSchema = z
  .object({
    title: optionalText(300),
    description: optionalText(2000),
    status: z.enum(["draft", "published", "archived"]).optional(),
    eventContext: eventContextSchema,
  })
  .strict();

// PATCH /api/organizer/sessions/:sessionId/programs/:programId
const updateProgramSchema = createProgramSchema;

// ---------------------------------------------------------------------------
// Program day
// ---------------------------------------------------------------------------

// POST /api/organizer/sessions/:sessionId/programs/:programId/days
// PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId
// finalizeDayPatch reads: label, dateLabel, dateValue (also "date"), reflectionQuestions
const reflectionQuestionSchema = z
  .object({
    id: trimmed(128).optional(),
    text: optionalText(1000),
    title: optionalText(1000),
    required: z.boolean().optional(),
  })
  .passthrough();

const programDaySchema = z
  .object({
    label: trimmed(300).optional(),
    dateLabel: optionalText(200),
    dateValue: z.string().optional().nullable(),
    date: z.string().optional().nullable(), // alias accepted by finalizeDayPatch
    reflectionQuestions: z.array(reflectionQuestionSchema).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Day flows
// ---------------------------------------------------------------------------

// PATCH .../days/:dayId/flows
// req.body.flows is an array of flow items (string | object)
const flowItemSchema = z.union([
  z.string().min(1).max(50),
  z
    .object({
      id: trimmed(50).optional(),
      value: trimmed(50).optional(),
      parallelGroup: trimmed(50).optional(),
      label: optionalText(200),
      title: optionalText(200),
      track: optionalText(100),
    })
    .passthrough(),
]);

const updateDayFlowsSchema = z
  .object({
    flows: z.array(flowItemSchema).optional(),
  })
  .strict();

// PATCH .../days/:dayId/flow-order
// Handler reads flowOrder | order | columns
const updateFlowOrderSchema = z
  .object({
    flowOrder: z.array(z.string()).optional(),
    order: z.array(z.string()).optional(),
    columns: z.array(z.string()).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Program event
// ---------------------------------------------------------------------------

// Used for both create (POST .../events/parallel) and update (PATCH .../events/:eventId).
// normalizeEventPatch reads: title, start, end, type, speakerId, speakerName,
// location, track, parallelGroup, status, tags, description, reflectionQuestions
const programEventSchema = z
  .object({
    title: optionalText(300),
    start: optionalText(10),
    end: optionalText(10),
    type: optionalText(100),
    speakerId: trimmed(128).optional().nullable().default(""),
    speakerName: optionalText(200),
    location: optionalText(200),
    track: optionalText(100),
    parallelGroup: trimmed(50).optional(),
    status: z.enum(["planned", "active", "done", "cancelled"]).optional(),
    tags: z.array(z.string().max(100)).optional(),
    description: optionalText(2000),
    reflectionQuestions: z.array(reflectionQuestionSchema).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Survey management
// ---------------------------------------------------------------------------

const surveyQuestionSchema = z
  .object({
    id: trimmed(128).optional(),
    type: z.enum(["scale", "choice", "text", "boolean"]).optional(),
    title: optionalText(500),
    options: z.union([z.array(z.string().max(200)), z.string().max(2000)]).optional(),
  })
  .passthrough();

// POST /api/organizer/sessions/:sessionId/surveys
const createSurveySchema = z
  .object({
    title: optionalText(300),
    category: optionalText(200),
    cadence: optionalText(200),
    source: optionalText(200),
    description: optionalText(2000),
    questions: z.array(surveyQuestionSchema).optional(),
  })
  .strict();

// PATCH /api/organizer/sessions/:sessionId/surveys/:surveyId
const updateSurveySchema = createSurveySchema;

// POST .../surveys/:surveyId/questions
// PATCH .../surveys/:surveyId/questions/:questionId
const surveyQuestionBodySchema = z
  .object({
    type: z.enum(["scale", "choice", "text", "boolean"]).optional(),
    title: optionalText(500),
    options: z.union([z.array(z.string().max(200)), z.string().max(2000)]).optional(),
  })
  .strict();

// POST .../surveys/:surveyId/publish
// normalizeSurveyFilters reads: ageMin, ageMax, genders, emotionalProfiles, groupIds, identityStatuses
const publishSurveySchema = z
  .object({
    ageMin: z.union([z.number().int().min(0).max(120), z.literal(""), z.null()]).optional(),
    ageMax: z.union([z.number().int().min(0).max(120), z.literal(""), z.null()]).optional(),
    genders: z.union([z.array(z.string().max(40)), z.string().max(200)]).optional(),
    emotionalProfiles: z.union([z.array(z.string().max(100)), z.string().max(500)]).optional(),
    groupIds: z.union([z.array(z.string().max(128)), z.string().max(2000)]).optional(),
    identityStatuses: z.union([z.array(z.string().max(100)), z.string().max(500)]).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // sessions
  createSessionSchema,
  updateSessionSchema,
  updateRegistrationSchema,
  updateSessionSettingsSchema,
  // groups
  createGroupSchema,
  updateGroupSchema,
  assignCuratorSchema,
  assignParticipantsSchema,
  // programs
  createProgramSchema,
  updateProgramSchema,
  // days
  programDaySchema,
  // flows
  updateDayFlowsSchema,
  updateFlowOrderSchema,
  // events
  programEventSchema,
  // surveys
  createSurveySchema,
  updateSurveySchema,
  surveyQuestionBodySchema,
  publishSurveySchema,
};
