import type { BookingContext } from "@/lib/booking/context";
import {
  coerceScheduleSlots,
  filterAvailabilityWithFallback,
  resolveOralIdFromSlot,
  scheduleApptTypeForOryxQuery,
  shouldFallbackScheduleApptType,
} from "@/lib/pms/operatory-rules";
import { getAvailability, isFastApiConfigured } from "@/lib/booking/fastapi-client";
import { AvailabilityQuerySchema } from "@/lib/schemas";

function getDayOfWeekFromISO(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.getDay();
}

export function errorPayload(message: string, details?: unknown) {
  return { success: false as const, error: message, details };
}

export async function handleAvailability(
  ctx: BookingContext,
  query: { date: string; apptType?: string; firstAvail?: string | boolean }
) {
  const parsed = AvailabilityQuerySchema.safeParse({
    date: query.date,
    apptType: query.apptType,
    firstAvail: query.firstAvail,
  });

  if (!parsed.success) {
    return { status: 400 as const, body: errorPayload("Invalid query", parsed.error.flatten()) };
  }

  const apptType = parsed.data.apptType || "Cleaning";
  const firstAvail = parsed.data.firstAvail ?? false;

  if (ctx.integrationMode === "internal_only" && isFastApiConfigured()) {
    const fa = await getAvailability({
      tenantSlug: ctx.tenant.slug,
      date: parsed.data.date,
      apptType,
      firstAvail,
    });
    if (!fa.success) {
      return { status: 502 as const, body: errorPayload(fa.error ?? "Availability failed") };
    }
    return { status: 200 as const, body: { success: true as const, data: fa.data ?? [] } };
  }

  const rules = ctx.operatoryRules;

  const providerIdToOralId = new Map<number, number>();
  const ingestProviders = (res: unknown) => {
    const pr = res as { success?: boolean; obj?: unknown[] };
    if (!pr?.success || !Array.isArray(pr?.obj)) return;
    for (const p of pr.obj) {
      const providerId = Number((p as { providerId?: number })?.providerId);
      const oralId = Number((p as { id?: number })?.id);
      if (Number.isFinite(providerId) && Number.isFinite(oralId)) {
        providerIdToOralId.set(providerId, oralId);
      }
    }
  };

  try {
    ingestProviders(await ctx.adapter.getProviders(apptType));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upstream providers request failed";
    return { status: 502 as const, body: errorPayload(msg) };
  }
  try {
    ingestProviders(await ctx.adapter.getProviders("Cleaning"));
  } catch {
    // widen oralId mapping
  }

  const dayOfWeek = getDayOfWeekFromISO(parsed.data.date);
  const normalizeRows = (raw: unknown) =>
    coerceScheduleSlots(raw).map((row) => {
      const s = row as {
        date?: unknown;
        dayName?: unknown;
        operatoryId?: unknown;
        providerId?: unknown;
        oralId?: unknown;
        startTime?: { hour?: unknown; minute?: unknown };
        endTime?: { hour?: unknown; minute?: unknown };
        mins?: unknown;
      };
      const providerId = Number(s?.providerId);
      const startTime = s?.startTime;
      const endTime = s?.endTime;
      return {
        date: s?.date,
        dayName: s?.dayName,
        dayOfWeek,
        operatoryId: Number(s?.operatoryId),
        providerId,
        oralId: resolveOralIdFromSlot(s, providerIdToOralId),
        start: {
          hour: Number(startTime?.hour),
          minute: Number(startTime?.minute),
          second: 0,
          millis: 0,
        },
        end: {
          hour: Number(endTime?.hour),
          minute: Number(endTime?.minute),
          second: 0,
          millis: 0,
        },
        mins: Number(s?.mins),
      };
    });

  const fetchSchedule = async (scheduleApptType: string) =>
    ctx.adapter.getAvailability({
      apptType: scheduleApptType,
      dateISO: parsed.data.date,
      firstAvail,
    });

  let slots: unknown;
  try {
    slots = await fetchSchedule(apptType);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upstream schedule request failed";
    return { status: 502 as const, body: errorPayload(msg) };
  }

  const normalizeFiltered = (raw: unknown) =>
    filterAvailabilityWithFallback(
      normalizeRows(raw).filter((r) => Number.isFinite(r.operatoryId)),
      apptType,
      rules
    ).filter((r) => r.oralId != null && Number(r.oralId) > 0);

  let filtered = normalizeFiltered(slots);

  if (!filtered.length && shouldFallbackScheduleApptType(apptType)) {
    const fallbackType = scheduleApptTypeForOryxQuery(apptType);
    if (fallbackType !== apptType) {
      try {
        slots = await fetchSchedule(fallbackType);
        filtered = normalizeFiltered(slots);
      } catch {
        // keep empty
      }
    }
  }

  return { status: 200 as const, body: { success: true as const, data: filtered } };
}
