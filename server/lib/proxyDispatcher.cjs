"use strict";

/**
 * Универсальный proxy-dispatcher для fetch-based SDK (Anthropic, OpenAI).
 *
 * Поддерживает HTTP/HTTPS и SOCKS4/5 прокси:
 *  • http(s)://user:pass@host:port → undici ProxyAgent
 *  • socks5://user:pass@host:port  → socks-proxy-agent → undici Agent (bridge)
 *
 * Возвращает undici-совместимый dispatcher или null если url пуст. Подаётся в
 * SDK через custom `fetch` (см. llmClient.cjs).
 *
 * Ленивый require внутри веток — undici/socks-proxy-agent подтягиваются только
 * когда proxy реально нужен.
 */

function buildProxyDispatcher(proxyUrl) {
  if (!proxyUrl) return null;
  const isSocks = /^socks[45]?:\/\//i.test(proxyUrl);

  if (isSocks) {
    const { Agent } = require("undici");
    const { SocksProxyAgent } = require("socks-proxy-agent");
    const socksAgent = new SocksProxyAgent(proxyUrl);

    // Bridge: undici Agent#connect зовётся с {host, port, protocol, ...} от
    // dispatcher'а. socks-proxy-agent.connect() ожидает второй arg в
    // http.Agent shape — host/port/secureEndpoint/servername. Конвертируем.
    return new Agent({
      connect: async (opts, callback) => {
        try {
          const host = opts.host || opts.hostname;
          const port = Number(opts.port);
          const isHttps = String(opts.protocol || "").toLowerCase() === "https:";
          if (!host || !port) {
            throw new Error(`SOCKS proxy bridge: missing host/port (host=${host}, port=${port})`);
          }
          const socket = await socksAgent.connect(
            // first arg is "req"; передаём пустой объект, socks-proxy-agent
            // считывает destination только из второго arg.
            {},
            { host, port, secureEndpoint: isHttps, servername: host, ...opts },
          );
          callback(null, socket);
        } catch (error) {
          callback(error);
        }
      },
    });
  }

  const { ProxyAgent } = require("undici");
  return new ProxyAgent(proxyUrl);
}

module.exports = {
  buildProxyDispatcher,
};
