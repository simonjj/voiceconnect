// Application Insights — Tier 1 auto-instrumentation for the Twilio bridge.
// Uses createRequire to access applicationinsights v2 via CJS interop, which
// avoids ESM namespace-binding issues where defaultClient appears undefined.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
const role = process.env.AI_CLOUD_ROLE || "orbconnect-twilio-bridge";

if (conn) {
  try {
    const appInsights = require("applicationinsights");
    appInsights
      .setup(conn)
      .setAutoCollectRequests(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectConsole(true, false)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(false)
      .start();
    const client = appInsights.defaultClient;
    if (client && client.context && client.context.tags && client.context.keys) {
      client.context.tags[client.context.keys.cloudRole] = role;
    }
    console.log(`[telemetry] Application Insights initialized as ${role}`);
  } catch (e) {
    console.warn(`[telemetry] init failed: ${e?.message || e}; continuing without telemetry`);
  }
} else {
  console.log("[telemetry] APPLICATIONINSIGHTS_CONNECTION_STRING not set; skipping");
}
