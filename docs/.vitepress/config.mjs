import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "ru-RU",
  title: "NewDiary Docs",
  description: "Продуктовая, эксплуатационная и QA-документация проекта NewDiary.",
  lastUpdated: true,
  cleanUrls: true,
  // Architecture docs link to source files (../../src/..., ../../server/...).
  // These are valid filesystem paths but VitePress can't render them as pages.
  ignoreDeadLinks: [/(^|\/)\.\.\/\.\.\//, /\.(jsx?|tsx?|cjs|mjs)$/],
  themeConfig: {
    nav: [
      { text: "Обзор", link: "/" },
      { text: "Деплой", link: "/deploy/ubuntu-docker" },
      { text: "QA", link: "/qa/playbook" },
      { text: "Архитектура", link: "/architecture/overview" },
      { text: "Reference", link: "/reference/environment" },
    ],
    search: {
      provider: "local",
    },
    outline: {
      level: [2, 3],
      label: "На странице",
    },
    sidebar: [
      {
        text: "Старт",
        items: [
          { text: "Обзор", link: "/" },
          { text: "Локальный запуск", link: "/getting-started/local-setup" },
          { text: "Первый администратор и auth", link: "/getting-started/first-admin-and-auth" },
        ],
      },
      {
        text: "Продукт",
        items: [{ text: "Роли и ключевые сценарии", link: "/product/roles-and-flows" }],
      },
      {
        text: "Деплой",
        items: [
          { text: "Ubuntu + Docker", link: "/deploy/ubuntu-docker" },
          { text: "Release checklist", link: "/deploy/release-checklist" },
        ],
      },
      {
        text: "QA",
        items: [
          { text: "QA Playbook", link: "/qa/playbook" },
          { text: "Smoke checklist", link: "/qa/smoke-checklist" },
          { text: "Bug report template", link: "/qa/bug-report-template" },
          { text: "UAT sign-off", link: "/qa/uat-signoff" },
        ],
      },
      {
        text: "Ops",
        items: [
          { text: "Magic links и доступы", link: "/ops/magic-links-and-access" },
          { text: "Сервисные команды", link: "/ops/service-commands" },
        ],
      },
      {
        text: "Архитектура",
        items: [
          { text: "Обзор архитектуры", link: "/architecture/overview" },
          { text: "Backend и сервисы", link: "/architecture/backend-services" },
          { text: "Frontend stack", link: "/architecture/frontend-stack" },
          { text: "Миграции БД", link: "/architecture/migrations" },
          { text: "Безопасность", link: "/architecture/security" },
          { text: "Тестирование", link: "/architecture/testing" },
          { text: "Контур документации", link: "/architecture/documentation-workflow" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Переменные окружения", link: "/reference/environment" },
          { text: "NPM scripts", link: "/reference/scripts" },
          { text: "Маршруты и API", link: "/reference/routes-and-api" },
        ],
      },
    ],
  },
});
