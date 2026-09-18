/**
 * Timezone-aware date helpers built on native Intl. No extra dependency needed.
 *
 * Trade timestamps are stored as UTC ISO strings. Every place that needs to
 * know "what calendar day/wall-clock time is this" for a trader should go
 * through here with the app's configured timezone, rather than trusting the
 * browser's own timezone (which may not match where the trader actually
 * trades) or a naive UTC substring.
 */

export type TimezoneOption = { value: string; label: string };

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function allSupportedTimezones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (supported && supported.length > 0) return supported;
  } catch {
    // Fall through to the curated list below.
  }
  return COMMON_TIMEZONES;
}

export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function offsetLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value ?? "";
  } catch {
    return "";
  }
}

function offsetMinutes(timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
    const match = raw.match(/GMT([+-]\d+)(?::?(\d+))?/);
    if (!match) return 0;
    const sign = match[1].startsWith("-") ? -1 : 1;
    const hours = Math.abs(parseInt(match[1], 10));
    const mins = match[2] ? parseInt(match[2], 10) : 0;
    return sign * (hours * 60 + mins);
  } catch {
    return 0;
  }
}

/** Every IANA zone the runtime knows about, labeled with its current offset, sorted west-to-east. */
export function listTimezones(): TimezoneOption[] {
  const zones = Array.from(new Set([...COMMON_TIMEZONES, ...allSupportedTimezones()]));
  return zones
    .map((value) => ({
      value,
      label: `${value.replace(/_/g, " ")} (${offsetLabel(value)})`,
      minutes: offsetMinutes(value),
    }))
    .sort((a, b) => a.minutes - b.minutes || a.value.localeCompare(b.value))
    .map(({ value, label }) => ({ value, label }));
}

/** "YYYY-MM-DD" for the given UTC instant, as observed in `timeZone`. */
export function zonedDayKey(isoString: string, timeZone: string): string {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DDTHH:mm" wall-clock for the given UTC instant, as observed in `timeZone`. */
export function zonedWallClock(isoString: string, timeZone: string): string {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Converts a "YYYY-MM-DDTHH:mm" wall-clock string, understood as that time
 * *in `timeZone`*, to the matching UTC ISO instant. Uses the standard
 * double-conversion trick: guess UTC, see what that guess reads as in the
 * target zone, then correct by the difference (one correction is enough
 * except in the ~1hr/year DST-transition window, where a second pass fixes
 * the rare remaining edge case).
 */
export function wallClockToUtcIso(wallClock: string, timeZone: string): string {
  // The target wall-clock time, pretended to be UTC. This is our fixed reference point.
  const targetAsUtcMs = new Date(`${wallClock}:00.000Z`).getTime();
  let guessMs = targetAsUtcMs;

  for (let i = 0; i < 2; i++) {
    // What does the current guess actually read as, in the target zone?
    const observed = zonedWallClock(new Date(guessMs).toISOString(), timeZone);
    const observedAsUtcMs = new Date(`${observed}:00.000Z`).getTime();
    // The zone's current offset from UTC, expressed the same way as targetAsUtcMs.
    const offset = observedAsUtcMs - guessMs;
    const nextGuessMs = targetAsUtcMs - offset;
    if (nextGuessMs === guessMs) break;
    guessMs = nextGuessMs;
  }

  return new Date(guessMs).toISOString();
}

/** "Sep 16, 2026" style display, in the given timezone. */
export function formatZonedDate(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoString));
}

/** "Sep 16, 2026, 1:10 PM" style display, in the given timezone. */
export function formatZonedDateTime(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));
}

/** "1:10 PM" style display, in the given timezone. */
export function formatZonedTime(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));
}
