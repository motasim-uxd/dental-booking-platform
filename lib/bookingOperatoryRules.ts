/**
 * Smile Squad operatory rules (legacy entry point).
 *
 * New code should use tenant-scoped rules from `lib/pms/operatory-rules.ts`.
 * This module delegates to env-based rules for backward compatibility.
 */

import {
  coerceScheduleSlots,
  filterAvailabilityByApptType as filterByApptType,
  filterAvailabilityWithFallback as filterWithFallback,
  operatoryAllowSet as allowSet,
  operatoryDisplayLabel as displayLabel,
  operatoryRulesFromEnv,
  resolveOralIdFromSlot,
  scheduleApptTypeForOryxQuery,
  shouldFallbackScheduleApptType,
  treatmentOperatoryId as treatmentOpId,
  isOperatoryAllowedForApptType as isAllowed,
  DEFAULT_TREATMENT_OPERATORY_ID,
} from "@/lib/pms/operatory-rules";

export { DEFAULT_TREATMENT_OPERATORY_ID };

const legacyRules = () => operatoryRulesFromEnv();

export {
  scheduleApptTypeForOryxQuery,
  shouldFallbackScheduleApptType,
  coerceScheduleSlots,
  resolveOralIdFromSlot,
};

export function operatoryDisplayLabel(operatoryId: number): string {
  return displayLabel(operatoryId, legacyRules());
}

export function treatmentOperatoryId(): number {
  return treatmentOpId(legacyRules());
}

export function operatoryAllowSet(apptType: string): Set<number> {
  return allowSet(apptType, legacyRules());
}

export function filterAvailabilityWithFallback<T extends { operatoryId: number }>(
  rows: T[],
  apptType: string
): T[] {
  return filterWithFallback(rows, apptType, legacyRules());
}

export function isOperatoryAllowedForApptType(
  operatoryId: number,
  apptType: string
): boolean {
  return isAllowed(operatoryId, apptType, legacyRules());
}

export function filterAvailabilityByApptType<T extends { operatoryId: number }>(
  rows: T[],
  apptType: string
): T[] {
  return filterByApptType(rows, apptType, legacyRules());
}
