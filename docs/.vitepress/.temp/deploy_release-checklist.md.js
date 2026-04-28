import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Release checklist","description":"","frontmatter":{},"headers":[],"relativePath":"deploy/release-checklist.md","filePath":"deploy/release-checklist.md","lastUpdated":null}');
const _sfc_main = { name: "deploy/release-checklist.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="release-checklist" tabindex="-1">Release checklist <a class="header-anchor" href="#release-checklist" aria-label="Permalink to &quot;Release checklist&quot;">​</a></h1><h2 id="перед-релизом" tabindex="-1">Перед релизом <a class="header-anchor" href="#перед-релизом" aria-label="Permalink to &quot;Перед релизом&quot;">​</a></h2><ul><li>[ ] <code>npm run build</code></li><li>[ ] <code>npm run build-storybook</code></li><li>[ ] <code>npm run docs:check</code></li><li>[ ] <code>npm run docs:build</code></li><li>[ ] README / TODO / docs обновлены вместе с изменением поведения</li><li>[ ] подготовлен release tag Docker-образа</li><li>[ ] зафиксирован план smoke после выката</li></ul><h2 id="сборка-и-публикация-образа" tabindex="-1">Сборка и публикация образа <a class="header-anchor" href="#сборка-и-публикация-образа" aria-label="Permalink to &quot;Сборка и публикация образа&quot;">​</a></h2><ul><li>[ ] <code>docker build -t prowega/newdiary:&lt;tag&gt; -t prowega/newdiary:latest .</code></li><li>[ ] <code>docker push prowega/newdiary:&lt;tag&gt;</code></li><li>[ ] <code>docker push prowega/newdiary:latest</code></li><li>[ ] tag образа сохранён в release note / задаче</li></ul><h2 id="выкат-на-сервер" tabindex="-1">Выкат на сервер <a class="header-anchor" href="#выкат-на-сервер" aria-label="Permalink to &quot;Выкат на сервер&quot;">​</a></h2><ul><li>[ ] в <code>.env.docker</code> обновлён <code>APP_IMAGE</code> на точный tag</li><li>[ ] <code>sudo docker compose --env-file .env.docker pull</code></li><li>[ ] <code>sudo docker compose --env-file .env.docker up -d</code></li><li>[ ] просмотрены <code>app</code> logs</li><li>[ ] <code>curl http://127.0.0.1:4000/api/health</code></li></ul><h2 id="smoke-после-выката" tabindex="-1">Smoke после выката <a class="header-anchor" href="#smoke-после-выката" aria-label="Permalink to &quot;Smoke после выката&quot;">​</a></h2><ul><li>[ ] admin может войти</li><li>[ ] organizer видит заезд и программу</li><li>[ ] participant открывает дневник</li><li>[ ] curator открывает dashboard</li><li>[ ] нет неожиданных 500/403 в основных сценариях</li></ul><h2 id="если-нужен-rollback" tabindex="-1">Если нужен rollback <a class="header-anchor" href="#если-нужен-rollback" aria-label="Permalink to &quot;Если нужен rollback&quot;">​</a></h2><ul><li>[ ] выбран предыдущий стабильный image tag</li><li>[ ] <code>APP_IMAGE</code> возвращён на этот tag</li><li>[ ] выполнены <code>pull</code> + <code>up -d</code></li><li>[ ] повторён smoke-check</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("deploy/release-checklist.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const releaseChecklist = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  releaseChecklist as default
};
