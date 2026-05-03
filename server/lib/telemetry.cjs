"use strict";

/**
 * OpenTelemetry bootstrap.
 *
 * Opt-in: only initializes when OTEL_EXPORTER_OTLP_ENDPOINT is set. Without
 * the endpoint, this module is a no-op so dev/test runs aren't slowed by
 * instrumentation that has nowhere to send data.
 *
 * Tests skip this entirely (NODE_ENV=test).
 *
 * To enable locally:
 *   $env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
 *   $env:OTEL_SERVICE_NAME="newdiary-api"
 *
 * Spin up a local collector (Jaeger / Tempo / OTel collector) at port 4318
 * to visualize traces. Auto-instrumentation hooks Express, HTTP, and pg
 * automatically — no per-route code needed.
 */

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const isTest = process.env.NODE_ENV === "test";

if (endpoint && !isTest) {
  const { NodeSDK } = require("@opentelemetry/sdk-node");

  const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");

  const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || "newdiary-api",
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint.replace(/\/$/, "")}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs instrumentation is noisy and rarely useful for an API server
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on("SIGTERM", () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}

module.exports = {};
