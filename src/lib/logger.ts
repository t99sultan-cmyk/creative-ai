/**
 * Lightweight structured logger.
 *
 * Goal: replace ad-hoc `console.error("[generate-site] ...")` calls
 * with a single structured format that Vercel logs can grep on, and
 * that's trivial to swap for Sentry / Datadog / Logtail later.
 *
 * Output shape (one line of JSON per event):
 *   {"ts":"2026-...","level":"info","scope":"generate-site","event":"start","userId":"...","meta":{...}}
 *
 * Vercel surfaces these in Function Logs and they're searchable by any
 * field. When we wire up Sentry, the `error` channel becomes Sentry
 * captureException; everything else becomes breadcrumbs.
 *
 * Usage:
 *   const log = makeLogger("generate-site");
 *   log.info("start", { userId, sectionCount });
 *   log.warn("image_slot_failed", { token, error: e.message });
 *   log.error("claude_call_failed", { userId, error: e.message }, e);
 *
 * Don't pass full HTML, image data, or PII into meta — keep payloads
 * small. For sensitive data, hash or redact at the call site.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEvent {
  ts: string;
  level: LogLevel;
  scope: string;
  event: string;
  userId?: string;
  meta?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

function emit(e: LogEvent) {
  // Single-line JSON — `console.log` is the vehicle Vercel uses for
  // both stdout and stderr, so we send via the matching channel.
  const line = JSON.stringify(e);
  if (e.level === "error") console.error(line);
  else if (e.level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  // All three accept an optional error/exception as the third arg —
  // even info/warn can carry context for a recoverable exception
  // (e.g., image-slot timeout that fell back to placeholder, fail-soft
  // path the user shouldn't see but we want logged).
  info(event: string, meta?: Record<string, unknown>, err?: unknown): void;
  warn(event: string, meta?: Record<string, unknown>, err?: unknown): void;
  error(event: string, meta?: Record<string, unknown>, err?: unknown): void;
  withUser(userId: string): Logger;
}

export function makeLogger(scope: string, baseUserId?: string): Logger {
  const make = (level: LogLevel) => (event: string, meta?: Record<string, unknown>, err?: unknown) => {
    const e: LogEvent = {
      ts: new Date().toISOString(),
      level,
      scope,
      event,
      userId: baseUserId,
      meta,
    };
    if (err instanceof Error) {
      e.error = { name: err.name, message: err.message, stack: err.stack };
    } else if (err !== undefined) {
      e.error = { name: "non-Error", message: String(err) };
    }
    emit(e);
  };
  return {
    info: make("info"),
    warn: make("warn"),
    error: make("error"),
    withUser(userId: string): Logger {
      return makeLogger(scope, userId);
    },
  };
}
