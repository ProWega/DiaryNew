import { ssrRenderAttrs, ssrRenderStyle } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Magic links и доступы","description":"","frontmatter":{},"headers":[],"relativePath":"ops/magic-links-and-access.md","filePath":"ops/magic-links-and-access.md","lastUpdated":null}');
const _sfc_main = { name: "ops/magic-links-and-access.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="magic-links-и-доступы" tabindex="-1">Magic links и доступы <a class="header-anchor" href="#magic-links-и-доступы" aria-label="Permalink to &quot;Magic links и доступы&quot;">​</a></h1><h2 id="первыи-администратор" tabindex="-1">Первый администратор <a class="header-anchor" href="#первыи-администратор" aria-label="Permalink to &quot;Первый администратор&quot;">​</a></h2><p>Если первый админ ещё не создан:</p><ol><li>убедитесь, что задан <code>SETUP_TOKEN</code>;</li><li>откройте <code>/setup/admin</code>;</li><li>создайте пользователя с ролью <code>admin</code>.</li></ol><h2 id="login-magic-link-для-существующего-админа" tabindex="-1">Login magic link для существующего админа <a class="header-anchor" href="#login-magic-link-для-существующего-админа" aria-label="Permalink to &quot;Login magic link для существующего админа&quot;">​</a></h2><p>На сервере:</p><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#005CC5", "--shiki-dark": "#79B8FF" })}">cd</span><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}"> /opt/newdiary</span></span>
<span class="line"></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#6F42C1", "--shiki-dark": "#B392F0" })}">sudo</span><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}"> docker</span><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}"> compose</span><span style="${ssrRenderStyle({ "--shiki-light": "#005CC5", "--shiki-dark": "#79B8FF" })}"> --env-file</span><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}"> .env.docker</span><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}"> exec</span><span style="${ssrRenderStyle({ "--shiki-light": "#005CC5", "--shiki-dark": "#79B8FF" })}"> -T</span><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}"> app</span><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}"> node</span><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}"> -</span><span style="${ssrRenderStyle({ "--shiki-light": "#D73A49", "--shiki-dark": "#F97583" })}"> &lt;&lt;</span><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">&#39;NODE&#39;</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">const { query } = require(&#39;./server/db/postgres.cjs&#39;);</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">const { createMagicLink } = require(&#39;./server/db/repositories/authStore.cjs&#39;);</span></span>
<span class="line"></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">(async () =&gt; {</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  const result = await query(\`</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    select id, full_name, email</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    from users</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    where role = &#39;admin&#39; and status = &#39;active&#39;</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    order by created_at</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    limit 1</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  \`);</span></span>
<span class="line"></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  const admin = result.rows[0];</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  if (!admin) {</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    throw new Error(&#39;No active admin found&#39;);</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  }</span></span>
<span class="line"></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  const link = await createMagicLink({</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    creatorId: admin.id,</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    purpose: &#39;login&#39;,</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    targetUserId: admin.id,</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    ttlMinutes: 30,</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">    meta: { source: &#39;manual-server-login&#39; },</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  });</span></span>
<span class="line"></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  console.log(\`Admin: \${admin.full_name} &lt;\${admin.email || &#39;no-email&#39;}&gt;\`);</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  console.log(link.url);</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  process.exit(0);</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">})().catch((error) =&gt; {</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  console.error(error.message || error);</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">  process.exit(1);</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">});</span></span>
<span class="line"><span style="${ssrRenderStyle({ "--shiki-light": "#032F62", "--shiki-dark": "#9ECBFF" })}">NODE</span></span></code></pre></div><h2 id="invite-links-для-участников-и-кураторов" tabindex="-1">Invite links для участников и кураторов <a class="header-anchor" href="#invite-links-для-участников-и-кураторов" aria-label="Permalink to &quot;Invite links для участников и кураторов&quot;">​</a></h2><p>Логика проекта:</p><ul><li><code>invite</code> link создаёт аккаунт при первом входе;</li><li>участник и куратор привязываются к <code>sessionId</code> / <code>groupId</code>;</li><li>куратор привязывается к группе session-scoped.</li></ul><p>Для массовых рассылок лучше готовить batch-скрипт под конкретный заезд и группы, а не вручную копировать десятки one-liner команд.</p><h2 id="базовые-правила-безопасности" tabindex="-1">Базовые правила безопасности <a class="header-anchor" href="#базовые-правила-безопасности" aria-label="Permalink to &quot;Базовые правила безопасности&quot;">​</a></h2><ul><li>magic link одноразовый;</li><li>указывайте разумный TTL;</li><li>не пересылайте admin login links в общие чаты;</li><li>используйте корректный <code>APP_BASE_URL</code>, иначе ссылка может собраться на <code>localhost</code>.</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("ops/magic-links-and-access.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const magicLinksAndAccess = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  magicLinksAndAccess as default
};
