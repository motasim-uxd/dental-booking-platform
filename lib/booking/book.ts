import type { BookingContext } from "@/lib/booking/context";
import { isOperatoryAllowedForApptType } from "@/lib/pms/operatory-rules";
import { BookSchema } from "@/lib/schemas";

export function errorBookPayload(message: string, details?: unknown) {
  return { success: false as const, error: details ?? { message } };
}

export async function handleBook(ctx: BookingContext, body: unknown) {
  const parsed = BookSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400 as const,
      body: { success: false as const, error: parsed.error.flatten() },
    };
  }

  if (
    !isOperatoryAllowedForApptType(
      parsed.data.operatoryId,
      parsed.data.apptType,
      ctx.operatoryRules
    )
  ) {
    return {
      status: 400 as const,
      body: {
        success: false as const,
        error: {
          message:
            "That room is not available for this appointment type. Please choose another time.",
        },
      },
    };
  }

  const result = await ctx.adapter.bookAppointment({
    apptType: parsed.data.apptType,
    date: parsed.data.date,
    start: {
      hour: parsed.data.start.hour,
      minute: parsed.data.start.minute,
      second: parsed.data.start.second,
      millis: parsed.data.start.millis,
    },
    end: {
      hour: parsed.data.end.hour,
      minute: parsed.data.end.minute,
      second: parsed.data.end.second,
      millis: parsed.data.end.millis,
    },
    dayOfWeek: parsed.data.dayOfWeek,
    operatoryId: parsed.data.operatoryId,
    oralId: parsed.data.oralId,
    reason: parsed.data.reason,
    notes: parsed.data.notes,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    preferredName: parsed.data.preferredName,
    dob: parsed.data.dob,
    email: parsed.data.email,
    phoneNumber: parsed.data.phoneNumber,
    newOrExisting: parsed.data.newOrExisting,
  });

  return { status: 200 as const, body: { success: true as const, data: result } };
}
