import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Smoke checklist","description":"","frontmatter":{},"headers":[],"relativePath":"qa/smoke-checklist.md","filePath":"qa/smoke-checklist.md","lastUpdated":null}');
const _sfc_main = { name: "qa/smoke-checklist.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="smoke-checklist" tabindex="-1">Smoke checklist <a class="header-anchor" href="#smoke-checklist" aria-label="Permalink to &quot;Smoke checklist&quot;">​</a></h1><p>Используйте этот чек-лист после каждого server deploy.</p><h2 id="общая-проверка-среды" tabindex="-1">Общая проверка среды <a class="header-anchor" href="#общая-проверка-среды" aria-label="Permalink to &quot;Общая проверка среды&quot;">​</a></h2><ul><li>[ ] сервер отвечает на <code>curl http://127.0.0.1:4000/api/health</code></li><li>[ ] <code>postgresOk: true</code></li><li>[ ] приложение открывается по публичному домену</li><li>[ ] нет критических ошибок в <code>docker compose logs -f app</code></li></ul><h2 id="admin" tabindex="-1">Admin <a class="header-anchor" href="#admin" aria-label="Permalink to &quot;Admin&quot;">​</a></h2><ul><li>[ ] администратор входит по magic link</li><li>[ ] открывается <code>/admin/security</code></li><li>[ ] загружается список пользователей</li></ul><h2 id="organizer" tabindex="-1">Organizer <a class="header-anchor" href="#organizer" aria-label="Permalink to &quot;Organizer&quot;">​</a></h2><ul><li>[ ] organizer входит и открывает <code>/organizer/session/:sessionId</code></li><li>[ ] виден workspace заезда</li><li>[ ] вкладка <code>Программа</code> загружается</li><li>[ ] publish/draft кнопки и session settings не падают в ошибку</li></ul><h2 id="participant" tabindex="-1">Participant <a class="header-anchor" href="#participant" aria-label="Permalink to &quot;Participant&quot;">​</a></h2><ul><li>[ ] participant открывает <code>/participant/session/:sessionId/today</code></li><li>[ ] дневник загружается без пустого белого экрана</li><li>[ ] можно открыть событие и сохранить состояние</li><li>[ ] дневная рефлексия открывается и сохраняется</li><li>[ ] мобильная версия остаётся читаемой</li></ul><h2 id="curator" tabindex="-1">Curator <a class="header-anchor" href="#curator" aria-label="Permalink to &quot;Curator&quot;">​</a></h2><ul><li>[ ] curator открывает <code>/curator/session/:sessionId/group/:groupId</code></li><li>[ ] dashboard не падает в 500</li><li>[ ] графики и бриф к рефлексии отображаются</li><li>[ ] mobile layout не ломается</li></ul><h2 id="финальная-отметка" tabindex="-1">Финальная отметка <a class="header-anchor" href="#финальная-отметка" aria-label="Permalink to &quot;Финальная отметка&quot;">​</a></h2><ul><li>[ ] smoke пройден</li><li>[ ] если нет — заведены баги со ссылкой на tag образа</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("qa/smoke-checklist.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const smokeChecklist = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  smokeChecklist as default
};
