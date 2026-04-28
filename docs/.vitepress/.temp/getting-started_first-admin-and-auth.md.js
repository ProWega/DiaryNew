import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Первый администратор и auth","description":"","frontmatter":{},"headers":[],"relativePath":"getting-started/first-admin-and-auth.md","filePath":"getting-started/first-admin-and-auth.md","lastUpdated":null}');
const _sfc_main = { name: "getting-started/first-admin-and-auth.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="первыи-администратор-и-auth" tabindex="-1">Первый администратор и auth <a class="header-anchor" href="#первыи-администратор-и-auth" aria-label="Permalink to &quot;Первый администратор и auth&quot;">​</a></h1><h2 id="базовая-модель-доступа" tabindex="-1">Базовая модель доступа <a class="header-anchor" href="#базовая-модель-доступа" aria-label="Permalink to &quot;Базовая модель доступа&quot;">​</a></h2><p>В проекте есть четыре роли:</p><ul><li><code>participant</code></li><li><code>curator</code></li><li><code>organizer</code></li><li><code>admin</code></li></ul><p>Auth-контур основан на cookie sessions и magic links. Для production важны:</p><ul><li><code>AUTH_SESSION_SECRET</code></li><li><code>AUTH_COOKIE_SECURE</code></li><li><code>AUTH_COOKIE_SAMESITE</code></li><li><code>APP_BASE_URL</code></li></ul><h2 id="создание-первого-администратора" tabindex="-1">Создание первого администратора <a class="header-anchor" href="#создание-первого-администратора" aria-label="Permalink to &quot;Создание первого администратора&quot;">​</a></h2><ol><li>Задайте <code>SETUP_TOKEN</code> в <code>.env</code> или <code>.env.docker</code>.</li><li>Откройте страницу <code>/setup/admin</code>.</li><li>Введите setup token и данные пользователя.</li></ol><p>После создания первого админа этот маршрут больше не используется как основной входной поток.</p><h2 id="как-работает-вход-дальше" tabindex="-1">Как работает вход дальше <a class="header-anchor" href="#как-работает-вход-дальше" aria-label="Permalink to &quot;Как работает вход дальше&quot;">​</a></h2><ul><li>Админ может создавать login magic links.</li><li>Organizer и admin могут создавать invite magic links в рамках доступного заезда.</li><li>Invite link создаёт пользователя при первом входе и привязывает его к <code>sessionId</code> / <code>groupId</code>.</li></ul><h2 id="где-смотреть-служебные-команды" tabindex="-1">Где смотреть служебные команды <a class="header-anchor" href="#где-смотреть-служебные-команды" aria-label="Permalink to &quot;Где смотреть служебные команды&quot;">​</a></h2><ul><li><a href="/ops/magic-links-and-access">Magic links и доступы</a></li><li><a href="/ops/service-commands">Сервисные команды</a></li></ul><h2 id="практическое-правило" tabindex="-1">Практическое правило <a class="header-anchor" href="#практическое-правило" aria-label="Permalink to &quot;Практическое правило&quot;">​</a></h2><p>Для ручных операций на сервере используйте heredoc-команды через <code>docker compose exec -T app node - &lt;&lt;&#39;NODE&#39;</code>, а не one-liner с <code>!</code>, чтобы не ловить bash history expansion.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("getting-started/first-admin-and-auth.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const firstAdminAndAuth = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  firstAdminAndAuth as default
};
