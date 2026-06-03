// Application Insights — Tier 1 auto-instrumentation.
// MUST be imported before any HTTP/express/ws modules so the SDK can patch them.
// Using a dynamic require to keep CJS interop simple — applicationinsights v2
// mutates its own module.exports.defaultClient at runtime, which ESM namespace
// imports do not always reflect.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
const role = process.env.AI_CLOUD_ROLE || 'orbconnect-server';

if (conn) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appInsights = require('applicationinsights');
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
    // eslint-disable-next-line no-console
    console.log(`[telemetry] Application Insights initialized as ${role}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[telemetry] init failed: ${(e as Error).message}; continuing without telemetry`);
  }
} else {
  // eslint-disable-next-line no-console
  console.log('[telemetry] APPLICATIONINSIGHTS_CONNECTION_STRING not set; skipping');
}
