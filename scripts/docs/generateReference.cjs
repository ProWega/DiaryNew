const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..", "..");
const isCheckMode = process.argv.includes("--check");

const ENV_METADATA = {
  PORT: "Порт локального backend-сервера.",
  HOST: "Интерфейс, на котором слушает Express.",
  APP_MODE: "Режим приложения: development или production.",
  APP_BASE_URL: "Публичный базовый URL, по которому собираются magic links и cookie-политика.",
  AUTH_SESSION_SECRET: "Секрет для подписи auth session и magic link token hash.",
  AUTH_SESSION_TTL_DAYS: "Срок жизни cookie-сессии в днях.",
  AUTH_COOKIE_NAME: "Имя auth-cookie.",
  AUTH_COOKIE_SECURE: "Флаг secure-cookie. Для production должен быть true под HTTPS.",
  AUTH_COOKIE_SAMESITE: "Политика SameSite для auth-cookie.",
  SETUP_TOKEN: "Токен для первого администратора на /setup/admin.",
  MAGIC_LINK_TTL_MINUTES: "Срок жизни magic link в минутах.",
  ALLOW_DEMO_SEED: "Разрешение на seed демо-данных. В production должен оставаться false.",
  DATABASE_URL: "Полная строка подключения к PostgreSQL. Альтернатива набору PG* переменных.",
  PGHOST: "Хост PostgreSQL.",
  PGPORT: "Порт PostgreSQL.",
  PGDATABASE: "Имя базы PostgreSQL.",
  PGUSER: "Пользователь PostgreSQL.",
  PGPASSWORD: "Пароль пользователя PostgreSQL.",
  PGSSL: "Использовать ли SSL при подключении к PostgreSQL.",
  APP_IMAGE: "Docker image, который будет pulled на сервере. Для релизов рекомендуем pin на точный tag.",
  APP_PORT: "Внешний порт сервиса app на сервере.",
  POSTGRES_DB: "Имя production-базы внутри docker compose.",
  POSTGRES_USER: "Пользователь production-базы внутри docker compose.",
  POSTGRES_PASSWORD: "Пароль production-базы внутри docker compose.",
};

const SCRIPT_METADATA = {
  dev: "Поднимает frontend и backend локально одной командой.",
  "dev:client": "Стартует Vite dev server.",
  "dev:server": "Стартует Express через nodemon.",
  "start:server": "Запускает Express без nodemon.",
  "db:schema": "Применяет server/sql/schema.sql к текущей PostgreSQL.",
  "db:seed": "Заполняет базу демо-данными.",
  "db:reset": "Сбрасывает схему базы и создаёт её заново.",
  "db:check": "Проверяет состояние таблиц и подключения.",
  "prod:init": "Production init перед стартом контейнера: сейчас это применение схемы.",
  build: "Собирает production frontend через Vite.",
  storybook: "Запускает Storybook в dev-режиме.",
  "build-storybook": "Собирает статический Storybook.",
  preview: "Локально показывает production build frontend.",
  "docs:dev": "Запускает VitePress docs-site локально.",
  "docs:generate": "Пересобирает generated reference-страницы документации.",
  "docs:build": "Собирает статический docs-site.",
  "docs:preview": "Показывает локально собранный docs-site.",
  "docs:check": "Проверяет, что generated docs не устарели относительно исходников.",
};

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function normalizeText(value) {
  return String(value).replace(/\r\n/g, "\n");
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function formatCode(value) {
  if (!value) {
    return "-";
  }
  return `\`${String(value).replace(/`/g, "\\`")}\``;
}

function parseEnvFile(relativePath) {
  const lines = normalizeText(readText(relativePath)).split("\n");
  const entries = [];
  let commentBuffer = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      commentBuffer = [];
      continue;
    }

    if (trimmed.startsWith("#")) {
      commentBuffer.push(trimmed.replace(/^#\s?/, ""));
      continue;
    }

    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      commentBuffer = [];
      continue;
    }

    const [, key, rawValue] = match;
    entries.push({
      key,
      value: rawValue,
      notes: ENV_METADATA[key] || commentBuffer.join(" ") || "Без дополнительного описания.",
    });
    commentBuffer = [];
  }

  return entries;
}

function renderEnvSection(title, relativePath, entries) {
  const rows = entries
    .map(
      (entry) =>
        `| ${formatCode(entry.key)} | ${formatCode(entry.value)} | ${escapeCell(entry.notes)} |`,
    )
    .join("\n");

  return `## ${title}\n\nИсточник: \`${relativePath}\`\n\n| Переменная | Пример / default | Назначение |\n| --- | --- | --- |\n${rows}\n`;
}

function renderEnvironmentPage() {
  const localEntries = parseEnvFile(".env.example");
  const deployEntries = parseEnvFile("deploy/app.env.example");

  return `# Переменные окружения\n\n> Этот файл собирается командой \`npm run docs:generate\`. Правьте \`.env.example\`, \`deploy/app.env.example\` или генератор в \`scripts/docs/generateReference.cjs\`.\n\n${renderEnvSection("Локальная разработка", ".env.example", localEntries)}\n${renderEnvSection("Ubuntu / Docker deploy", "deploy/app.env.example", deployEntries)}\n`;
}

function categorizeScript(name) {
  if (name.startsWith("docs:")) {
    return "Документация";
  }
  if (name.startsWith("db:") || name === "prod:init") {
    return "База данных и production init";
  }
  if (name === "build" || name === "storybook" || name === "build-storybook") {
    return "Сборка и UI";
  }
  if (name.startsWith("dev") || name === "start:server" || name === "preview") {
    return "Локальная разработка";
  }
  return "Прочее";
}

function renderScriptsPage() {
  const packageJson = JSON.parse(readText("package.json"));
  const groups = new Map();

  for (const [name, command] of Object.entries(packageJson.scripts || {})) {
    const category = categorizeScript(name);
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category).push({
      name,
      command,
      notes: SCRIPT_METADATA[name] || "Пользовательский script проекта.",
    });
  }

  const sections = Array.from(groups.entries())
    .map(([title, items]) => {
      const rows = items
        .map(
          (item) =>
            `| ${formatCode(item.name)} | ${formatCode(item.command)} | ${escapeCell(item.notes)} |`,
        )
        .join("\n");

      return `## ${title}\n\n| Script | Команда | Назначение |\n| --- | --- | --- |\n${rows}\n`;
    })
    .join("\n");

  return `# NPM Scripts\n\n> Этот файл собирается командой \`npm run docs:generate\`. Источник правды — \`package.json\` и генератор в \`scripts/docs/generateReference.cjs\`.\n\n${sections}`;
}

function buildGeneratedFiles() {
  return [
    {
      relativePath: path.join("docs", "reference", "environment.md"),
      content: renderEnvironmentPage(),
    },
    {
      relativePath: path.join("docs", "reference", "scripts.md"),
      content: renderScriptsPage(),
    },
  ];
}

function writeFiles(files) {
  for (const file of files) {
    const targetPath = path.join(rootDir, file.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${normalizeText(file.content).trim()}\n`, "utf8");
  }
}

function checkFiles(files) {
  const staleFiles = [];

  for (const file of files) {
    const targetPath = path.join(rootDir, file.relativePath);
    const expected = `${normalizeText(file.content).trim()}\n`;
    const actual = fs.existsSync(targetPath) ? normalizeText(fs.readFileSync(targetPath, "utf8")) : "";
    if (actual !== expected) {
      staleFiles.push(file.relativePath);
    }
  }

  if (staleFiles.length) {
    console.error("Generated docs are outdated. Re-run: npm run docs:generate");
    for (const file of staleFiles) {
      console.error(` - ${file}`);
    }
    process.exit(1);
  }
}

const files = buildGeneratedFiles();

if (isCheckMode) {
  checkFiles(files);
} else {
  writeFiles(files);
  console.log("Generated docs/reference pages.");
}
