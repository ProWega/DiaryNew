"use strict";

/**
 * Пакетные приглашения участников через xlsx → PDF с QR.
 *
 * Workflow:
 *   1. Организатор скачивает xlsx-шаблон (3 колонки: Группа / Куратор / Участник).
 *   2. Заполняет, загружает обратно.
 *   3. Backend парсит → создаёт magic-link для куратора + каждого участника
 *      (createMagicLink из authStore). Группы без записи в БД создаются на лету.
 *   4. Backend рендерит PDF с тремя возможными лайаутами и опциональной
 *      letterhead-подложкой (PDF/PNG/JPG).
 *
 * Сервис чистый — endpoint просто прокидывает buffers и параметры. Все
 * сторонние записи (group creation, magic-link) делаем последовательно
 * последовательно (без транзакции — pg-pool сам по соединению; если
 * PDF упадёт, magic-link'и останутся валидными до истечения, что приемлемо
 * — организатор просто перегенерирует).
 */

const path = require("node:path");
const fs = require("node:fs");
const xlsx = require("xlsx");
const PDFDocument = require("pdfkit");
const { PDFDocument: PdfLibDocument } = require("pdf-lib");
const QRCode = require("qrcode");
const { query } = require("../db/postgres.cjs");
const { createId } = require("../db/repositories/common.cjs");
const { createMagicLink } = require("../db/repositories/authStore.cjs");

const TEMPLATE_HEADERS = ["Группа", "Куратор", "Участник"];
const TEMPLATE_EXAMPLE_ROWS = [
  ["Группа Печоры", "Захарова Виктория Ясиновна", "Богдан Ногин"],
  ["Группа Печоры", "Захарова Виктория Ясиновна", "Антон Панин"],
  ["Группа Печоры", "Захарова Виктория Ясиновна", "София Панина"],
  ["Группа Севастополь", "Тозлевская Сюзанна Владимировна", "Кира Суханова"],
  ["Группа Севастополь", "Тозлевская Сюзанна Владимировна", "Виктория Гулько"],
];

const SUPPORTED_LAYOUTS = new Set(["card", "table"]);
const DEFAULT_TTL_MINUTES = 24 * 60;

// -------- Шаблон xlsx --------

/**
 * Генерирует пустой шаблон-xlsx с заголовками и парой строк-примеров для
 * наглядности. Возвращает Buffer.
 */
function buildTemplateXlsx() {
  const wb = xlsx.utils.book_new();
  const aoa = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS];
  const sheet = xlsx.utils.aoa_to_sheet(aoa);
  // Ширина колонок для удобства редактирования в Excel.
  sheet["!cols"] = [{ wch: 22 }, { wch: 32 }, { wch: 30 }];
  xlsx.utils.book_append_sheet(wb, sheet, "Приглашения");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Парсит загруженный xlsx → массив групп.
 *
 * Возвращает:
 *   {
 *     groups: [{ name, curator, participants: [...uniqueNames] }],
 *     warnings: [{ kind, message }],
 *     stats: { totalRows, groupsCount, participantsCount, curatorsCount }
 *   }
 *
 * Дубликаты участников в одной группе схлопываются. Если у группы куратор
 * указан в одних строках и пустой в других — берём первый непустой. Если
 * куратор не указан вовсе — warning, но группа создаётся (без curator-link'a).
 */
function parseTemplateXlsx(buffer) {
  const wb = xlsx.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    throw createImportError(400, "В файле нет ни одного листа");
  }
  const rows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });

  const warnings = [];
  if (!rows.length) {
    throw createImportError(400, "Шаблон пустой");
  }
  const header = (rows[0] || []).map((c) =>
    String(c || "")
      .trim()
      .toLowerCase(),
  );
  const groupCol = header.findIndex((c) => c.includes("групп"));
  const curatorCol = header.findIndex((c) => c.includes("куратор"));
  const participantCol = header.findIndex((c) => c.includes("участник"));
  if (groupCol < 0 || participantCol < 0) {
    throw createImportError(
      400,
      "Не найдены обязательные колонки. Ожидаются: «Группа», «Куратор», «Участник».",
    );
  }
  if (curatorCol < 0) {
    warnings.push({
      kind: "missing_column",
      message: "В шаблоне нет колонки «Куратор» — создадим только приглашения участников.",
    });
  }

  // groupName → { curator, participants: Set<string> }
  const byGroup = new Map();
  let totalRows = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const groupName = String(row[groupCol] || "").trim();
    const participant = String(row[participantCol] || "").trim();
    const curator = curatorCol >= 0 ? String(row[curatorCol] || "").trim() : "";
    if (!groupName) continue;
    totalRows++;

    if (!byGroup.has(groupName)) {
      byGroup.set(groupName, { curator: "", participants: new Set() });
    }
    const entry = byGroup.get(groupName);
    if (!entry.curator && curator) entry.curator = curator;
    if (participant) entry.participants.add(participant);
  }

  if (byGroup.size === 0) {
    throw createImportError(400, "В шаблоне не нашлось ни одной заполненной группы.");
  }

  const groups = Array.from(byGroup.entries()).map(([name, value]) => ({
    name,
    curator: value.curator || "",
    participants: Array.from(value.participants),
  }));

  let curatorsCount = 0;
  let participantsCount = 0;
  for (const g of groups) {
    if (g.curator) curatorsCount++;
    participantsCount += g.participants.length;
    if (!g.curator) {
      warnings.push({
        kind: "missing_curator",
        message: `У группы «${g.name}» не указан куратор — будет создано приглашение только для участников.`,
      });
    }
    if (g.participants.length === 0) {
      warnings.push({
        kind: "empty_group",
        message: `У группы «${g.name}» нет участников.`,
      });
    }
  }

  return {
    groups,
    warnings,
    stats: {
      totalRows,
      groupsCount: groups.length,
      participantsCount,
      curatorsCount,
    },
  };
}

// -------- Создание magic-link'ов --------

/**
 * Ищет существующего user_id по full_name в рамках сессии. Возвращает либо
 * id, либо null. Используется для DEDUP при пакетных приглашениях: если
 * участник уже был зван (или участвовал раньше) — новый magic-link привязываем
 * к ТОМУ ЖЕ user_id через `target_user_id`, иначе consume создаст вторую
 * копию пользователя с тем же ФИО, и человек залогинится в пустой кабинет.
 *
 * Скоп — внутри `session_users` сессии, чтобы избежать ложных merge'ов между
 * полными тёзками из разных заездов.
 */
async function findExistingSessionUserId({ sessionId, fullName }) {
  if (!fullName) return null;
  const result = await query(
    `select u.id
       from users u
       join session_users su on su.user_id = u.id
       where su.session_id = $1
         and u.status = 'active'
         and lower(trim(u.full_name)) = lower(trim($2))
       order by su.updated_at desc nulls last, u.updated_at desc nulls last
       limit 1`,
    [sessionId, fullName],
  );
  return result.rows[0]?.id || null;
}

/**
 * Находит группу по имени в рамках сессии. Если нет — создаёт.
 * Возвращает её id.
 */
async function findOrCreateGroup({ sessionId, name, actorId }) {
  const existing = await query(
    `select id from groups where session_id = $1 and name = $2 limit 1`,
    [sessionId, name],
  );
  if (existing.rows.length) return existing.rows[0].id;

  const groupId = createId("group");
  await query(
    `insert into groups (id, session_id, name, description, updated_at)
     values ($1, $2, $3, '', now())`,
    [groupId, sessionId, name],
  );
  await query(
    `insert into audit_log (id, actor_id, session_id, action, entity_type, entity_id, payload, created_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, now())`,
    [
      createId("audit"),
      actorId || null,
      sessionId,
      "organizer.invite.batch.group_autocreated",
      "group",
      groupId,
      JSON.stringify({ name }),
    ],
  );
  return groupId;
}

/**
 * Создаёт magic-link'и для всех групп/кураторов/участников из шаблона.
 *
 * Возвращает массив `[{groupId, groupName, role, fullName, url, expiresAt}]`,
 * который используется PDF-рендером.
 */
async function createBulkInvites({ sessionId, actorId, groups, ttlMinutes }) {
  const ttl = Number(ttlMinutes) || DEFAULT_TTL_MINUTES;
  const result = [];

  for (const group of groups) {
    const groupId = await findOrCreateGroup({
      sessionId,
      name: group.name,
      actorId,
    });

    if (group.curator) {
      const curatorUserId = await findExistingSessionUserId({
        sessionId,
        fullName: group.curator,
      });
      const link = await createMagicLink({
        creatorId: actorId,
        purpose: "invite",
        targetUserId: curatorUserId,
        sessionId,
        role: "curator",
        groupId,
        fullName: group.curator,
        ttlMinutes: ttl,
        meta: {
          source: "bulk-invite",
          batch: true,
          reusedExistingUser: Boolean(curatorUserId),
        },
      });
      result.push({
        groupId,
        groupName: group.name,
        role: "curator",
        fullName: group.curator,
        url: link.url,
        expiresAt: link.expiresAt,
      });
    }

    for (const participant of group.participants) {
      const participantUserId = await findExistingSessionUserId({
        sessionId,
        fullName: participant,
      });
      const link = await createMagicLink({
        creatorId: actorId,
        purpose: "invite",
        targetUserId: participantUserId,
        sessionId,
        role: "participant",
        groupId,
        fullName: participant,
        ttlMinutes: ttl,
        meta: {
          source: "bulk-invite",
          batch: true,
          reusedExistingUser: Boolean(participantUserId),
        },
      });
      result.push({
        groupId,
        groupName: group.name,
        role: "participant",
        fullName: participant,
        url: link.url,
        expiresAt: link.expiresAt,
      });
    }
  }

  return result;
}

// -------- Рендер PDF --------

const FONT_BASE_PATH = path.join(__dirname, "..", "..", "public", "fonts", "TT Norms");
const FONT_REGULAR = "TT Norms Std Trial Condensed Regular.otf";
const FONT_BOLD = "TT Norms Std Trial Condensed Bold.otf";

function loadFontBuffer(filename) {
  try {
    return fs.readFileSync(path.join(FONT_BASE_PATH, filename));
  } catch {
    return null;
  }
}

function createDoc({ title }) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: { Title: title || "Приглашения участников" },
  });
  const regular = loadFontBuffer(FONT_REGULAR);
  const bold = loadFontBuffer(FONT_BOLD);
  if (regular) doc.registerFont("Main", regular);
  if (bold) doc.registerFont("Main-Bold", bold);
  // Если шрифт не загрузился — будет встроенный Helvetica (нет кириллицы),
  // но это деградация, не падение.
  doc.font(regular ? "Main" : "Helvetica");
  return doc;
}

async function renderQr(url, size) {
  return QRCode.toBuffer(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/**
 * Группирует invites по группам в порядке появления.
 */
function groupByGroupName(invites) {
  const map = new Map();
  for (const invite of invites) {
    if (!map.has(invite.groupName)) map.set(invite.groupName, []);
    map.get(invite.groupName).push(invite);
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
}

function drawPageHeader(doc, { title, groupName, curator, isFirstPage }) {
  const top = doc.page.margins.top;
  doc.fontSize(18).text(title || "Приглашения участников", doc.page.margins.left, top);
  doc.moveDown(0.3);
  doc.fontSize(13).text(`Группа: ${groupName}`);
  if (curator) doc.fontSize(11).text(`Куратор: ${curator}`);
  doc.moveDown(0.5);
}

function drawFooter(doc, { footer }) {
  if (!footer) return;
  const { width, height, margins } = doc.page;
  doc.fontSize(9).fillColor("#888");
  doc.text(footer, margins.left, height - margins.bottom + 12, {
    width: width - margins.left - margins.right,
    align: "center",
  });
  doc.fillColor("black");
}

/**
 * Лайаут "card": одна карточка на страницу, большой QR.
 */
async function renderCardLayout(doc, invitesByGroup, { title, footer }) {
  let firstPage = true;
  for (const group of invitesByGroup) {
    const curator = group.items.find((i) => i.role === "curator")?.fullName || "";
    for (let i = 0; i < group.items.length; i++) {
      const invite = group.items[i];
      if (!firstPage) doc.addPage();
      firstPage = false;
      drawPageHeader(doc, { title, groupName: group.name, curator, isFirstPage: i === 0 });

      const qrSize = 240;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const qrX = doc.page.margins.left + (pageWidth - qrSize) / 2;
      const qrBuffer = await renderQr(invite.url, qrSize);

      doc.fontSize(24).text(invite.fullName, doc.page.margins.left, doc.y + 24, {
        width: pageWidth,
        align: "center",
      });
      doc.moveDown(0.5);
      doc
        .fontSize(13)
        .fillColor("#666")
        .text(invite.role === "curator" ? "Куратор" : "Участник", {
          width: pageWidth,
          align: "center",
        })
        .fillColor("black");

      doc.image(qrBuffer, qrX, doc.y + 16, { width: qrSize });

      const linkY = doc.y + qrSize + 32;
      doc.fontSize(10).fillColor("#0066cc").text(invite.url, doc.page.margins.left, linkY, {
        width: pageWidth,
        align: "center",
        link: invite.url,
        underline: true,
      });
      doc.fillColor("black");
      drawFooter(doc, { footer });
    }
  }
}

/**
 * Лайаут "table": компактная таблица, ~12-15 строк на страницу.
 */
async function renderTableLayout(doc, invitesByGroup, { title, footer }) {
  let firstPage = true;
  for (const group of invitesByGroup) {
    if (!firstPage) doc.addPage();
    firstPage = false;
    const curator = group.items.find((i) => i.role === "curator")?.fullName || "";
    drawPageHeader(doc, { title, groupName: group.name, curator });

    const rowHeight = 56;
    const qrSize = 44;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    let y = doc.y + 8;
    for (const invite of group.items) {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        drawFooter(doc, { footer });
        doc.addPage();
        drawPageHeader(doc, { title, groupName: group.name, curator });
        y = doc.y + 8;
      }
      const qrBuffer = await renderQr(invite.url, qrSize);
      doc.image(qrBuffer, doc.page.margins.left, y, { width: qrSize });
      doc
        .fontSize(12)
        .fillColor("black")
        .text(invite.fullName, doc.page.margins.left + qrSize + 12, y + 4, {
          width: pageWidth - qrSize - 12,
        });
      doc
        .fontSize(8)
        .fillColor("#666")
        .text(
          invite.role === "curator" ? "куратор" : "участник",
          doc.page.margins.left + qrSize + 12,
          y + 22,
          { width: pageWidth - qrSize - 12 },
        );
      doc
        .fontSize(8)
        .fillColor("#0066cc")
        .text(invite.url, doc.page.margins.left + qrSize + 12, y + 34, {
          width: pageWidth - qrSize - 12,
          link: invite.url,
        });
      doc.fillColor("black");
      y += rowHeight + 4;
    }
    drawFooter(doc, { footer });
  }
}

/**
 * Накладывает PDF-letterhead на каждую страницу нашего документа.
 * pdfkit-output — Buffer. Загружаем оба через pdf-lib, для каждой нашей
 * страницы вставляем первую страницу letterhead'а под нашими элементами
 * через embed → drawPage.
 *
 * pdf-lib не умеет рисовать ПОД существующим контентом, поэтому делаем
 * обратно: создаём новый doc, на каждую страницу сначала кладём letterhead,
 * потом нашу страницу через embedPage.
 */
async function overlayPdfLetterhead(ourPdfBuffer, letterheadBuffer) {
  const outDoc = await PdfLibDocument.create();
  const ourDoc = await PdfLibDocument.load(ourPdfBuffer);
  const letterDoc = await PdfLibDocument.load(letterheadBuffer);
  const letterPage = letterDoc.getPages()[0];
  if (!letterPage) return ourPdfBuffer;

  // Embed letterhead page once.
  const [embedLetter] = await outDoc.embedPdf(letterheadBuffer, [0]);
  // Embed each our-page.
  const ourPages = await outDoc.embedPdf(ourPdfBuffer, ourDoc.getPageIndices());

  for (const ourEmbedded of ourPages) {
    const { width, height } = ourEmbedded.size();
    const page = outDoc.addPage([width, height]);
    page.drawPage(embedLetter, { x: 0, y: 0, width, height });
    page.drawPage(ourEmbedded, { x: 0, y: 0, width, height });
  }

  return Buffer.from(await outDoc.save());
}

/**
 * Главная точка рендера: invites + опции → Buffer (application/pdf).
 */
async function renderInvitesPdf({
  invites,
  layout = "card",
  letterhead = null,
  title = "Приглашения участников",
  footer = "",
}) {
  if (!Array.isArray(invites) || invites.length === 0) {
    throw createImportError(400, "Нет приглашений для PDF");
  }
  const safeLayout = SUPPORTED_LAYOUTS.has(layout) ? layout : "card";
  const invitesByGroup = groupByGroupName(invites);

  const doc = createDoc({ title });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  // Если letterhead — PNG/JPG, кладём как фон на КАЖДОЙ странице через
  // pdfkit event 'pageAdded'. Для PDF — наложение делаем после end().
  let letterheadImageBuffer = null;
  if (letterhead && /^image\/(png|jpeg|jpg)$/i.test(letterhead.mimetype || "")) {
    letterheadImageBuffer = letterhead.buffer;
  }
  if (letterheadImageBuffer) {
    const drawBg = () => {
      try {
        doc.save();
        doc.image(letterheadImageBuffer, 0, 0, {
          width: doc.page.width,
          height: doc.page.height,
        });
        doc.restore();
      } catch {
        // ignore image errors — продолжаем без фона
      }
    };
    doc.on("pageAdded", drawBg);
    drawBg(); // первая страница уже создана конструктором
  }

  if (safeLayout === "table") {
    await renderTableLayout(doc, invitesByGroup, { title, footer });
  } else {
    await renderCardLayout(doc, invitesByGroup, { title, footer });
  }

  doc.end();
  await done;
  let resultBuffer = Buffer.concat(chunks);

  // Если letterhead — PDF, делаем overlay через pdf-lib.
  if (letterhead && letterhead.mimetype === "application/pdf") {
    try {
      resultBuffer = await overlayPdfLetterhead(resultBuffer, letterhead.buffer);
    } catch (error) {
      // ignore — возвращаем PDF без letterhead, но не падаем
      console.warn("[inviteDocumentService] PDF letterhead overlay failed:", error.message);
    }
  }

  return resultBuffer;
}

function createImportError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  TEMPLATE_HEADERS,
  DEFAULT_TTL_MINUTES,
  SUPPORTED_LAYOUTS,
  buildTemplateXlsx,
  parseTemplateXlsx,
  findExistingSessionUserId,
  findOrCreateGroup,
  createBulkInvites,
  renderInvitesPdf,
};
