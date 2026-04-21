const { createOrganizerWorkspaceSeed } = require("../seed/organizerWorkspaceSeed.cjs");
const { ensureSchema, hasPostgresConfig } = require("./postgres.cjs");
const {
  getOrganizerWorkspace,
  persistWorkspace,
  saveWorkspaceCache,
} = require("./repositories/organizerStore.cjs");

const memoryStore = new Map();

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stampWorkspace(workspace, storageMode, { bumpRevision = false } = {}) {
  const nextWorkspace = cloneJson(workspace);
  const previousMeta = nextWorkspace.meta || {};

  nextWorkspace.meta = {
    revision: bumpRevision
      ? (previousMeta.revision || 0) + 1
      : previousMeta.revision || 1,
    updatedAt: bumpRevision ? new Date().toISOString() : previousMeta.updatedAt || new Date().toISOString(),
    storageMode,
  };

  return nextWorkspace;
}

async function readFromPostgres(sessionId) {
  await ensureSchema();
  const workspace = await getOrganizerWorkspace(sessionId);
  const stampedWorkspace = stampWorkspace(workspace, "postgres");
  await saveWorkspaceCache(sessionId, stampedWorkspace);
  return stampedWorkspace;
}

function readFromMemory(sessionId) {
  const existingWorkspace = memoryStore.get(sessionId);

  if (!existingWorkspace) {
    return null;
  }

  return stampWorkspace(existingWorkspace, "memory");
}

function writeToMemory(sessionId, workspace) {
  const stampedWorkspace = stampWorkspace(workspace, "memory", {
    bumpRevision: true,
  });
  memoryStore.set(sessionId, stampedWorkspace);
  return stampedWorkspace;
}

function createSeed(sessionId) {
  return createOrganizerWorkspaceSeed(sessionId);
}

async function getWorkspace(sessionId) {
  if (hasPostgresConfig()) {
    try {
      return await readFromPostgres(sessionId);
    } catch (error) {
      console.warn("[organizer-store] PostgreSQL unavailable, falling back to memory mode.");
      console.warn(error.message);
    }
  }

  const memoryWorkspace = readFromMemory(sessionId);

  if (memoryWorkspace) {
    return memoryWorkspace;
  }

  return writeToMemory(sessionId, createSeed(sessionId));
}

async function saveWorkspace(sessionId, workspace) {
  const storageMode = workspace?.meta?.storageMode;

  if (storageMode === "postgres" && hasPostgresConfig()) {
    try {
      return await persistWorkspace(sessionId, stampWorkspace(workspace, "postgres", {
        bumpRevision: true,
      }));
    } catch (error) {
      console.warn("[organizer-store] Save to PostgreSQL failed, storing in memory.");
      console.warn(error.message);
    }
  }

  return writeToMemory(sessionId, workspace);
}

async function updateWorkspace(sessionId, updater) {
  const currentWorkspace = await getWorkspace(sessionId);
  const draftWorkspace = cloneJson(currentWorkspace);
  const updatedWorkspace = (await updater(draftWorkspace)) || draftWorkspace;
  return saveWorkspace(sessionId, updatedWorkspace);
}

module.exports = {
  getWorkspace,
  saveWorkspace,
  updateWorkspace,
};
