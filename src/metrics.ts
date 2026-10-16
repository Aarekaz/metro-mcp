import { sanitizeTelemetry, type TelemetryInput } from './telemetry';
import type { Env } from './types';

/**
 * Usage counting for honest public numbers ("tool calls and sessions per
 * week" instead of raw HTTP invocations). One Analytics Engine data point
 * per initialize and per tools/call request:
 *
 *   indexes: [sessionId]                ('' when the client sent none)
 *   blobs:   [method, toolName, clientName, environment, statusClass]
 *   doubles: [durationMs]
 *
 * Only telemetry-allowlisted fields are recorded: never tool arguments,
 * never request bodies, never IP addresses. Fire-and-forget by design —
 * a metrics failure must never affect a request, and the binding is
 * optional so local dev and tests run without it.
 */
export function recordMcpUsage(env: Env, telemetry: TelemetryInput): void {
  const dataset = env.ANALYTICS;
  if (!dataset) return;

  const safe = sanitizeTelemetry(telemetry);
  if (safe.mcpMethod !== 'tools/call' && safe.mcpMethod !== 'initialize') return;

  try {
    dataset.writeDataPoint({
      indexes: [safe.sessionId ?? ''],
      blobs: [
        safe.mcpMethod,
        safe.mcpName ?? '',
        safe.clientName ?? '',
        typeof env.ENVIRONMENT === 'string' ? env.ENVIRONMENT : '',
        safe.statusClass ?? '',
      ],
      doubles: [safe.durationMs ?? 0],
    });
  } catch {
    // Analytics is best-effort; swallow everything.
  }
}
