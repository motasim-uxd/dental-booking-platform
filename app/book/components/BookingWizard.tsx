"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import drGufranPhoto from "./images/dr-gufran.jpg";

const PhoneField = dynamic(() => import("./PhoneField"), { ssr: false, loading: () => null });
import {
  appointmentTypesForPatient,
  isServiceAllowedForPatient,
  type ServiceType,
  type SlotOption,
  type WizardStep,
  type YesNo,
  bookedSlotStorageKey,
  buildNotes,
  fmt12,
  formatAppointmentDateTime,
  isoToOryxDate,
  earliestOryxSlotDateISO,
  formatDateLabel,
  parseOryxSlotDateISO,
  mergeSlotsByStartTime,
  operatoryRoomLabel,
  readBookedKeysForDate,
  rememberBookedSlot,
  serviceTypeLabel,
  shiftDateISO,
  slotKeyOf,
  todayISO,
} from "../lib/booking-utils";
import type { TenantBookBranding } from "@/lib/booking/tenant-branding";
import { phoneTelHref } from "@/lib/booking/tenant-branding";
import { scheduleMarkBookWizardShellReady } from "../lib/wizard-shell";

function ToothIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M32 8c-8 0-14 6-14 14 0 4 2 8 4 12 2 5 4 10 4 16 0 6 3 10 6 10s6-4 6-10c0-6 2-11 4-16 2-4 4-8 4-12 0-8-6-14-14-14z"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="var(--ss-blue-50)"
      />
    </svg>
  );
}

function resolvePreviewCodeFromBrowser(fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  try {
    const url = new URL(window.location.href);
    const fromQuery = (url.searchParams.get("code") ?? "").trim();
    if (fromQuery) return fromQuery;
    const hash = url.hash.replace(/^#/, "").trim();
    if (hash.startsWith("code=")) return decodeURIComponent(hash.slice(5)).trim();
    if (hash && !hash.includes("=")) return decodeURIComponent(hash).trim();
    const stored = (window.sessionStorage.getItem("previewCode") ?? "").trim();
    return stored || fallback;
  } catch {
    return fallback;
  }
}

type BookingWizardProps = {
  tenantSlug: string;
  branding: TenantBookBranding;
  requiresAccessCode?: boolean;
  /** From server `?code=` so mobile does not wait on client hydration to unlock the form. */
  initialPreviewCode?: string;
};

export default function BookingWizard({
  tenantSlug,
  branding,
  requiresAccessCode = false,
  initialPreviewCode = "",
}: BookingWizardProps) {
  const bootCode = initialPreviewCode.trim();
  const [previewCode, setPreviewCode] = useState(bootCode);
  const [previewCodeReady, setPreviewCodeReady] = useState(
    Boolean(bootCode) || !requiresAccessCode
  );
  const practicePhone = branding.phone ?? "";
  const practiceAddress = branding.address ?? "";
  const phoneHref = phoneTelHref(practicePhone);

  const [step, setStep] = useState<WizardStep>(1);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const [serviceType, setServiceType] = useState<ServiceType>("Cleaning");
  const [newOrExisting, setNewOrExisting] = useState<"new" | "existing">("new");

  const [serviceDateISO, setServiceDateISO] = useState("");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotKey, setSlotKey] = useState("");
  const [availabilityMsg, setAvailabilityMsg] = useState("");
  const [suggestedDateISO, setSuggestedDateISO] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [dobISO, setDobISO] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [hasInsurance, setHasInsurance] = useState<YesNo>("No");
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [insuranceMemberId, setInsuranceMemberId] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState<YesNo>("No");
  const [specialNeedsDetails, setSpecialNeedsDetails] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  /** Step 2: one automatic load (jump to next Oryx opening). User date changes show errors. */
  const step2AutoLoadedRef = useRef(false);

  /* Hide server shell only after wizard UI is painted (not merely when this module loads). */
  useEffect(() => {
    scheduleMarkBookWizardShellReady();
  }, [previewCodeReady, okMsg, step]);

  useEffect(() => {
    const c = resolvePreviewCodeFromBrowser(initialPreviewCode.trim());
    if (!c) return;
    setPreviewCode(c);
    setPreviewCodeReady(true);
    try {
      window.sessionStorage.setItem("previewCode", c);
    } catch {
      /* private mode / storage blocked */
    }
  }, [initialPreviewCode]);

  useEffect(() => {
    if (hasInsurance === "No") {
      setInsuranceCompany("");
      setInsuranceMemberId("");
    }
  }, [hasInsurance]);

  const appointmentOptions = useMemo(
    () => appointmentTypesForPatient(newOrExisting),
    [newOrExisting]
  );

  useEffect(() => {
    if (!isServiceAllowedForPatient(serviceType, newOrExisting)) {
      setServiceType("Cleaning");
    }
  }, [newOrExisting, serviceType]);

  const selectedSlot = useMemo(() => {
    const [operatoryId, oralId, sh, sm] = slotKey.split("|").map((v) => Number(v));
    if (![operatoryId, oralId, sh, sm].every(Number.isFinite)) return null;
    return (
      slots.find(
        (s) =>
          s.operatoryId === operatoryId &&
          s.oralId === oralId &&
          s.start.hour === sh &&
          s.start.minute === sm
      ) ?? null
    );
  }, [slotKey, slots]);

  const stepProgress = step === 1 ? 33 : step === 2 ? 66 : 100;

  const summaryLine2 =
    step >= 2 && serviceDateISO && selectedSlot
      ? `${formatAppointmentDateTime(serviceDateISO, selectedSlot)} · ${operatoryRoomLabel(selectedSlot.operatoryId)}`
      : null;

  const loadAvailability = useCallback(
    async (dateISO: string, options?: { userPicked?: boolean }) => {
      const userPicked = options?.userPicked ?? true;
      setErr(null);
      setOkMsg(null);
      setSlots([]);
      setSlotKey("");
      setAvailabilityMsg("");
      setSuggestedDateISO(null);
      if (requiresAccessCode && !previewCodeReady) {
        setErr("Enter the preview access code to continue.");
        return;
      }
      if (!dateISO) {
        setErr("Please select a date.");
        return;
      }
      setBusy(true);
      setAvailabilityMsg("Finding available times…");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25_000);

      const codeParam = requiresAccessCode ? encodeURIComponent(previewCode.trim()) : "";
      const fetchSlots = async (forDateISO: string, firstAvail: boolean) => {
        const codeQs = codeParam ? `&code=${codeParam}` : "";
        const res = await fetch(
          `/api/t/${encodeURIComponent(tenantSlug)}/availability?date=${encodeURIComponent(forDateISO)}&apptType=${encodeURIComponent(
            serviceType
          )}&firstAvail=${firstAvail ? "true" : "false"}${codeQs}`,
          {
            cache: "no-store",
            signal: controller.signal,
            headers: codeParam ? { "x-preview-code": previewCode.trim() } : undefined,
          }
        );
        const json = await res.json().catch(() => null);
        return { res, json };
      };

      type AvailRow = {
        date?: unknown;
        start?: { hour?: number; minute?: number };
        end?: { hour?: number; minute?: number };
        operatoryId?: number;
        oralId?: number;
        dayOfWeek?: number;
      };

      const isAvailRow = (x: unknown): x is AvailRow =>
        Boolean(x) &&
        typeof x === "object" &&
        Number((x as AvailRow).oralId) > 0 &&
        Number.isFinite(Number((x as AvailRow).operatoryId));

      const rowsToSlotOptions = (rows: unknown[], forDateISO: string, onlyOnDateISO?: string) => {
        const booked = readBookedKeysForDate(forDateISO);
        const options: SlotOption[] = Array.isArray(rows)
          ? rows
              .filter(isAvailRow)
              .filter((x) => {
                if (!onlyOnDateISO) return true;
                const rowDate = parseOryxSlotDateISO(x);
                return !rowDate || rowDate === onlyOnDateISO;
              })
              .map((x) => {
                const sh = Number(x?.start?.hour);
                const sm = Number(x?.start?.minute);
                const eh = Number(x?.end?.hour);
                const em = Number(x?.end?.minute);
                const start = { hour: sh, minute: sm };
                const end = { hour: eh, minute: em };
                return {
                  label: fmt12(start),
                  operatoryId: Number(x.operatoryId),
                  oralId: Number(x.oralId),
                  dayOfWeek: Number(x.dayOfWeek),
                  start,
                  end,
                };
              })
              .filter((s: SlotOption) => Number.isFinite(s.operatoryId) && Number.isFinite(s.oralId))
              .filter((s: SlotOption) => !booked.has(bookedSlotStorageKey(forDateISO, s)))
          : [];
        return mergeSlotsByStartTime(options, serviceType).slice(0, 120);
      };

      try {
        const { res, json } = await fetchSlots(dateISO, false);
        if (!res.ok || !json?.success) {
          const detail =
            typeof json?.error === "string"
              ? json.error
              : json?.error != null
                ? JSON.stringify(json.error)
                : `HTTP ${res.status}`;
          setErr(
            res.status === 401
              ? "Preview code rejected or missing. Re-enter the access code from your link."
              : `Could not load availability (${detail}). Try another date.`
          );
          setAvailabilityMsg("");
          return;
        }

        const limited = rowsToSlotOptions(json.data, dateISO);
        setSlots(limited);

        if (limited.length) {
          setAvailabilityMsg("");
          setSlotKey(slotKeyOf(limited[0]));
          return;
        }

        setAvailabilityMsg("");
        const apiCount = Array.isArray(json.data) ? json.data.length : 0;

        /** Initial step 2 load: jump to next Oryx opening without a red alert. */
        if (!userPicked) {
          try {
            const next = await fetchSlots(dateISO, true);
            if (next.res.ok && next.json?.success && Array.isArray(next.json.data) && next.json.data.length) {
              const nextDate = earliestOryxSlotDateISO(next.json.data) ?? dateISO;
              let rows = next.json.data as unknown[];
              if (nextDate !== dateISO) {
                const exact = await fetchSlots(nextDate, false);
                if (
                  exact.res.ok &&
                  exact.json?.success &&
                  Array.isArray(exact.json.data) &&
                  exact.json.data.length
                ) {
                  rows = exact.json.data as unknown[];
                }
              }
              const resolved = rowsToSlotOptions(rows, nextDate, nextDate);
              if (resolved.length) {
                if (nextDate !== dateISO) setServiceDateISO(nextDate);
                setSlots(resolved);
                setSlotKey(slotKeyOf(resolved[0]));
                return;
              }
            }
          } catch {
            // fall through to neutral copy
          }
          setAvailabilityMsg(
            `No online openings found starting ${formatDateLabel(dateISO)}. Choose another date.`
          );
          return;
        }

        if (apiCount > 0) {
          setErr(
            "No bookable times could be matched for this visit type (operatory rules). Try another day or appointment type."
          );
          return;
        }

        try {
          const next = await fetchSlots(dateISO, true);
          if (next.res.ok && next.json?.success && Array.isArray(next.json.data) && next.json.data.length) {
            const nextDate = earliestOryxSlotDateISO(next.json.data);
            if (nextDate && nextDate !== dateISO) {
              setSuggestedDateISO(nextDate);
              setErr(
                `No openings on ${formatDateLabel(dateISO)}. The next available day is ${formatDateLabel(nextDate)}.`
              );
              return;
            }
            if (nextDate === dateISO) {
              const retry = rowsToSlotOptions(next.json.data, dateISO, dateISO);
              if (retry.length) {
                setSlots(retry);
                setSlotKey(slotKeyOf(retry[0]));
                return;
              }
            }
          }
        } catch {
          // ignore
        }

        setErr(
          `No openings on ${formatDateLabel(dateISO)} for ${serviceTypeLabel(serviceType)}. Try another date.`
        );
      } catch (e: unknown) {
        setAvailabilityMsg("");
        const aborted = e instanceof Error && e.name === "AbortError";
        const msg = aborted
          ? "This is taking too long on your connection. Try again on Wi‑Fi or tap Continue once more."
          : e instanceof Error
            ? e.message
            : "unknown error";
        setErr(`Availability request failed: ${msg}`);
      } finally {
        clearTimeout(timeoutId);
        setBusy(false);
      }
    },
    [previewCode, previewCodeReady, requiresAccessCode, serviceType, tenantSlug]
  );

  useEffect(() => {
    if (step !== 2) {
      step2AutoLoadedRef.current = false;
    }
  }, [step, serviceType]);

  useEffect(() => {
    if (step !== 2 || !previewCodeReady) return;
    const date = serviceDateISO || todayISO();
    if (!serviceDateISO) {
      setServiceDateISO(date);
      return;
    }
    if (step2AutoLoadedRef.current) return;
    step2AutoLoadedRef.current = true;
    void loadAvailability(date, { userPicked: false });
  }, [step, previewCodeReady, serviceType, serviceDateISO, loadAvailability]);

  function goToStep(target: WizardStep) {
    setErr(null);
    setStep(target);
    if (target === 1) setShowMoreOptions(false);
    if (target !== 2) step2AutoLoadedRef.current = false;
  }

  function validateStep1() {
    if (!isServiceAllowedForPatient(serviceType, newOrExisting)) {
      setErr(
        newOrExisting === "new"
          ? "New patients can choose Cleaning, Dental Emergency, or Consultation."
          : "Please choose a valid appointment type."
      );
      return false;
    }
    return true;
  }

  function validateStep2() {
    if (!serviceDateISO) {
      setErr("Please select a date.");
      return false;
    }
    if (!selectedSlot) {
      setErr("Please choose an available time.");
      return false;
    }
    return true;
  }

  async function submit() {
    setErr(null);
    setOkMsg(null);

    if (!previewCodeReady) {
      setErr("Enter the preview access code to continue.");
      return;
    }
    if (!validateStep2()) return;

    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setErr("Please enter your first and last name.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dobISO)) {
      setErr("Please enter a valid date of birth.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("Please enter a valid email address.");
      return;
    }
    if (!phoneNumber.trim()) {
      setErr("Please enter a phone number.");
      return;
    }

    const payload = {
      apptType: serviceType,
      reason: serviceType,
      notes: buildNotes({
        serviceType,
        insurance: hasInsurance,
        insuranceCompany: hasInsurance === "Yes" ? insuranceCompany.trim() : undefined,
        insuranceMemberId: hasInsurance === "Yes" ? insuranceMemberId.trim() : undefined,
        specialHealthcareNeeds: specialNeeds,
        specialHealthcareNeedsDetails: specialNeeds === "Yes" ? specialNeedsDetails : undefined,
        notes,
      }),
      insurance: hasInsurance,
      insuranceCompany: hasInsurance === "Yes" ? insuranceCompany.trim() : undefined,
      insuranceMemberId: hasInsurance === "Yes" ? insuranceMemberId.trim() : undefined,
      specialHealthcareNeeds: specialNeeds,
      specialHealthcareNeedsDetails: specialNeeds === "Yes" ? specialNeedsDetails : undefined,
      date: isoToOryxDate(serviceDateISO),
      start: { hour: selectedSlot!.start.hour, minute: selectedSlot!.start.minute, second: 0, millis: 0 },
      end: { hour: selectedSlot!.end.hour, minute: selectedSlot!.end.minute, second: 0, millis: 0 },
      dayOfWeek: selectedSlot!.dayOfWeek,
      operatoryId: selectedSlot!.operatoryId,
      oralId: selectedSlot!.oralId,
      firstName: fn,
      lastName: ln,
      preferredName: (preferredName.trim() || fn).trim(),
      dob: isoToOryxDate(dobISO),
      email,
      phoneNumber,
      newOrExisting: serviceType === "Treatment" ? "existing" : newOrExisting,
      website: "",
    };

    setBusy(true);
    try {
      const bookHeaders: Record<string, string> = { "content-type": "application/json" };
      if (requiresAccessCode && previewCode.trim()) {
        bookHeaders["x-preview-code"] = previewCode.trim();
      }
      const res = await fetch(`/api/t/${encodeURIComponent(tenantSlug)}/book`, {
        method: "POST",
        headers: bookHeaders,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setErr(json?.error?.message ?? "Booking failed. Please try again.");
        return;
      }
      rememberBookedSlot(serviceDateISO, selectedSlot!);
      setOkMsg("Your appointment request was submitted. Our team will review and confirm shortly.");
    } finally {
      setBusy(false);
    }
  }

  if (requiresAccessCode && !previewCodeReady) {
    return (
      <div className="ss-book">
        <PracticeTopBar address={practiceAddress} phone={practicePhone} phoneHref={phoneHref} />
        <PracticeBrandHeader displayName={branding.displayName} tagline={branding.tagline} />
        <div className="ss-preview-gate">
          <div className="ss-card">
            <h2>Online scheduling</h2>
            <p className="ss-lead">This form is in preview mode. Enter the access code provided by your practice.</p>
            <div className="ss-field">
              <label htmlFor="preview-code">Access code</label>
              <input
                id="preview-code"
                value={previewCode}
                onChange={(e) => setPreviewCode(e.target.value)}
                placeholder="Access code"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const c = previewCode.trim();
                    if (!c) return;
                    window.sessionStorage.setItem("previewCode", c);
                    setPreviewCodeReady(true);
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="ss-btn ss-btn-primary"
              style={{ width: "100%", marginTop: "0.5rem" }}
              onClick={() => {
                const c = previewCode.trim();
                if (!c) return;
                window.sessionStorage.setItem("previewCode", c);
                setPreviewCodeReady(true);
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (okMsg) {
    return (
      <div className="ss-book">
        <PracticeTopBar address={practiceAddress} phone={practicePhone} phoneHref={phoneHref} />
        <PracticeBrandHeader displayName={branding.displayName} tagline={branding.tagline} />
        <main className="ss-main">
          <div className="ss-card" style={{ maxWidth: "32rem", margin: "0 auto", textAlign: "center" }}>
            <div className="ss-alert ss-alert-success">{okMsg}</div>
            {practicePhone ? (
              <p className="ss-lead" style={{ marginBottom: 0 }}>
                Questions? Call us at {practicePhone}.
              </p>
            ) : null}
          </div>
        </main>
        <BookFooter branding={branding} />
      </div>
    );
  }

  return (
    <div className="ss-book" data-web-book="v3-wizard">
      <PracticeTopBar address={practiceAddress} phone={practicePhone} phoneHref={phoneHref} />
      <PracticeBrandHeader displayName={branding.displayName} tagline={branding.tagline} />

      <nav className="ss-stepper" aria-label="Booking progress">
        <div className="ss-step-labels">
          <span className={step >= 1 ? "active" : ""}>1 Appointment</span>
          <span className={step >= 2 ? "active" : ""}>2 Date &amp; Time</span>
          <span className={step >= 3 ? "active" : ""}>3 Confirm</span>
        </div>
        <div className="ss-step-bar" role="progressbar" aria-valuenow={stepProgress} aria-valuemin={0} aria-valuemax={100}>
          <div className="ss-step-bar-fill" style={{ width: `${stepProgress}%` }} />
        </div>
      </nav>

      {step > 1 && (
        <div className="ss-summary">
          <div className="ss-summary-inner">
            <div>
              <span>
                Appointment type: <strong>{serviceTypeLabel(serviceType)}</strong>
              </span>
              {summaryLine2 && (
                <span style={{ display: "block", marginTop: "0.2rem", fontSize: "0.8rem" }}>{summaryLine2}</span>
              )}
            </div>
            <button type="button" className="ss-edit-link" onClick={() => goToStep(1)}>
              Edit
            </button>
          </div>
        </div>
      )}

      <main className="ss-main">
        {err && (
          <div className="ss-alert ss-alert-error">
            {err}
            {suggestedDateISO && step === 2 && (
              <button
                type="button"
                className="ss-btn ss-btn-secondary"
                style={{ display: "block", marginTop: "0.75rem" }}
                disabled={busy}
                onClick={() => {
                  const d = suggestedDateISO;
                  setSuggestedDateISO(null);
                  setErr(null);
                  if (!d) return;
                  setServiceDateISO(d);
                  void loadAvailability(d, { userPicked: false });
                }}
              >
                Use {formatDateLabel(suggestedDateISO)}
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="ss-layout-split">
            <div className="ss-card">
              <h2>Welcome</h2>
              <p className="ss-lead">How can we help you today?</p>

              <p style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--ss-gray-700)" }}>Patient status</p>
              <div className="ss-radio-row">
                <label>
                  <input
                    type="radio"
                    name="patientType"
                    checked={newOrExisting === "new"}
                    disabled={busy}
                    onChange={() => setNewOrExisting("new")}
                  />
                  I am a new patient
                </label>
                <label>
                  <input
                    type="radio"
                    name="patientType"
                    checked={newOrExisting === "existing"}
                    disabled={busy}
                    onChange={() => setNewOrExisting("existing")}
                  />
                  I am existing patient
                </label>
              </div>

              <div className="ss-section-title">Choose appointment type</div>
              <ul className="ss-appt-list" role="listbox" aria-label="Appointment type">
                {appointmentOptions.map((t) => (
                  <li key={t.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={serviceType === t.value}
                      className={`ss-appt-option${serviceType === t.value ? " selected" : ""}`}
                      onClick={() => setServiceType(t.value)}
                      disabled={busy}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="ss-nav-row">
                <span />
                <button
                  type="button"
                  className="ss-btn ss-btn-primary"
                  disabled={busy}
                  onClick={() => {
                    if (!validateStep1()) return;
                    setErr(null);
                    setStep(2);
                  }}
                >
                  Continue
                </button>
              </div>
            </div>

            <aside className="ss-hero-panel">
              <div className="ss-hero-panel-inner">
                <p className="ss-hero-intro">
                  Dr. Gufran is board certified and a diplomat of the American Association of Pediatric Dentistry,
                  the highest achievement within his specialty.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={drGufranPhoto.src}
                  alt="Dr. Muzamil Gufran, pediatric dentist"
                  className="ss-hero-photo"
                  width={120}
                  height={120}
                  loading="lazy"
                  decoding="async"
                />
                <p>
                  Friendly pediatric dental care for your family. Choose the visit type that best matches your needs.
                </p>
              </div>
            </aside>
          </div>
        )}

        {step === 2 && (
          <div className="ss-card" style={{ maxWidth: "40rem", margin: "0 auto" }}>
            {!showMoreOptions && slots.length > 0 && selectedSlot && serviceDateISO && (
              <div className="ss-first-slot">
                <p className="ss-highlight">
                  The first available appointment is on:{" "}
                  <strong>{formatAppointmentDateTime(serviceDateISO, selectedSlot)}</strong>
                </p>
                <div className="ss-provider-card">
                  <h3>Pediatric dentist · {operatoryRoomLabel(selectedSlot.operatoryId)}</h3>
                  <p>
                    On the next step you can share insurance and any special healthcare needs. A team member will
                    confirm your request.
                  </p>
                  <div className="ss-slot-grid">
                    <button
                      type="button"
                      className="ss-slot-pill selected"
                      onClick={() => setSlotKey(slotKeyOf(selectedSlot))}
                    >
                      {selectedSlot.label}
                    </button>
                  </div>
                </div>
                <div className="ss-slot-actions">
                  <button
                    type="button"
                    className="ss-btn ss-btn-success"
                    disabled={busy}
                    onClick={() => {
                      if (!validateStep2()) return;
                      setStep(3);
                    }}
                  >
                    Yes, schedule it for me
                  </button>
                  <button
                    type="button"
                    className="ss-btn ss-btn-primary"
                    disabled={busy}
                    onClick={() => setShowMoreOptions(true)}
                  >
                    Show me other date and time options ▾
                  </button>
                </div>
              </div>
            )}

            {(showMoreOptions || !slots.length || busy) && (
              <>
                {availabilityMsg && (
                  <p className="ss-lead" style={{ textAlign: "center" }}>
                    {availabilityMsg}
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                  }}
                >
                  <button
                    type="button"
                    className="ss-btn ss-btn-secondary"
                    aria-label="Previous day"
                    disabled={busy || !serviceDateISO}
                    onClick={() => {
                      const next = shiftDateISO(serviceDateISO, -1);
                      setServiceDateISO(next);
                      void loadAvailability(next, { userPicked: true });
                    }}
                  >
                    ‹
                  </button>
                  <input
                    type="date"
                    value={serviceDateISO}
                    disabled={busy}
                    onChange={(e) => {
                      setServiceDateISO(e.target.value);
                      void loadAvailability(e.target.value, { userPicked: true });
                    }}
                    style={{ maxWidth: "11rem" }}
                  />
                  <button
                    type="button"
                    className="ss-btn ss-btn-secondary"
                    aria-label="Next day"
                    disabled={busy || !serviceDateISO}
                    onClick={() => {
                      const next = shiftDateISO(serviceDateISO, 1);
                      setServiceDateISO(next);
                      void loadAvailability(next, { userPicked: true });
                    }}
                  >
                    ›
                  </button>
                </div>

                {slots.length > 0 && (
                  <div className="ss-provider-card">
                    <h3>Available times</h3>
                    <div className="ss-slot-grid">
                      {slots.map((s) => {
                        const key = slotKeyOf(s);
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`ss-slot-pill${slotKey === key ? " selected" : ""}`}
                            onClick={() => setSlotKey(key)}
                            disabled={busy}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showMoreOptions && slots.length > 0 && (
                  <div style={{ textAlign: "center", marginTop: "0.75rem" }}>
                    <button type="button" className="ss-btn ss-btn-ghost" onClick={() => setShowMoreOptions(false)}>
                      Show fewer options ▴
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="ss-nav-row">
              <button type="button" className="ss-btn ss-btn-secondary" disabled={busy} onClick={() => goToStep(1)}>
                Back
              </button>
              {(showMoreOptions || slots.length === 0) && (
                <button
                  type="button"
                  className="ss-btn ss-btn-primary"
                  disabled={busy || !slots.length}
                  onClick={() => {
                    if (!validateStep2()) return;
                    setStep(3);
                  }}
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="ss-card" style={{ maxWidth: "28rem", margin: "0 auto" }}>
            <h2>Review &amp; book</h2>
            <p className="ss-lead">Tell us about the patient. We&apos;ll send your request to the office for confirmation.</p>

            <div className="ss-grid-2">
              <div className="ss-field">
                <label htmlFor="firstName">First name</label>
                <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={busy} />
              </div>
              <div className="ss-field">
                <label htmlFor="lastName">Last name</label>
                <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={busy} />
              </div>
            </div>

            <div className="ss-field">
              <label htmlFor="preferredName">Preferred name (optional)</label>
              <input
                id="preferredName"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                disabled={busy}
                placeholder="What should we call you?"
              />
            </div>

            <div className="ss-field">
              <label htmlFor="dob">Date of birth</label>
              <input id="dob" type="date" value={dobISO} onChange={(e) => setDobISO(e.target.value)} disabled={busy} />
            </div>

            <div className="ss-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                placeholder="name@example.com"
              />
            </div>

            <div className="ss-field ss-phone-input">
              <label htmlFor="phone">Phone number</label>
              <PhoneField value={phoneNumber} onChange={setPhoneNumber} disabled={busy} />
            </div>

            <div className="ss-field">
              <label htmlFor="insurance">Do you have dental insurance?</label>
              <select
                id="insurance"
                value={hasInsurance}
                onChange={(e) => setHasInsurance(e.target.value as YesNo)}
                disabled={busy}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {hasInsurance === "Yes" && (
              <div className="ss-grid-2">
                <div className="ss-field">
                  <label htmlFor="insCo">Insurance company</label>
                  <input
                    id="insCo"
                    value={insuranceCompany}
                    onChange={(e) => setInsuranceCompany(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="ss-field">
                  <label htmlFor="memberId">Member ID</label>
                  <input
                    id="memberId"
                    value={insuranceMemberId}
                    onChange={(e) => setInsuranceMemberId(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>
            )}

            <div className="ss-field">
              <label htmlFor="specialNeeds">Any special healthcare needs?</label>
              <select
                id="specialNeeds"
                value={specialNeeds}
                onChange={(e) => setSpecialNeeds(e.target.value as YesNo)}
                disabled={busy}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {specialNeeds === "Yes" && (
              <div className="ss-field">
                <label htmlFor="needsDetails">Please describe</label>
                <input
                  id="needsDetails"
                  value={specialNeedsDetails}
                  onChange={(e) => setSpecialNeedsDetails(e.target.value)}
                  disabled={busy}
                />
              </div>
            )}

            <div className="ss-field">
              <label htmlFor="notes">Note (optional)</label>
              <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
            </div>

            <div className="ss-nav-row">
              <button
                type="button"
                className="ss-btn ss-btn-secondary"
                disabled={busy}
                onClick={() => {
                  setErr(null);
                  setStep(2);
                }}
              >
                Back
              </button>
              <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void submit()}>
                {busy ? "Submitting…" : "Book now"}
              </button>
            </div>
          </div>
        )}
      </main>

      <BookFooter branding={branding} />
    </div>
  );
}

function PracticeTopBar({
  address,
  phone,
  phoneHref,
}: {
  address: string;
  phone: string;
  phoneHref: string;
}) {
  if (!address && !phone) return null;
  return (
    <header className="ss-topbar">
      <div className="ss-topbar-inner">
        {address ? <span>{address}</span> : null}
        {phone ? (
          <span>
            Call us at{" "}
            {phoneHref ? (
              <a href={phoneHref} style={{ color: "inherit" }}>
                {phone}
              </a>
            ) : (
              phone
            )}
          </span>
        ) : null}
      </div>
    </header>
  );
}

function PracticeBrandHeader({
  displayName,
  tagline,
}: {
  displayName: string;
  tagline?: string;
}) {
  return (
    <header className="ss-header">
      <div className="ss-brand-title">{displayName}</div>
      {tagline ? <div className="ss-brand-sub">{tagline}</div> : null}
    </header>
  );
}

function BookFooter({ branding }: { branding: TenantBookBranding }) {
  const year = new Date().getFullYear();
  return (
    <footer className="ss-footer">
      <span>
        © {year}{" "}
        <strong style={{ color: "var(--ss-navy)" }}>{branding.practiceName}</strong>
      </span>
      {branding.websiteUrl ? (
        <a href={branding.websiteUrl} target="_blank" rel="noopener noreferrer">
          Privacy policy
        </a>
      ) : null}
    </footer>
  );
}
