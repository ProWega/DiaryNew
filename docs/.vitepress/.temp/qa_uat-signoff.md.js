import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"UAT sign-off","description":"","frontmatter":{},"headers":[],"relativePath":"qa/uat-signoff.md","filePath":"qa/uat-signoff.md","lastUpdated":null}');
const _sfc_main = { name: "qa/uat-signoff.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="uat-sign-off" tabindex="-1">UAT sign-off <a class="header-anchor" href="#uat-sign-off" aria-label="Permalink to &quot;UAT sign-off&quot;">​</a></h1><h2 id="релиз" tabindex="-1">Релиз <a class="header-anchor" href="#релиз" aria-label="Permalink to &quot;Релиз&quot;">​</a></h2><ul><li>дата:</li><li>image tag:</li><li>среда:</li><li>ответственный за выкладку:</li><li>ответственный за UAT:</li></ul><h2 id="что-проверено" tabindex="-1">Что проверено <a class="header-anchor" href="#что-проверено" aria-label="Permalink to &quot;Что проверено&quot;">​</a></h2><ul><li>[ ] admin</li><li>[ ] organizer</li><li>[ ] participant desktop</li><li>[ ] participant mobile</li><li>[ ] curator desktop</li><li>[ ] curator mobile</li></ul><h2 id="замечания" tabindex="-1">Замечания <a class="header-anchor" href="#замечания" aria-label="Permalink to &quot;Замечания&quot;">​</a></h2><p>Перечень допущенных ограничений или известных минорных дефектов.</p><h2 id="итог" tabindex="-1">Итог <a class="header-anchor" href="#итог" aria-label="Permalink to &quot;Итог&quot;">​</a></h2><ul><li>[ ] Готово к использованию</li><li>[ ] Готово с оговорками</li><li>[ ] Не готово, нужен rollback / доработка</li></ul><h2 id="подписи" tabindex="-1">Подписи <a class="header-anchor" href="#подписи" aria-label="Permalink to &quot;Подписи&quot;">​</a></h2><ul><li>продукт / заказчик:</li><li>QA:</li><li>разработка:</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("qa/uat-signoff.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const uatSignoff = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  uatSignoff as default
};
