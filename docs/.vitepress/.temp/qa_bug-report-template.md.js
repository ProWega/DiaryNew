import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Bug report template","description":"","frontmatter":{},"headers":[],"relativePath":"qa/bug-report-template.md","filePath":"qa/bug-report-template.md","lastUpdated":null}');
const _sfc_main = { name: "qa/bug-report-template.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="bug-report-template" tabindex="-1">Bug report template <a class="header-anchor" href="#bug-report-template" aria-label="Permalink to &quot;Bug report template&quot;">​</a></h1><p>Используйте этот шаблон для каждого найденного дефекта.</p><h2 id="заголовок" tabindex="-1">Заголовок <a class="header-anchor" href="#заголовок" aria-label="Permalink to &quot;Заголовок&quot;">​</a></h2><p>Коротко: что сломано и в каком контуре.</p><p>Пример: <code>Participant / Состояние / не сохраняется комментарий после выбора события</code></p><h2 id="среда" tabindex="-1">Среда <a class="header-anchor" href="#среда" aria-label="Permalink to &quot;Среда&quot;">​</a></h2><ul><li>image tag / commit:</li><li>URL:</li><li>роль:</li><li>sessionId:</li><li>groupId:</li><li>пользователь:</li><li>устройство / ОС:</li><li>браузер:</li></ul><h2 id="шаги-воспроизведения" tabindex="-1">Шаги воспроизведения <a class="header-anchor" href="#шаги-воспроизведения" aria-label="Permalink to &quot;Шаги воспроизведения&quot;">​</a></h2><ol><li></li><li></li><li></li></ol><h2 id="ожидаемое-поведение" tabindex="-1">Ожидаемое поведение <a class="header-anchor" href="#ожидаемое-поведение" aria-label="Permalink to &quot;Ожидаемое поведение&quot;">​</a></h2><p>Что должно было произойти.</p><h2 id="фактическое-поведение" tabindex="-1">Фактическое поведение <a class="header-anchor" href="#фактическое-поведение" aria-label="Permalink to &quot;Фактическое поведение&quot;">​</a></h2><p>Что произошло на самом деле.</p><h2 id="артефакты" tabindex="-1">Артефакты <a class="header-anchor" href="#артефакты" aria-label="Permalink to &quot;Артефакты&quot;">​</a></h2><ul><li>скриншот / запись экрана</li><li>текст ошибки</li><li>выдержка из <code>app</code> logs</li><li>console/network при необходимости</li></ul><h2 id="дополнительно" tabindex="-1">Дополнительно <a class="header-anchor" href="#дополнительно" aria-label="Permalink to &quot;Дополнительно&quot;">​</a></h2><ul><li>повторяется ли стабильно;</li><li>воспроизводится ли только на mobile;</li><li>связано ли с конкретной ролью, группой или днём программы.</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("qa/bug-report-template.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const bugReportTemplate = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  bugReportTemplate as default
};
