"use strict";

jest.mock("../db/postgres.cjs", () => ({
  query: jest.fn(),
}));

const { query } = require("../db/postgres.cjs");
const {
  buildSlotKey,
  groupEventsBySlot,
  getSelectionsForUser,
  setSelection,
  countSelectionsByEvent,
} = require("./parallelSlotsService.cjs");

function rows(arr) {
  return { rows: arr };
}

describe("parallelSlotsService.buildSlotKey", () => {
  it("returns start_time as-is", () => {
    expect(buildSlotKey({ start_time: "09:00" })).toBe("09:00");
    expect(buildSlotKey({ startTime: "10:30" })).toBe("10:30");
  });

  it("returns empty string for null/missing", () => {
    expect(buildSlotKey({})).toBe("");
    expect(buildSlotKey({ start_time: null })).toBe("");
    expect(buildSlotKey({ start_time: "" })).toBe("");
    expect(buildSlotKey(null)).toBe("");
  });
});

describe("parallelSlotsService.groupEventsBySlot", () => {
  it("returns empty for empty input", () => {
    expect(groupEventsBySlot([])).toEqual([]);
    expect(groupEventsBySlot(null)).toEqual([]);
  });

  it("groups single event as non-parallel slot", () => {
    const result = groupEventsBySlot([
      { id: "e-1", day_id: "d-1", start_time: "09:00", parallel_group: "A", title: "Круг" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("09:00");
    expect(result[0].isParallel).toBe(false);
    expect(result[0].parallelGroups).toEqual(["A"]);
    expect(result[0].events).toHaveLength(1);
  });

  it("detects parallel slot when same start_time but different parallel_group", () => {
    const result = groupEventsBySlot([
      { id: "e-1", day_id: "d-1", start_time: "09:00", parallel_group: "A", title: "Круг" },
      { id: "e-2", day_id: "d-1", start_time: "09:00", parallel_group: "B", title: "Прогулка" },
      { id: "e-3", day_id: "d-1", start_time: "11:00", parallel_group: "A", title: "Лекция" },
    ]);
    expect(result).toHaveLength(2);
    const slotAt9 = result.find((s) => s.key === "09:00");
    expect(slotAt9.isParallel).toBe(true);
    expect(slotAt9.events).toHaveLength(2);
    expect(slotAt9.parallelGroups).toEqual(["A", "B"]);

    const slotAt11 = result.find((s) => s.key === "11:00");
    expect(slotAt11.isParallel).toBe(false);
  });

  it("does NOT mark parallel if same start_time but identical parallel_group", () => {
    // Edge case: organizer накосячил, два события в одном потоке. Не показываем
    // как параллельные (но всё равно в одной карточке слота).
    const result = groupEventsBySlot([
      { id: "e-1", day_id: "d-1", start_time: "09:00", parallel_group: "A" },
      { id: "e-2", day_id: "d-1", start_time: "09:00", parallel_group: "A" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].isParallel).toBe(false);
  });

  it("events without start_time go into separate non-parallel slots", () => {
    const result = groupEventsBySlot([
      { id: "e-1", day_id: "d-1", start_time: null, parallel_group: "A", sort_order: 1 },
      { id: "e-2", day_id: "d-1", start_time: null, parallel_group: "B", sort_order: 2 },
    ]);
    expect(result).toHaveLength(2);
    expect(result.every((s) => !s.isParallel)).toBe(true);
    expect(result[0].events[0].id).toBe("e-1");
    expect(result[1].events[0].id).toBe("e-2");
  });

  it("sorts slots by start_time, no-time slots last", () => {
    const result = groupEventsBySlot([
      { id: "e-late", start_time: "14:00", parallel_group: "A", sort_order: 99 },
      { id: "e-noTime", start_time: null, parallel_group: "A", sort_order: 50 },
      { id: "e-morning", start_time: "09:00", parallel_group: "A", sort_order: 1 },
    ]);
    expect(result.map((s) => s.key)).toEqual(["09:00", "14:00", ""]);
  });

  it("uses widest end_time within a parallel slot", () => {
    const result = groupEventsBySlot([
      { id: "e-1", start_time: "09:00", end_time: "10:00", parallel_group: "A" },
      { id: "e-2", start_time: "09:00", end_time: "10:30", parallel_group: "B" },
    ]);
    expect(result[0].endTime).toBe("10:30");
  });
});

describe("parallelSlotsService.getSelectionsForUser", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("returns Map keyed by dayId|slotKey", async () => {
    query.mockResolvedValueOnce(
      rows([
        { day_id: "d-1", slot_key: "09:00", event_id: "e-1" },
        { day_id: "d-1", slot_key: "11:00", event_id: "e-3" },
        { day_id: "d-2", slot_key: "09:00", event_id: "e-7" },
      ]),
    );
    const map = await getSelectionsForUser({ userId: "u-1", sessionId: "s-1" });
    expect(map.get("d-1|09:00")).toBe("e-1");
    expect(map.get("d-1|11:00")).toBe("e-3");
    expect(map.get("d-2|09:00")).toBe("e-7");
    expect(map.size).toBe(3);
  });

  it("adds day filter when dayId provided", async () => {
    query.mockResolvedValueOnce(rows([]));
    await getSelectionsForUser({ userId: "u-1", sessionId: "s-1", dayId: "d-1" });
    const callArgs = query.mock.calls[0];
    expect(callArgs[1]).toEqual(["u-1", "s-1", "d-1"]);
    expect(callArgs[0]).toMatch(/day_id = \$3/);
  });
});

describe("parallelSlotsService.setSelection", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("rejects empty slotKey", async () => {
    await expect(
      setSelection({
        userId: "u-1",
        sessionId: "s-1",
        dayId: "d-1",
        slotKey: "",
        eventId: "e-1",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects missing eventId", async () => {
    await expect(
      setSelection({
        userId: "u-1",
        sessionId: "s-1",
        dayId: "d-1",
        slotKey: "09:00",
        eventId: null,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects event that is not in the slot", async () => {
    // slot has only e-1 (A) and e-2 (B), user tries to pick e-9
    query.mockResolvedValueOnce(
      rows([
        { id: "e-1", start_time: "09:00", parallel_group: "A" },
        { id: "e-2", start_time: "09:00", parallel_group: "B" },
      ]),
    );
    await expect(
      setSelection({
        userId: "u-1",
        sessionId: "s-1",
        dayId: "d-1",
        slotKey: "09:00",
        eventId: "e-9",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects slot that is not actually parallel", async () => {
    query.mockResolvedValueOnce(
      rows([
        { id: "e-1", start_time: "09:00", parallel_group: "A" },
        // Только одно событие или все в группе "A" — параллели нет
      ]),
    );
    await expect(
      setSelection({
        userId: "u-1",
        sessionId: "s-1",
        dayId: "d-1",
        slotKey: "09:00",
        eventId: "e-1",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("UPSERTs and returns new selection with changed flag", async () => {
    // 1. fetch slot events — есть параллель
    query.mockResolvedValueOnce(
      rows([
        { id: "e-1", start_time: "09:00", parallel_group: "A" },
        { id: "e-2", start_time: "09:00", parallel_group: "B" },
      ]),
    );
    // 2. previous selection — был e-1
    query.mockResolvedValueOnce(rows([{ event_id: "e-1" }]));
    // 3. UPSERT — теперь e-2
    query.mockResolvedValueOnce(
      rows([
        {
          id: "ppsel-abc",
          day_id: "d-1",
          slot_key: "09:00",
          event_id: "e-2",
          selected_at: "2026-05-14T09:30:00Z",
        },
      ]),
    );

    const result = await setSelection({
      userId: "u-1",
      sessionId: "s-1",
      dayId: "d-1",
      slotKey: "09:00",
      eventId: "e-2",
    });

    expect(result.eventId).toBe("e-2");
    expect(result.previousEventId).toBe("e-1");
    expect(result.changed).toBe(true);
  });

  it("first-time selection has previousEventId=null and changed=false", async () => {
    query.mockResolvedValueOnce(
      rows([
        { id: "e-1", start_time: "09:00", parallel_group: "A" },
        { id: "e-2", start_time: "09:00", parallel_group: "B" },
      ]),
    );
    query.mockResolvedValueOnce(rows([])); // no previous
    query.mockResolvedValueOnce(
      rows([
        {
          id: "ppsel-xyz",
          day_id: "d-1",
          slot_key: "09:00",
          event_id: "e-1",
          selected_at: "2026-05-14T09:30:00Z",
        },
      ]),
    );

    const result = await setSelection({
      userId: "u-1",
      sessionId: "s-1",
      dayId: "d-1",
      slotKey: "09:00",
      eventId: "e-1",
    });

    expect(result.previousEventId).toBe(null);
    expect(result.changed).toBe(false);
  });
});

describe("parallelSlotsService.countSelectionsByEvent", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("returns empty Map for empty eventIds", async () => {
    const map = await countSelectionsByEvent({ sessionId: "s-1", eventIds: [] });
    expect(map.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("aggregates counts by event_id", async () => {
    query.mockResolvedValueOnce(
      rows([
        { event_id: "e-1", n: 5 },
        { event_id: "e-2", n: 3 },
      ]),
    );
    const map = await countSelectionsByEvent({ sessionId: "s-1", eventIds: ["e-1", "e-2"] });
    expect(map.get("e-1")).toBe(5);
    expect(map.get("e-2")).toBe(3);
  });
});
