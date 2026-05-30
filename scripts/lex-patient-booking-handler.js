/**
 * Lex V2 Connect code hook — PatientBooking (reference copy).
 * Emergency, Consultation, Treatment, Cleaning + Oryx booking helpers.
 */

/** If true, phone step only accepts keypad (DTMF). Speech parsing still runs when false. */
const PHONE_DTMF_ONLY = false;

/** Office booking window: start times 8:00 AM through 4:00 PM inclusive (30 min appointments). */
const OFFICE_OPEN_MINUTES = 8 * 60;
const OFFICE_CLOSE_MINUTES = 16 * 60;

/** Lex may send interpretedValue as number (phone, member id) — never call .trim() on raw value. */
function slotRaw(slots, key) {
  const slot = slots?.[key];
  if (!slot?.value) return undefined;

  let v = slot.value?.interpretedValue ?? slot.value?.originalValue;
  if (
    (v === undefined || v === null || String(v).trim() === "") &&
    Array.isArray(slot.value?.resolvedValues) &&
    slot.value.resolvedValues.length
  ) {
    v = slot.value.resolvedValues[0];
  }
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function slotLower(slots, key) {
  const s = slotRaw(slots, key);
  return s === undefined ? undefined : s.toLowerCase();
}

function slotOriginal(slots, key) {
  const v = slots?.[key]?.value?.originalValue;
  return v === undefined || v === null ? undefined : String(v).trim();
}

function isLetterSpelledName(tokens) {
  let single = 0;
  let multi = 0;
  for (const t of tokens) {
    const c = t.replace(/\./g, "").trim();
    if (c.length === 1 && /[a-z]/i.test(c)) single += 1;
    else if (c.length >= 2) multi += 1;
  }
  return single >= 4 && multi === 0;
}

/** Split "mikejohn" → mike + john (not mi + kejohn). */
function splitJoinedNameLetters(letters) {
  if (letters.length < 5) return null;
  let best = null;
  let bestScore = -1;
  for (let i = 3; i <= letters.length - 3; i++) {
    const first = letters.slice(0, i);
    const last = letters.slice(i);
    if (last.length < 2) continue;
    const score = Math.min(first.length, last.length) * 10 - Math.abs(first.length - last.length);
    if (score > bestScore) {
      bestScore = score;
      best = { first, last };
    }
  }
  if (!best) return null;
  return (
    best.first.charAt(0).toUpperCase() +
    best.first.slice(1) +
    " " +
    best.last.charAt(0).toUpperCase() +
    best.last.slice(1)
  );
}

/** "Mike John" stays as-is; "m. i. k. e. j. o. h. n." → "Mike John" when clearly spelled. */
function normalizeFullNameFromLex(raw) {
  const s = String(raw || "").trim();
  if (!s) return s;

  const tokens = s.split(/\s+/).filter(Boolean);
  if (!isLetterSpelledName(tokens)) {
    return s.replace(/\s+/g, " ");
  }

  const letters = (s.match(/[a-zA-Z]/g) || []).join("").toLowerCase();
  if (letters.length < 3) return s.replace(/\s+/g, " ");

  const split = splitJoinedNameLetters(letters);
  if (split) return split;

  const word = letters.charAt(0).toUpperCase() + letters.slice(1);
  return word;
}

const PHONE_WORD_TO_DIGIT = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const PHONE_DIGIT_MULTIPLIERS = {
  double: 2,
  triple: 3,
  tripple: 3,
  quadruple: 4,
};

function parseSpelledPhoneDigits(spoken) {
  const parts = String(spoken || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(\d)\s+(?=\d\b)/g, "$1 ")
    .split(/\s+/)
    .filter(Boolean);
  let digits = "";
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/^\d+$/.test(p)) {
      digits += p;
      continue;
    }
    const mult = PHONE_DIGIT_MULTIPLIERS[p];
    if (mult !== undefined) {
      const next = parts[i + 1];
      const d =
        PHONE_WORD_TO_DIGIT[next] ??
        (/^\d$/.test(next) ? next : undefined);
      if (d !== undefined) {
        digits += d.repeat(mult);
        i += 1;
      }
      continue;
    }
    if (PHONE_WORD_TO_DIGIT[p] !== undefined) {
      digits += PHONE_WORD_TO_DIGIT[p];
    }
  }
  return digits;
}

/** Lex / Connect may put the utterance in transcriptions[] instead of inputTranscript on Fallback. */
function getCallerTranscript(event) {
  let t = String(event?.inputTranscript ?? "").trim();
  if (t) return t;

  const trans = event?.transcriptions;
  if (Array.isArray(trans)) {
    for (const row of trans) {
      const tr = String(row?.transcript ?? "").trim();
      if (tr) return tr;
    }
  }

  const sess = event?.sessionState?.sessionAttributes ?? {};
  return String(sess.lastCallerTranscript || "").trim();
}

function isPhoneCaptureContext(sess, inputTranscript) {
  const t = String(inputTranscript || "").trim();
  return (
    sess?.bookingSlotToElicit === "phoneNumber" ||
    sess?.awaitingPhoneCapture === "true" ||
    transcriptLooksLikePhoneUtterance(t) ||
    String(sess?.phoneDigitsAccum || "").length > 0
  );
}

/**
 * Parse spoken phone from transcript; accumulate across turns (do not slice(-10) while building).
 */
function applySpokenPhoneToSlots(slots, sess, inputTranscript) {
  const t = String(inputTranscript || "").trim();
  let acc = String(sess?.phoneDigitsAccum || "");

  if (t) {
    const chunk = phoneDigitsFromTranscript(t);
    if (chunk) acc += chunk;
  }

  if (acc.length > 10) acc = acc.slice(acc.length - 10);

  const digits = normalizePhoneDigitsString(acc);
  const nextSess = {
    ...sess,
    ...(t ? { lastCallerTranscript: t } : {}),
  };

  if (isValidUsPhoneDigits(digits)) {
    slots.phoneNumber = lexScalarSlot(digits, t || digits);
    nextSess.phoneDigitsAccum = "";
    nextSess.awaitingPhoneCapture = "false";
    console.log("SPOKEN_PHONE_CAPTURED:", { digits, transcript: t });
    return { slots, sess: nextSess, digits };
  }

  if (acc.length > 0) {
    nextSess.phoneDigitsAccum = acc;
    nextSess.awaitingPhoneCapture = "true";
    console.log("SPOKEN_PHONE_PARTIAL:", { accum: acc, transcript: t });
  }

  return { slots, sess: nextSess, digits: null };
}

function normalizePhoneDigitsString(digits) {
  let d = String(digits || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d;
}

function normalizePhoneFromLex(slots, event, inputTranscript) {
  const sources = [
    String(inputTranscript || "").trim(),
    slotOriginal(slots, "phoneNumber") || "",
    slotRaw(slots, "phoneNumber") || "",
  ].filter(Boolean);

  const seen = new Set();
  for (const src of sources) {
    if (seen.has(src)) continue;
    seen.add(src);

    let digits = "";
    if (
      /\b(one|two|three|four|five|six|seven|eight|nine|zero|oh|double|triple|tripple|quadruple)\b/i.test(
        src
      )
    ) {
      digits = parseSpelledPhoneDigits(src);
    }
    if (!digits) digits = String(src).replace(/\D/g, "");
    digits = normalizePhoneDigitsString(digits);
    if (isValidUsPhoneDigits(digits)) return digits;
  }

  return normalizePhoneDigitsString(parseSpelledPhoneDigits(sources[0] || ""));
}

function isValidUsPhoneDigits(digits) {
  if (!digits || digits.length !== 10) return false;
  if (digits.startsWith("911")) return false;
  const area = digits.slice(0, 3);
  if (area === "000" || area === "911") return false;
  return true;
}

/** Join "a b c" → "abc" when spelled letter-by-letter. */
function joinSpelledTokenRun(text) {
  const tokens = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return "";
  if (
    tokens.every((t) => {
      const c = t.replace(/\./g, "").trim();
      return c.length === 1 && /[a-z0-9]/i.test(c);
    })
  ) {
    return tokens.map((t) => t.replace(/\./g, "")).join("");
  }
  return tokens.join("");
}

/** "i n f o at a b c dot com" → info@abc.com */
function normalizeEmailFromLex(raw) {
  let s = String(raw || "").trim().toLowerCase();
  const atMatch = s.match(/\s+at\s+/i);
  if (atMatch && atMatch.index !== undefined) {
    const localPart = joinSpelledTokenRun(s.slice(0, atMatch.index));
    const domainRaw = s.slice(atMatch.index + atMatch[0].length);
    const domain = domainRaw
      .split(/\s+dot\s+/i)
      .map((part) => joinSpelledTokenRun(part))
      .filter(Boolean)
      .join(".");
    s = `${localPart}@${domain}`;
  } else {
    s = s
      .replace(/\s+at\s+/gi, "@")
      .replace(/\s+dot\s+/gi, ".")
      .replace(/\s+/g, "");
  }
  return s.replace(/\.{2,}/g, ".").replace(/^\.|\.$/g, "");
}

function resolveEmailFromLex(slots, event, inputTranscript) {
  const slotToElicit = event?.sessionState?.dialogAction?.slotToElicit;
  const sources = [];
  if (slotToElicit === "email" && inputTranscript) sources.push(inputTranscript);
  const orig = slotOriginal(slots, "email");
  const raw = slotRaw(slots, "email");
  if (orig) sources.push(orig);
  if (raw && raw !== orig) sources.push(raw);

  const seen = new Set();
  for (const src of sources) {
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const e = normalizeEmailFromLex(src);
    if (isPlausibleEmail(e)) return e;
  }
  return undefined;
}

function isPlausibleEmail(email) {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(email || ""));
}

function emailLooksUnderCaptured(slots, normalizedEmail, transcript) {
  const orig = slotOriginal(slots, "email") || transcript || "";
  const local = String(normalizedEmail || "").split("@")[0] || "";
  if (local.length > 1) return false;
  const beforeAt = orig.split(/\s+at\s+/i)[0] || "";
  const letterCount = (beforeAt.match(/[a-z]/gi) || []).length;
  return letterCount >= 3;
}

function isValidOfficeBookingTime(hour, minute) {
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const total = hour * 60 + minute;
  return total >= OFFICE_OPEN_MINUTES && total <= OFFICE_CLOSE_MINUTES;
}

function isBookingTimeLexValueValid(slots, rawTime, inputTranscript, event) {
  const original = String(
    slotOriginal(slots, "bookingTime") ||
      (event?.sessionState?.dialogAction?.slotToElicit === "bookingTime"
        ? inputTranscript
        : "") ||
      ""
  ).toLowerCase();

  const { hour, minute } = parseBookingTimeToHourMinute(rawTime);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;

  if (/twelve\s*a\.?\s*m\.?|midnight/i.test(original) && hour === 0 && minute === 0) {
    console.log("INVALID_BOOKING_TIME:", { reason: "midnight", original, rawTime });
    return false;
  }
  if (hour === 0 && minute === 0 && /twelve|midnight/i.test(original)) {
    console.log("INVALID_BOOKING_TIME:", { reason: "midnight_heuristic", original, rawTime });
    return false;
  }

  if (!isValidOfficeBookingTime(hour, minute)) {
    console.log("INVALID_BOOKING_TIME:", { reason: "office_hours", hour, minute, rawTime });
    return false;
  }
  return true;
}

function resolveBookingTimeFromLex(slots, event, inputTranscript) {
  const slotToElicit = event?.sessionState?.dialogAction?.slotToElicit;
  const sources = [];
  if (slotToElicit === "bookingTime" && inputTranscript) sources.push(inputTranscript);
  const orig = slotOriginal(slots, "bookingTime");
  const raw = slotRaw(slots, "bookingTime");
  if (orig) sources.push(orig);
  if (raw && raw !== orig) sources.push(raw);

  for (const src of sources) {
    if (!src) continue;
    if (isBookingTimeLexValueValid(slots, src, inputTranscript, event)) return src;
  }
  return undefined;
}

function isValidFullName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length >= 2 && parts.every((p) => p.replace(/\./g, "").length >= 2);
}

/** Persisted on each elicit so FallbackIntent can restore mid-booking (Connect swaps intent). */
const BOOKING_SNAPSHOT_KEYS = [
  "patientType",
  "serviceType",
  "fullName",
  "dob",
  "phoneNumber",
  "email",
  "hasInsurance",
  "insuranceCompanyName",
  "insuranceMemberId",
  "hasSpecialNeeds",
  "numAppointments",
  "bookingDate",
  "bookingTime",
  "lifeThreatening911",
  "toothType",
  "traumaPainInfection",
  "referredOut",
  "insuranceChanged",
];

function isBookingSessionActive(sess) {
  return Boolean(
    sess?.bookingInProgress === "true" ||
    String(sess?.patientType || "").trim() ||
    String(sess?.bookingPath || "").trim() ||
    String(sess?.patientBookingSnapshot || "").trim()
  );
}

/** Remove intent:* audio keys — they linger and slow every slot (e.g. after phone, patientType waits 6s). */
function stripLexAudioWildcardSessionAttrs(attrs) {
  const out = { ...attrs };
  for (const key of Object.keys(out)) {
    if (!key.startsWith("x-amz-lex:")) continue;
    if (
      key.includes(":audio:") ||
      key.includes("end-silence-threshold") ||
      key.includes("start-silence-threshold") ||
      key.includes("max-speech-duration")
    ) {
      const parts = key.split(":");
      if (parts[parts.length - 1] === "*") delete out[key];
    }
  }
  return out;
}

function freshBookingSessionAttributes(existing = {}) {
  const attemptId = String(Date.now());
  const base = stripLexAudioWildcardSessionAttrs(existing);
  return {
    ...base,
    bookingInProgress: "true",
    bookingAttemptId: attemptId,
    patientBookingSnapshot: JSON.stringify({ _bookingAttemptId: attemptId }),
    phoneDigitsAccum: "",
    awaitingPhoneCapture: "false",
    bookingSlotToElicit: "patientType",
  };
}

function snapshotBookingSlotsToSessionAttributes(attrs, slots) {
  const snap = {};
  const attemptId = String(attrs?.bookingAttemptId || "").trim();
  if (attemptId) snap._bookingAttemptId = attemptId;
  for (const k of BOOKING_SNAPSHOT_KEYS) {
    const v = slotRaw(slots, k);
    if (v !== undefined) snap[k] = v;
    if (v !== undefined) {
      delete attrs[`retry_${k}`];
    }
  }
  if (Object.keys(snap).length) {
    attrs.patientBookingSnapshot = JSON.stringify(snap);
  }
  return attrs;
}

function restoreSlotsFromSession(sess, baseSlots = {}) {
  const slots = { ...baseSlots };
  try {
    const snap = JSON.parse(String(sess?.patientBookingSnapshot || "{}"));
    const attemptId = String(sess?.bookingAttemptId || "").trim();
    if (
      snap._bookingAttemptId &&
      attemptId &&
      snap._bookingAttemptId !== attemptId
    ) {
      console.log("BOOKING_SNAPSHOT_SKIP_STALE:", {
        snapshotAttempt: snap._bookingAttemptId,
        currentAttempt: attemptId,
      });
      return slots;
    }
    for (const [k, v] of Object.entries(snap)) {
      if (k.startsWith("_")) continue;
      if (v && !slotRaw(slots, k)) {
        slots[k] = lexScalarSlot(String(v), String(v));
      }
    }
  } catch (err) {
    console.warn("BOOKING_SNAPSHOT_PARSE:", err?.message || err);
  }
  return slots;
}

function transcriptLooksLikePhoneUtterance(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (
    /\b(one|two|three|four|five|six|seven|eight|nine|zero|oh|double|triple|tripple|quadruple)\b/i.test(
      t
    )
  ) {
    return true;
  }
  const digits = t.replace(/\D/g, "");
  return digits.length >= 3;
}

function phoneDigitsFromTranscript(text) {
  const spelled = parseSpelledPhoneDigits(text);
  const raw = String(text || "").replace(/\D/g, "");
  let digits = spelled.length >= raw.length ? spelled : raw;
  if (!digits) digits = spelled || raw;
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

function resolvePhoneWithAccum(sess, inputTranscript) {
  const fakeSlots = {};
  const { slots, sess: nextSess, digits } = applySpokenPhoneToSlots(
    fakeSlots,
    sess,
    inputTranscript
  );
  return {
    digits,
    accum: nextSess.phoneDigitsAccum || "",
    slots,
    sess: nextSess,
  };
}

/**
 * Prefer what the caller just said (inputTranscript) over Lex slot values — slots are often wrong for name/email/phone.
 */
function applyUserTranscriptToSlots(slots, event, inputTranscript) {
  const slotToElicit = event?.sessionState?.dialogAction?.slotToElicit;
  const t = String(inputTranscript || "").trim();
  if (!t) return slots;

  if (slotToElicit === "fullName") {
    const n = normalizeFullNameFromLex(t);
    if (isValidFullName(n)) {
      slots.fullName = lexScalarSlot(n, t);
      console.log("TRANSCRIPT_APPLIED_NAME:", n);
    }
  }

  if (slotToElicit === "email" || (/\b(at|dot)\b/i.test(t) && !transcriptLooksLikePhoneUtterance(t))) {
    const e = normalizeEmailFromLex(t);
    if (isPlausibleEmail(e) && !emailLooksUnderCaptured(slots, e, t)) {
      slots.email = lexScalarSlot(e, t);
      console.log("TRANSCRIPT_APPLIED_EMAIL:", e);
    }
  }

  if (slotToElicit === "bookingTime") {
    if (isBookingTimeLexValueValid(slots, t, t, event)) {
      slots.bookingTime = lexScalarSlot(t, t);
      console.log("TRANSCRIPT_APPLIED_BOOKING_TIME:", t);
    }
  }

  const sess = event?.sessionState?.sessionAttributes ?? {};
  const pending = String(sess.bookingSlotToElicit || slotToElicit || "").trim();
  const needsPhone = !slotRaw(slots, "phoneNumber");
  const tryPhone =
    needsPhone &&
    (pending === "phoneNumber" ||
      slotToElicit === "phoneNumber" ||
      sess.awaitingPhoneCapture === "true" ||
      transcriptLooksLikePhoneUtterance(t));

  if (tryPhone) {
    const { slots: withPhone } = applySpokenPhoneToSlots(slots, sess, t);
    return withPhone;
  }

  return slots;
}

/** Apply Fallback utterance to the slot we were eliciting (usually phone). */
function applyTranscriptToPendingSlot(slots, sess, inputTranscript) {
  const pending = String(sess?.bookingSlotToElicit || "").trim();
  const t = String(inputTranscript || "").trim();
  if (!t) return slots;

  if (pending === "fullName" || (pending !== "phoneNumber" && /\s/.test(t) && !transcriptLooksLikePhoneUtterance(t))) {
    const n = normalizeFullNameFromLex(t);
    if (isValidFullName(n)) {
      slots.fullName = lexScalarSlot(n, t);
    }
  }

  if (pending === "email" || /\b(at|dot)\b/i.test(t)) {
    const e = normalizeEmailFromLex(t);
    if (isPlausibleEmail(e) && !emailLooksUnderCaptured(slots, e, t)) {
      slots.email = lexScalarSlot(e, t);
    }
  }

  if (pending === "bookingTime" || /\b(a\.?\s*m|p\.?\s*m|o'?clock)\b/i.test(t)) {
    if (isBookingTimeLexValueValid(slots, t, t, { sessionState: { dialogAction: { slotToElicit: "bookingTime" } } })) {
      slots.bookingTime = lexScalarSlot(t, t);
    }
  }

  if (pending && LEX_YES_NO_SLOTS.has(pending)) {
    const yn = parseYesNoFromTranscript(t);
    if (yn && !slotLower(slots, pending)) {
      slots[pending] = lexScalarSlot(yn, t);
      console.log("FALLBACK_APPLIED_YESNO:", { pending, yn });
    }
  }

  const tryPhone =
    pending === "phoneNumber" ||
    sess.awaitingPhoneCapture === "true" ||
    transcriptLooksLikePhoneUtterance(t);
  if (tryPhone) {
    const { slots: withPhone, digits, sess: nextSess } = applySpokenPhoneToSlots(
      slots,
      sess,
      t
    );
    console.log("FALLBACK_APPLIED_PHONE:", {
      digits,
      pending,
      accum: nextSess.phoneDigitsAccum,
    });
    return withPhone;
  }

  return slots;
}

/** Clear Lex-filled slots that failed normalization so ElicitSlot runs again. */
function scrubInvalidFilledSlots(slots, event, inputTranscript) {
  const nameRaw = slotRaw(slots, "fullName");
  if (nameRaw && !isValidFullName(normalizeFullNameFromLex(nameRaw))) {
    slots.fullName = clearedScalarSlot();
  }
  if (
    slotRaw(slots, "phoneNumber") &&
    !isValidUsPhoneDigits(normalizePhoneFromLex(slots, event, inputTranscript))
  ) {
    slots.phoneNumber = clearedScalarSlot();
  }
  const emailResolved = resolveEmailFromLex(slots, event, inputTranscript);
  const emailRaw = slotRaw(slots, "email");
  if (emailRaw && !emailResolved) {
    slots.email = clearedScalarSlot();
  } else if (emailRaw && emailLooksUnderCaptured(slots, emailResolved, inputTranscript)) {
    slots.email = clearedScalarSlot();
  }
  const timeRaw = slotRaw(slots, "bookingTime");
  if (
    timeRaw &&
    !isBookingTimeLexValueValid(slots, timeRaw, inputTranscript, event)
  ) {
    slots.bookingTime = clearedScalarSlot();
  }
}

/** Lex V2 should receive sessionAttributes back (merge with any you add on the response). */
function withLexSession(event, response) {
  const incoming = event?.sessionState?.sessionAttributes ?? {};
  if (!response?.sessionState) return response;
  return {
    ...response,
    sessionState: {
      ...response.sessionState,
      sessionAttributes: {
        ...incoming,
        ...(response.sessionState.sessionAttributes || {}),
      },
    },
  };
}

export const handler = async (event) => {
  try {
    const inputTranscript = getCallerTranscript(event);
    if (inputTranscript) {
      event = { ...event, inputTranscript };
    }

    const intentName = event?.sessionState?.intent?.name;
    const sess = event?.sessionState?.sessionAttributes ?? {};

    if (intentName === "FallbackIntent") {
      const phoneOrBooking =
        isPhoneCaptureContext(sess, inputTranscript) ||
        isBookingSessionActive(sess);
      if (phoneOrBooking) {
        const forced = handleFallbackPhoneCapture(event, inputTranscript);
        if (forced) return forced;
      }
    }

    return await handleLexDialog(event);
  } catch (err) {
    console.error("LEX_HANDLER_UNHANDLED:", err?.stack || err);
    const intentName = event?.sessionState?.intent?.name ?? "PatientBooking";
    const slots = event?.sessionState?.intent?.slots ?? {};
    return withLexSession(event, {
      sessionState: {
        dialogAction: { type: "Close" },
        intent: {
          name: intentName,
          slots,
          state: "Fulfilled",
        },
      },
      messages: [
        {
          contentType: "PlainText",
          content:
            "Sorry, something went wrong. Please try again or call us back.",
        },
      ],
    });
  }
};

async function handleLexDialog(event) {

  let intentName = event?.sessionState?.intent?.name;
  const invocationSource = event?.invocationSource || "DialogCodeHook";
  const inputTranscript = getCallerTranscript(event);

  console.log("LEX_DIALOG:", {
    intentName,
    invocationSource,
    intentState: event?.sessionState?.intent?.state,
    slotToElicit: event?.sessionState?.dialogAction?.slotToElicit ?? null,
    inputTranscript,
    missedUtterance: event?.missedUtterance ?? false,
  });

  if (!intentName) {
    return withLexSession(event, {
      sessionState: {
        dialogAction: { type: "Close" },
        intent: {
          name: "PatientBooking",
          slots: {},
          state: "Fulfilled",
        },
      },
      messages: [
        {
          contentType: "PlainText",
          content: "Sorry, this request could not be processed. Please start again.",
        },
      ],
    });
  }

  /* PatientBooking + legacy BookAppointment name (same flow). */
  if (!isPatientBookingIntent(intentName)) {
    return handleNonPatientBookingIntent(event, intentName, inputTranscript);
  }

  intentName = "PatientBooking";

  let slots = { ...(event.sessionState.intent.slots || {}) };

  const patientType = resolvePatientType(slots, event);
  if (patientType && !slotLower(slots, "patientType")) {
    slots.patientType = lexScalarSlot(
      patientType,
      event?.inputTranscript || patientType
    );
  }

  const lifeThreatening911 = slotLower(slots, "lifeThreatening911");

  const hasSpecialNeeds = slotLower(slots, "hasSpecialNeeds");

  const toothType = slotLower(slots, "toothType");

  const traumaPainInfection = slotRaw(slots, "traumaPainInfection");

  const numAppointments = slotRaw(slots, "numAppointments");

  slots = applyUserTranscriptToSlots(slots, event, inputTranscript);
  slots = applyYesNoSlotsFromTranscript(slots, event, inputTranscript);

  const sessForPhone = event?.sessionState?.sessionAttributes ?? {};
  if (
    !slotRaw(slots, "phoneNumber") &&
    (sessForPhone.bookingSlotToElicit === "phoneNumber" ||
      sessForPhone.awaitingPhoneCapture === "true" ||
      transcriptLooksLikePhoneUtterance(inputTranscript))
  ) {
    const phoneApply = applySpokenPhoneToSlots(
      slots,
      sessForPhone,
      inputTranscript
    );
    slots = phoneApply.slots;
    event = {
      ...event,
      sessionState: {
        ...event.sessionState,
        sessionAttributes: {
          ...sessForPhone,
          ...phoneApply.sess,
        },
      },
    };
  }

  scrubInvalidFilledSlots(slots, event, inputTranscript);

  const fullNameRaw = slotRaw(slots, "fullName");
  const fullName = fullNameRaw
    ? normalizeFullNameFromLex(fullNameRaw)
    : undefined;

  const dob = slotRaw(slots, "dob");

  const phoneDigits = normalizePhoneFromLex(slots, event, inputTranscript);
  const phoneNumber = isValidUsPhoneDigits(phoneDigits)
    ? phoneDigits
    : undefined;

  const email = resolveEmailFromLex(slots, event, inputTranscript);

  const hasInsurance = slotLower(slots, "hasInsurance");

  const insuranceCompanyName = slotRaw(slots, "insuranceCompanyName");

  const insuranceMemberId = slotRaw(slots, "insuranceMemberId");

  const bookingDate = slotRaw(slots, "bookingDate");

  const bookingTime = resolveBookingTimeFromLex(slots, event, inputTranscript);

  const referredOut = slotLower(slots, "referredOut");

  const insuranceChanged = slotLower(slots, "insuranceChanged");

  console.log({
    patientType,
    lifeThreatening911,
    hasSpecialNeeds,
    toothType,
    traumaPainInfection,
    numAppointments,
    fullName,
    dob,
    phoneNumber,
    email,
    hasInsurance,
    insuranceCompanyName,
    insuranceMemberId,
    bookingDate,
    bookingTime,
    referredOut,
    insuranceChanged,
  });

  /* ---------------- PATIENT TYPE ---------------- */

  if (!patientType) {
    return elicitSlotWithRetry(event, intentName, slots, "patientType");
  }

  /* Persist patient type so FallbackIntent can resume after "cleaning" / "consultation". */
  const sessAttrs = { ...(event.sessionState?.sessionAttributes ?? {}) };
  if (!sessAttrs.bookingAttemptId) {
    sessAttrs.bookingAttemptId = String(Date.now());
    sessAttrs.bookingInProgress = "true";
  }
  sessAttrs.patientType = patientType;
  event = {
    ...event,
    sessionState: {
      ...event.sessionState,
      sessionAttributes: snapshotBookingSlotsToSessionAttributes(sessAttrs, slots),
    },
  };

  /* ---------------- SERVICE TYPE ---------------- */

  const allowedServices =
    patientType === "existing"
      ? ["cleaning", "dental emergency", "consultation", "treatment"]
      : ["cleaning", "dental emergency", "consultation"];

  const serviceStep = resolveServiceTypeStep(
    event,
    intentName,
    slots,
    patientType,
    allowedServices
  );
  if (!serviceStep.done) return serviceStep.response;

  slots = serviceStep.slots;
  const serviceType = serviceStep.serviceType;

  console.log(
    "SERVICE_LEX:",
    JSON.stringify({
      serviceType,
      inputTranscript: event?.inputTranscript ?? null,
      slotOriginal: slots?.serviceType?.value?.originalValue ?? null,
      slotInterpreted: slots?.serviceType?.value?.interpretedValue ?? null,
      resolvedValues: slots?.serviceType?.value?.resolvedValues ?? null,
      bookingPath: event?.sessionState?.sessionAttributes?.bookingPath ?? null,
    })
  );

  const lexWrap = (o) => withBookingPath(event, o, serviceType);

  /* ---------------- DENTAL EMERGENCY (triage → book) ---------------- */

  if (serviceType === "dental emergency") {

    if (!lifeThreatening911) {
      return elicitYesNoSlot(event, intentName, slots, "lifeThreatening911", lexWrap);
    }

    if (lifeThreatening911 === "yes") {
      return closeResponse(
        event,
        intentName,
        slots,
        "Thank you for calling Smile Squad, have a great day."
      );
    }

    if (!hasSpecialNeeds) {
      return elicitYesNoSlot(event, intentName, slots, "hasSpecialNeeds");
    }

    if (hasSpecialNeeds === "yes") {
      return closeResponse(
        event,
        intentName,
        slots,
        "We are currently unable to provide care for special needs patients. Please contact another pediatric dentist. Thank you for calling Smile Squad, have a great day."
      );
    }

    if (!toothType) {
      return elicitSlot(event, intentName, slots, "toothType");
    }

    if (toothType.includes("permanent")) {
      return closeResponse(
        event,
        intentName,
        slots,
        "Please reach out to a general dentist in the area for a permanent tooth. Thank you for calling Smile Squad, have a great day."
      );
    }

    const babyLike =
      toothType.includes("baby") ||
      toothType.includes("primary") ||
      toothType.includes("deciduous");

    if (!babyLike) {
      slots.toothType = null;
      return lexWrap({
        sessionState: {
          dialogAction: {
            type: "ElicitSlot",
            slotToElicit: "toothType"
          },
          intent: {
            name: intentName,
            slots,
            state: "InProgress"
          }
        },
        messages: [
          {
            contentType: "PlainText",
            content:
              "Please say whether this is a baby tooth or a permanent tooth."
          }
        ]
      });
    }

    if (!traumaPainInfection) {
      return elicitSlot(event, intentName, slots, "traumaPainInfection");
    }

    if (!fullName) {
      return lexWrap(elicitFullName(event, intentName, slots));
    }

    if (!dob) {
      return elicitSlot(event, intentName, slots, "dob");
    }

    if (!phoneNumber) {
      return elicitPhoneStep(event, intentName, slots);
    }

    if (!email) {
      return elicitEmail(event, intentName, slots);
    }

    if (!hasInsurance) {
      return elicitYesNoSlot(event, intentName, slots, "hasInsurance", lexWrap);
    }

    if (hasInsurance === "yes") {

      if (!insuranceCompanyName) {
        return elicitSlot(event, intentName, slots, "insuranceCompanyName");
      }

      if (!insuranceMemberId) {
        return elicitSlotWithRetry(event, intentName, slots, "insuranceMemberId");
      }
    }

    if (hasInsurance === "no") {

      return lexWrap({
        sessionState: {
          dialogAction: {
            type: "ElicitSlot",
            slotToElicit: "bookingDate"
          },
          intent: {
            name: intentName,
            slots,
            state: "InProgress"
          }
        },
        messages: [
          {
            contentType: "PlainText",
            content:
              "The fee for a limited exam is $125, and a single Periapical (PA) X-ray is $60; however, X-ray cost depends on patient needs."
          }
        ]
      });
    }

    if (!bookingDate) {
      return elicitSlot(event, intentName, slots, "bookingDate");
    }

    if (!bookingTime) {
      return elicitBookingTime(event, intentName, slots);
    }

    return finishBooking(event, intentName, slots, {
      patientType,
      serviceType,
      hasSpecialNeeds,
      fullName,
      dob,
      phoneNumber,
      email,
      hasInsurance,
      insuranceCompanyName,
      insuranceMemberId,
      bookingDate,
      bookingTime,
      lifeThreatening911,
      toothType,
      traumaPainInfection,
    });
  }

  /* ---------------- CONSULTATION ---------------- */

  if (serviceType === "consultation") {

    if (!hasSpecialNeeds) {
      return elicitYesNoSlot(event, intentName, slots, "hasSpecialNeeds");
    }

    if (!toothType) {
      return elicitSlot(event, intentName, slots, "toothType");
    }

    if (toothType.includes("permanent")) {
      return closeResponse(
        event,
        intentName,
        slots,
        "Please reach out to a general dentist in the area for a permanent tooth. Thank you for calling Smile Squad, have a great day."
      );
    }

    const babyLike =
      toothType.includes("baby") ||
      toothType.includes("primary") ||
      toothType.includes("deciduous");

    if (!babyLike) {
      slots.toothType = null;
      return lexWrap({
        sessionState: {
          dialogAction: {
            type: "ElicitSlot",
            slotToElicit: "toothType"
          },
          intent: {
            name: intentName,
            slots,
            state: "InProgress"
          }
        },
        messages: [
          {
            contentType: "PlainText",
            content:
              "Is this regarding a permanent tooth or a baby tooth?"
          }
        ]
      });
    }

    if (!traumaPainInfection) {
      return elicitSlot(event, intentName, slots, "traumaPainInfection");
    }

    if (!fullName) {
      return lexWrap(elicitFullName(event, intentName, slots));
    }

    if (!dob) {
      return elicitSlot(event, intentName, slots, "dob");
    }

    if (!phoneNumber) {
      return elicitPhoneStep(event, intentName, slots);
    }

    if (!email) {
      return elicitEmail(event, intentName, slots);
    }

    if (!hasInsurance) {
      return elicitYesNoSlot(event, intentName, slots, "hasInsurance", lexWrap);
    }

    if (hasInsurance === "yes") {
      if (!insuranceCompanyName) {
        return elicitSlot(event, intentName, slots, "insuranceCompanyName");
      }
      if (!insuranceMemberId) {
        return elicitSlot(event, intentName, slots, "insuranceMemberId");
      }
    }

    if (hasInsurance === "no") {
      return lexWrap({
        sessionState: {
          dialogAction: {
            type: "ElicitSlot",
            slotToElicit: "bookingDate"
          },
          intent: {
            name: intentName,
            slots,
            state: "InProgress"
          }
        },
        messages: [
          {
            contentType: "PlainText",
            content:
              "The fee for a limited exam is $125, and two periapical (PA) X-rays are $120; however, X-ray cost depends on patient needs. Let's find a time that works for you."
          }
        ]
      });
    }

    if (!bookingDate) {
      return elicitSlot(event, intentName, slots, "bookingDate");
    }

    if (!bookingTime) {
      return elicitBookingTime(event, intentName, slots);
    }

    return finishBooking(event, intentName, slots, {
      patientType,
      serviceType,
      hasSpecialNeeds,
      fullName,
      dob,
      phoneNumber,
      email,
      hasInsurance,
      insuranceCompanyName,
      insuranceMemberId,
      bookingDate,
      bookingTime,
      toothType,
      traumaPainInfection,
    }, {
      successMessage:
        "Someone from our office will call you to confirm the appointment. Thank you for calling Smile Squad, have a great day.",
    });
  }

  /* ---------------- TREATMENT (existing patients only — flowchart) ---------------- */

  if (serviceType === "treatment") {

    if (patientType !== "existing") {
      slots.serviceType = clearedScalarSlot();
      return lexWrap({
        sessionState: {
          dialogAction: {
            type: "ElicitSlot",
            slotToElicit: "serviceType",
          },
          intent: {
            name: intentName,
            slots,
            state: "InProgress",
          },
        },
        messages: [
          {
            contentType: "PlainText",
            content:
              "Treatment is only available for existing patients. What would you like instead? Cleaning, Dental Emergency, or Consultation?",
          },
        ],
      });
    }

    if (!referredOut) {
      return elicitYesNoSlot(event, intentName, slots, "referredOut", lexWrap);
    }

    if (referredOut === "yes") {
      return closeResponse(
        event,
        intentName,
        slots,
        "Please follow up with the referral and make an appointment externally according to the referral. Thank you for calling Smile Squad, have a great day."
      );
    }

    if (referredOut !== "no") {
      slots.referredOut = null;
      return lexWrap({
        sessionState: {
          dialogAction: {
            type: "ElicitSlot",
            slotToElicit: "referredOut",
          },
          intent: {
            name: intentName,
            slots,
            state: "InProgress",
          },
        },
        messages: [
          {
            contentType: "PlainText",
            content: "Please answer yes or no. Have you been referred out to another office for treatment?",
          },
        ],
      });
    }

    if (!fullName) {
      return lexWrap(elicitFullName(event, intentName, slots));
    }

    if (!dob) {
      return elicitSlot(event, intentName, slots, "dob");
    }

    if (!phoneNumber) {
      return elicitPhoneStep(event, intentName, slots);
    }

    if (!email) {
      return elicitEmail(event, intentName, slots);
    }

    if (!insuranceChanged) {
      return elicitYesNoSlot(event, intentName, slots, "insuranceChanged", lexWrap);
    }

    if (insuranceChanged !== "yes" && insuranceChanged !== "no") {
      slots.insuranceChanged = null;
      return lexWrap({
        sessionState: {
          dialogAction: {
            type: "ElicitSlot",
            slotToElicit: "insuranceChanged",
          },
          intent: {
            name: intentName,
            slots,
            state: "InProgress",
          },
        },
        messages: [
          {
            contentType: "PlainText",
            content:
              "Please answer yes or no. Has your insurance information changed since last time?",
          },
        ],
      });
    }

    if (insuranceChanged === "yes") {
      if (!insuranceCompanyName) {
        return elicitSlot(event, intentName, slots, "insuranceCompanyName");
      }
      if (!insuranceMemberId) {
        return elicitSlot(event, intentName, slots, "insuranceMemberId");
      }
    }

    if (!bookingDate) {
      return elicitSlot(event, intentName, slots, "bookingDate");
    }

    if (!bookingTime) {
      return elicitBookingTime(event, intentName, slots);
    }

    return finishBooking(event, intentName, slots, {
      patientType,
      serviceType,
      fullName,
      dob,
      phoneNumber,
      email,
      insuranceChanged,
      insuranceCompanyName,
      insuranceMemberId,
      bookingDate,
      bookingTime,
      referredOut,
    }, {
      successMessage:
        "Someone from our office will call you to confirm the appointment. Thank you for calling Smile Squad, have a great day.",
    });
  }


  /* ---------------- SPECIAL NEEDS (cleaning only — consultation handled above) ---------------- */

  const needsSpecialNeedsQuestion =
    serviceType === "cleaning";

  if (needsSpecialNeedsQuestion && !hasSpecialNeeds) {
    return elicitYesNoSlot(event, intentName, slots, "hasSpecialNeeds", lexWrap);
  }

  if (
    needsSpecialNeedsQuestion &&
    hasSpecialNeeds === "yes"
  ) {

    return closeResponse(
      event,
      intentName,
      slots,
      "Thank you. A team member will contact you to assist further with special healthcare accommodations."
    );
  }

  /* ---------------- CONTINUE FLOW ---------------- */

  if (!numAppointments) {
    return elicitSlot(event, intentName, slots, "numAppointments");
  }

  if (!fullName) {
    return lexWrap(elicitFullName(event, intentName, slots));
  }

  if (!dob) {
    return elicitSlot(event, intentName, slots, "dob");
  }

  if (!phoneNumber) {
    return elicitPhoneStep(event, intentName, slots, lexWrap);
  }

  if (!email) {
    return elicitEmail(event, intentName, slots);
  }

  /* ---------------- INSURANCE ---------------- */

  if (!hasInsurance) {
    return elicitYesNoSlot(event, intentName, slots, "hasInsurance", lexWrap);
  }

  /* ---------------- INSURANCE = YES ---------------- */

  if (hasInsurance === "yes") {

    if (!insuranceCompanyName) {
      return elicitSlot(event, intentName, slots, "insuranceCompanyName");
    }

    if (!insuranceMemberId) {
      return elicitSlot(event, intentName, slots, "insuranceMemberId");
    }
  }

  /* ---------------- INSURANCE = NO ---------------- */

  if (hasInsurance === "no") {

    return lexWrap({
      sessionState: {
        dialogAction: {
          type: "ElicitSlot",
          slotToElicit: "bookingDate"
        },
        intent: {
          name: intentName,
          slots,
          state: "InProgress"
        }
      },
      messages: [
        {
          contentType: "PlainText",
          content:
            "No problem. We also offer self pay options."
        }
      ]
    });
  }

  /* ---------------- BOOKING DATE ---------------- */

  if (!bookingDate) {
    return elicitSlot(event, intentName, slots, "bookingDate");
  }

  /* ---------------- BOOKING TIME ---------------- */

  if (!bookingTime) {
    return elicitBookingTime(event, intentName, slots, lexWrap);
  }

  /* ---------------- SUCCESS + ORYX ---------------- */

  return finishBooking(event, intentName, slots, {
    patientType,
    serviceType,
    hasSpecialNeeds,
    numAppointments,
    fullName,
    dob,
    phoneNumber,
    email,
    hasInsurance,
    insuranceCompanyName,
    insuranceMemberId,
    bookingDate,
    bookingTime,
  });
};

/* ---------------- HELPERS ---------------- */

function clearedScalarSlot() {
  return { shape: "Scalar" };
}

function withBookingPath(event, response, bookingPath) {
  const r = withLexSession(event, response);
  if (!r?.sessionState) return r;

  const slotToElicit =
    r.sessionState?.dialogAction?.slotToElicit ??
    response?.sessionState?.dialogAction?.slotToElicit;
  const intentName =
    r.sessionState?.intent?.name ||
    event?.sessionState?.intent?.name ||
    PATIENT_BOOKING_INTENT;

  let attrs = { ...(r.sessionState.sessionAttributes || {}) };
  if (bookingPath) attrs.bookingPath = String(bookingPath);
  if (slotToElicit) {
    attrs = mergeLexAudioSessionAttributes(attrs, intentName, slotToElicit);
  }

  return {
    ...r,
    sessionState: {
      ...r.sessionState,
      sessionAttributes: attrs,
    },
  };
}

const CANONICAL_SERVICE_TYPES = new Set([
  "cleaning",
  "dental emergency",
  "consultation",
  "treatment",
]);

function isPatientBookingIntent(name) {
  const n = String(name ?? "").trim();
  return n === "PatientBooking" || n === "BookAppointment";
}

function normalizeServiceType(raw) {
  const v = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return undefined;

  const exact = {
    cleaning: "cleaning",
    clean: "cleaning",
    hygiene: "cleaning",
    checkup: "cleaning",
    "check up": "cleaning",
    "dental emergency": "dental emergency",
    emergency: "dental emergency",
    urgent: "dental emergency",
    consultation: "consultation",
    consult: "consultation",
    exam: "consultation",
    examination: "consultation",
    treatment: "treatment",
    procedure: "treatment",
  };
  if (exact[v]) return exact[v];

  if (v.includes("emergency") || v.includes("urgent") || v.includes("toothache")) {
    return "dental emergency";
  }
  if (v.includes("clean") || v.includes("hygiene") || v.includes("checkup") || v.includes("check up")) {
    return "cleaning";
  }
  if (v.includes("consult") || v.includes("exam")) return "consultation";
  if (v.includes("treat") || v.includes("filling") || v.includes("cavity")) {
    return "treatment";
  }

  if (CANONICAL_SERVICE_TYPES.has(v)) return v;
  return undefined;
}

function slotServiceType(slots) {
  const slot = slots?.serviceType;
  let raw = slotRaw(slots, "serviceType");
  if (!raw && slot?.value?.resolvedValues?.[0]) {
    raw = String(slot.value.resolvedValues[0]).trim();
  }
  return normalizeServiceType(raw);
}

function detectPatientTypeFromTranscript(event) {
  const t = String(event?.inputTranscript ?? "")
    .trim()
    .toLowerCase();
  if (!t) return undefined;
  if (t.includes("existing") || t.includes("returning") || t.includes("been here")) {
    return "existing";
  }
  if (t.includes("new") || t.includes("first time")) return "new";
  return undefined;
}

function resolvePatientType(slots, event) {
  let pt = slotLower(slots, "patientType");
  if (!pt) {
    pt = String(event?.sessionState?.sessionAttributes?.patientType ?? "")
      .trim()
      .toLowerCase();
  }
  if (!pt) pt = detectPatientTypeFromTranscript(event);
  if (pt && pt !== "new" && pt !== "existing") {
    if (pt.includes("exist")) pt = "existing";
    else if (pt.includes("new")) pt = "new";
    else pt = undefined;
  }
  return pt || undefined;
}

function detectServiceFromTranscript(event) {
  const t = String(event?.inputTranscript ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!t) return null;

  if (t.includes("emergency") || t.includes("urgent") || t.includes("toothache") || t.includes("tooth pain")) {
    return "dental emergency";
  }
  if (t.includes("clean") || t.includes("hygiene") || t.includes("checkup") || t.includes("check up")) {
    return "cleaning";
  }
  if (t.includes("consult") || t.includes("exam")) return "consultation";
  if (t.includes("treat") || t.includes("filling") || t.includes("cavity")) {
    return "treatment";
  }
  return null;
}

function lexScalarSlot(value, originalValue) {
  const v = String(value ?? "").trim();
  return {
    shape: "Scalar",
    value: {
      originalValue: String(originalValue ?? v).trim(),
      interpretedValue: v,
    },
  };
}

function tryFillServiceTypeFromTranscript(event, slots) {
  const fromSpeech = detectServiceFromTranscript(event);
  if (fromSpeech) {
    console.log("SERVICE_FROM_TRANSCRIPT:", {
      service: fromSpeech,
      inputTranscript: event?.inputTranscript,
    });
    return {
      slots: {
        ...(slots || {}),
        serviceType: lexScalarSlot(fromSpeech, event?.inputTranscript || fromSpeech),
      },
      serviceType: fromSpeech,
    };
  }

  const fromSlot = slotServiceType(slots);
  if (!fromSlot) return { slots, serviceType: undefined };
  return { slots, serviceType: fromSlot };
}

/**
 * Resolve serviceType without looping: normalize Lex values (Emergency → dental emergency),
 * fill from transcript when Lex misses, then re-elicit serviceType with the service list prompt.
 */
function resolveServiceTypeStep(event, intentName, slots, patientType, allowedServices) {
  const locked = String(
    event?.sessionState?.sessionAttributes?.bookingPath ?? ""
  )
    .trim()
    .toLowerCase();

  let { slots: s, serviceType } = tryFillServiceTypeFromTranscript(event, slots);
  serviceType = normalizeServiceType(serviceType);

  if (locked && allowedServices.includes(locked)) {
    serviceType = locked;
    s = {
      ...s,
      serviceType: lexScalarSlot(locked, locked),
    };
  }

  if (serviceType && allowedServices.includes(serviceType)) {
    return { done: true, slots: s, serviceType };
  }

  const hadInvalid = Boolean(serviceType);
  if (hadInvalid) {
    console.log("SERVICE_TYPE_INVALID:", {
      serviceType,
      patientType,
      allowedServices,
      inputTranscript: event?.inputTranscript,
    });
    s = { ...s, serviceType: clearedScalarSlot() };
  }

  return {
    done: false,
    response: elicitSlotWithRetry(event, intentName, s, "serviceType", {
      sessionCtx: { patientType },
      treatAsRetry: hadInvalid,
    }),
  };
}

/**
 * FallbackIntent / FAQ intents share this Lambda in Lex — never run PatientBooking slot logic on them.
 * Closing here caused Connect "I didn't get it" on the first Book Appointment prompt.
 */
/** Slots where callers often speak slowly (names, phone, member id, dates). */
const LEX_LONG_CAPTURE_SLOTS = new Set([
  "fullName",
  "phoneNumber",
  "email",
  "insuranceMemberId",
  "insuranceCompanyName",
  "bookingTime",
  "bookingDate",
  "dob",
]);

const PATIENT_BOOKING_INTENT = "PatientBooking";

/** Lex V2 max continuous speech (ms) — safety cap only, not a fixed answer length. */
const LEX_MAX_SPEECH_MS = 55000;

/**
 * Voice capture: listen while the caller speaks; end the turn only after sustained silence.
 * - endSilenceMs: VAD — pause length that means "they are done" (short OR long answers OK).
 * - maxSpeechMs: truncate only if they keep talking without stopping (Lex max 55s).
 * Keys MUST be intent:slot (e.g. PatientBooking:phoneNumber); slot-only keys are ignored.
 */
/** Long answers: ~1.5s silence after speech ends; short start-wait (do not use intent:* wildcards). */
const LEX_SPEECH_CAPTURE = {
  fullName: { endSilenceMs: 1800, startWaitMs: 4000, dtmfEndMs: 8000 },
  phoneNumber: { endSilenceMs: 1800, startWaitMs: 4000, dtmfEndMs: 10000 },
  email: { endSilenceMs: 1800, startWaitMs: 4000, dtmfEndMs: 8000 },
  insuranceMemberId: { endSilenceMs: 2000, startWaitMs: 4000, dtmfEndMs: 12000 },
  insuranceCompanyName: { endSilenceMs: 1500, startWaitMs: 3500, dtmfEndMs: 8000 },
  dob: { endSilenceMs: 1500, startWaitMs: 3500, dtmfEndMs: 10000 },
  bookingDate: { endSilenceMs: 1500, startWaitMs: 3500, dtmfEndMs: 10000 },
  bookingTime: { endSilenceMs: 1500, startWaitMs: 3500, dtmfEndMs: 10000 },
  _defaultLong: { endSilenceMs: 1500, startWaitMs: 3500, dtmfEndMs: 8000 },
};

/** Patient type, service — moderate pace. */
const LEX_SHORT_CAPTURE_SLOTS = new Set([
  "patientType",
  "serviceType",
  "toothType",
  "traumaPainInfection",
  "numAppointments",
]);

const LEX_FAST_CAPTURE = {
  endSilenceMs: 1800,
  startWaitMs: 4000,
  maxSpeechMs: 20000,
  dtmfEndMs: 5000,
};

/** Yes/no — wait ~2.2s silence after answer; longer start-wait so caller can think. */
const LEX_YES_NO_SLOTS = new Set([
  "hasSpecialNeeds",
  "hasInsurance",
  "lifeThreatening911",
  "referredOut",
  "insuranceChanged",
]);

const LEX_YES_NO_CAPTURE = {
  endSilenceMs: 2500,
  startWaitMs: 5500,
  maxSpeechMs: 30000,
  dtmfEndMs: 6000,
};

/** Connect PlayPrompt while bookingInProgress — branch on this attribute. */
const CONNECT_BOOKING_MISSED_PROMPT =
  "Sorry, I didn't quite catch that. Please say your answer again, a bit louder.";

/**
 * Friendly re-ask wording per slot (index 0 = first ask, 1+ = retries).
 * Functions receive ctx from elicitSlotWithRetry (e.g. patientType, invalid).
 */
const SLOT_REASK_VARIANTS = {
  patientType: [
    "Are you a new patient or an existing patient?",
    "Sorry, I didn't quite catch that. Are you new to our office, or have you been here before?",
    "One more time — new patient, or existing patient?",
  ],
  serviceType: (ctx) => {
    const opts =
      ctx?.patientType === "existing"
        ? "Cleaning, Dental Emergency, Consultation, or Treatment"
        : "Cleaning, Dental Emergency, or Consultation";
    return [
      `What do you need today? ${opts}.`,
      `Please say one of these: ${opts}. For example, consultation or cleaning.`,
      `I still need the visit type. Say ${opts}.`,
    ];
  },
  hasSpecialNeeds: [
    "Does the child have any special healthcare needs? Please say yes or no.",
    "Just checking — any special healthcare needs for your child? Yes or no.",
    "One more time: special healthcare needs? A simple yes or no is fine.",
  ],
  hasInsurance: [
    "Do you have dental insurance? Please say yes or no.",
    "Sorry, I missed that. Do you have dental insurance? Yes or no.",
    "Please answer yes or no — do you have dental insurance?",
  ],
  lifeThreatening911: [
    "Is this a life-threatening emergency? Please say yes or no.",
    "I need a yes or no — is this life-threatening?",
    "One more time: is this a life-threatening emergency? Yes or no.",
  ],
  referredOut: [
    "Have you been referred out to another office for treatment? Please say yes or no.",
    "Sorry, I didn't catch that. Referred to another office? Yes or no.",
    "Please say yes or no — referred out for treatment?",
  ],
  insuranceChanged: [
    "Has your insurance information changed since last time? Please say yes or no.",
    "Sorry, I missed that. Has your insurance changed? Yes or no.",
    "One more time — insurance information changed? Yes or no.",
  ],
  phoneNumber: [
    "What is the best phone number to reach you? Say your ten-digit number any way you like, or enter it on your keypad.",
    "I still need all ten digits. Say your number again any way you like, or use your keypad.",
    "Let's try once more — your full ten-digit phone number, spoken or on the keypad.",
  ],
  fullName: [
    "What is the patient's first and last name? Say it at normal speed, for example John Smith, not letter by letter.",
    "Sorry, I didn't get the name. Please say first and last name together, like John Smith.",
    "One more time — the patient's first and last name, at a normal speaking pace.",
  ],
  email: [
    "What is your email address? Say it slowly, like info at abc dot com, then stop.",
    "Sorry, I didn't catch the email. Say it slowly, spelling each part — info at abc dot com.",
    "Let's try again — your full email address, spoken slowly.",
  ],
  dob: [
    "What is the patient's date of birth? For example, March 15, 2015.",
    "Sorry, I didn't catch the date of birth. Say the month, day, and year.",
    "One more time — date of birth, month day and year.",
  ],
  insuranceCompanyName: [
    "What is the name of your dental insurance company?",
    "Sorry, I missed that. What insurance company is it?",
    "Please say the insurance company name again.",
  ],
  insuranceMemberId: [
    "What is the insurance member or subscriber ID? You can say it slowly.",
    "Sorry, I didn't get the member ID. Say it slowly, one character at a time if needed.",
    "One more time — the insurance member or subscriber ID.",
  ],
  bookingDate: [
    "What date would you like for the appointment?",
    "Sorry, I didn't catch the date. What day works for you?",
    "Please say the appointment date again.",
  ],
  bookingTime: (ctx) =>
    ctx?.invalid
      ? [
          "That time is not available. Please choose a time between 8:00 AM and 4:00 PM.",
          "Sorry, that time won't work. Pick a time between 8 AM and 4 PM.",
          "Office hours are 8 AM to 4 PM. What time would you like?",
        ]
      : [
          "What time works for you? Please choose a time between 8:00 AM and 4:00 PM.",
          "Sorry, I didn't catch the time. Say a time between 8 AM and 4 PM.",
          "One more time — what time between 8 AM and 4 PM?",
        ],
  toothType: [
    "Is this regarding a permanent tooth or a baby tooth?",
    "Sorry, I didn't catch that. Permanent tooth or baby tooth?",
    "Please say permanent tooth or baby tooth.",
  ],
  traumaPainInfection: [
    "Is this related to trauma, pain, or infection?",
    "Sorry, I missed that. Trauma, pain, or infection?",
    "Please say trauma, pain, or infection.",
  ],
  numAppointments: [
    "How many appointments would you like to schedule?",
    "Sorry, I didn't catch the number. How many appointments?",
    "One more time — how many appointments?",
  ],
};

function retrySlotKey(slotToElicit) {
  return `retry_${slotToElicit}`;
}

function getSlotRetryCount(sess, slotToElicit) {
  return Number(sess?.[retrySlotKey(slotToElicit)] || 0);
}

function getSlotReaskVariants(slotToElicit, ctx = {}) {
  const raw = SLOT_REASK_VARIANTS[slotToElicit];
  if (typeof raw === "function") return raw(ctx);
  if (Array.isArray(raw) && raw.length) return raw;
  return [""];
}

function resolveSlotReaskMessage(slotToElicit, sess, opts = {}) {
  const variants = getSlotReaskVariants(slotToElicit, opts.ctx || opts);
  let retries = getSlotRetryCount(sess, slotToElicit);
  if (opts.treatAsRetry) retries = Math.max(retries, 1);
  if (opts.forceVariantIndex !== undefined) {
    retries = Number(opts.forceVariantIndex);
  }
  const idx = Math.min(Math.max(0, retries), variants.length - 1);
  return variants[idx] || "";
}

function bumpSlotRetryInSession(attrs, slotToElicit, opts = {}) {
  const key = retrySlotKey(slotToElicit);
  let next = Number(attrs[key] || 0) + 1;
  if (opts.treatAsRetry && next < 1) next = 1;
  attrs[key] = String(next);
  return attrs;
}

function elicitSlotWithRetry(event, intentName, slots, slotToElicit, opts = {}) {
  const sess = event?.sessionState?.sessionAttributes ?? {};
  const message =
    opts.messageOverride ??
    resolveSlotReaskMessage(slotToElicit, sess, opts);
  const resp = elicitSlotWithMessage(
    event,
    intentName,
    slots,
    slotToElicit,
    message,
    opts.sessionCtx || {}
  );
  const wrapped = opts.wrapFn ? opts.wrapFn(resp) : resp;
  if (wrapped?.sessionState?.sessionAttributes) {
    bumpSlotRetryInSession(
      wrapped.sessionState.sessionAttributes,
      slotToElicit,
      opts
    );
  }
  return wrapped;
}

function parseYesNoFromTranscript(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, " ");
  if (!t) return undefined;
  if (
    /^(yes|yeah|yep|yup|correct|right|sure|absolutely|affirmative|uh huh|i do)\b/.test(
      t
    ) ||
    /\b(yes|yeah)\b/.test(t)
  ) {
    return "yes";
  }
  if (
    /^(no|nope|nah|negative|none|not really|don't|do not|did not)\b/.test(t) ||
    /\b(no|nope)\b/.test(t)
  ) {
    return "no";
  }
  return undefined;
}

function applyYesNoSlotsFromTranscript(slots, event, inputTranscript) {
  const t = String(inputTranscript || "").trim();
  if (!t) return slots;

  const yn = parseYesNoFromTranscript(t);
  if (!yn) return slots;

  const slotToElicit = event?.sessionState?.dialogAction?.slotToElicit;
  const pending = String(
    event?.sessionState?.sessionAttributes?.bookingSlotToElicit || ""
  ).trim();

  let target = null;
  if (slotToElicit && LEX_YES_NO_SLOTS.has(slotToElicit)) target = slotToElicit;
  else if (pending && LEX_YES_NO_SLOTS.has(pending)) target = pending;

  if (target && !slotLower(slots, target)) {
    slots[target] = lexScalarSlot(yn, t);
    console.log("TRANSCRIPT_APPLIED_YESNO:", { target, yn, transcript: t });
  }

  return slots;
}

function speechCaptureProfile(slotToElicit) {
  return (
    LEX_SPEECH_CAPTURE[slotToElicit] ?? LEX_SPEECH_CAPTURE._defaultLong
  );
}

function setLexSpeechSessionAttribute(attrs, namespace, behavior, intent, slot, value) {
  attrs[`x-amz-lex:${namespace}:${behavior}:${intent}:${slot}`] = value;
}

function applyLexSpeechProfileToSlot(attrs, intent, slotToElicit, profile) {
  const end = String(profile.endSilenceMs);
  const max = String(profile.maxSpeechMs ?? LEX_MAX_SPEECH_MS);
  const start = String(profile.startWaitMs);
  const dtmfEnd = String(profile.dtmfEndMs);

  setLexSpeechSessionAttribute(attrs, "audio", "end-timeout-ms", intent, slotToElicit, end);
  setLexSpeechSessionAttribute(attrs, "audio", "max-length-ms", intent, slotToElicit, max);
  setLexSpeechSessionAttribute(attrs, "audio", "start-timeout-ms", intent, slotToElicit, start);
  setLexSpeechSessionAttribute(attrs, "dtmf", "end-timeout-ms", intent, slotToElicit, dtmfEnd);

  attrs[`x-amz-lex:end-silence-threshold-ms:${intent}:${slotToElicit}`] = end;
  attrs[`x-amz-lex:max-speech-duration-ms:${intent}:${slotToElicit}`] = max;
  attrs[`x-amz-lex:start-silence-threshold-ms:${intent}:${slotToElicit}`] = start;
}

/**
 * Amazon Connect + Lex V2 speech timeouts on the Lambda response (slot-specific only).
 */
function mergeLexAudioSessionAttributes(attrs, intentName, slotToElicit) {
  if (!slotToElicit) return attrs;

  const intent = intentName || PATIENT_BOOKING_INTENT;
  let out = stripLexAudioWildcardSessionAttrs(attrs);

  if (LEX_YES_NO_SLOTS.has(slotToElicit)) {
    applyLexSpeechProfileToSlot(out, intent, slotToElicit, LEX_YES_NO_CAPTURE);
    out[`x-amz-lex:allow-interrupt:${intent}:${slotToElicit}`] = "false";
    return out;
  }

  if (LEX_SHORT_CAPTURE_SLOTS.has(slotToElicit)) {
    applyLexSpeechProfileToSlot(out, intent, slotToElicit, LEX_FAST_CAPTURE);
    return out;
  }

  if (!LEX_LONG_CAPTURE_SLOTS.has(slotToElicit)) return out;

  const p = speechCaptureProfile(slotToElicit);
  applyLexSpeechProfileToSlot(out, intent, slotToElicit, {
    ...p,
    maxSpeechMs: LEX_MAX_SPEECH_MS,
  });

  return out;
}

function attachBookingSession(event, response, ctx = {}, slotToElicit) {
  const r = withLexSession(event, response);
  if (!r?.sessionState) return r;
  let attrs = stripLexAudioWildcardSessionAttrs({
    ...(r.sessionState.sessionAttributes || {}),
  });
  if (ctx.patientType) attrs.patientType = String(ctx.patientType);
  if (ctx.bookingPath) attrs.bookingPath = String(ctx.bookingPath);
  const intentName =
    r.sessionState?.intent?.name ||
    event?.sessionState?.intent?.name ||
    PATIENT_BOOKING_INTENT;
  attrs.bookingInProgress = "true";
  const callerTx = getCallerTranscript(event);
  if (callerTx) attrs.lastCallerTranscript = callerTx;
  if (slotToElicit) attrs.bookingSlotToElicit = String(slotToElicit);
  attrs.bookingMissedPrompt = CONNECT_BOOKING_MISSED_PROMPT;
  const promptText = r.messages?.[0]?.content;
  if (promptText) attrs.lastBookingPrompt = String(promptText);
  if (slotToElicit === "phoneNumber") {
    attrs.awaitingPhoneCapture = "true";
    attrs.bookingSlotToElicit = "phoneNumber";
    const priorAccum = event?.sessionState?.sessionAttributes?.phoneDigitsAccum;
    if (!priorAccum) attrs.phoneDigitsAccum = "";
  }
  const mergedSlots = {
    ...(event?.sessionState?.intent?.slots || {}),
    ...(r.sessionState?.intent?.slots || {}),
  };
  attrs = snapshotBookingSlotsToSessionAttributes(attrs, mergedSlots);
  attrs = mergeLexAudioSessionAttributes(attrs, intentName, slotToElicit);
  return {
    ...r,
    sessionState: {
      ...r.sessionState,
      sessionAttributes: attrs,
    },
  };
}

/**
 * Connect often routes digit strings / "cleaning" to FallbackIntent — resume PatientBooking
 * with session snapshot instead of the hours/location hub (feels like a restart).
 */
/**
 * Fallback during booking — never play hours/location hub; capture spoken phone or re-ask.
 */
function handleFallbackPhoneCapture(event, inputTranscript) {
  const sess = event?.sessionState?.sessionAttributes ?? {};
  let slots = restoreSlotsFromSession(
    sess,
    event?.sessionState?.intent?.slots ?? {}
  );

  let nextSess = { ...sess, bookingInProgress: "true" };
  slots = applyTranscriptToPendingSlot(slots, nextSess, inputTranscript);
  const phoneApply = applySpokenPhoneToSlots(slots, nextSess, inputTranscript);
  slots = phoneApply.slots;
  nextSess = phoneApply.sess;

  const pt =
    slotLower(slots, "patientType") ||
    String(nextSess.patientType || "")
      .trim()
      .toLowerCase();
  if (!pt) {
    console.log("FALLBACK_PHONE_NO_PATIENT_TYPE:", { inputTranscript });
    return null;
  }

  if (!slotLower(slots, "patientType")) {
    slots.patientType = lexScalarSlot(pt, pt);
  }
  nextSess.patientType = pt;

  if (phoneApply.digits) {
    nextSess.awaitingPhoneCapture = "false";
    nextSess.bookingSlotToElicit = "";
    return handleLexDialog({
      ...event,
      inputTranscript: inputTranscript || "",
      sessionState: {
        ...event.sessionState,
        sessionAttributes: nextSess,
        intent: { name: "PatientBooking", slots, state: "InProgress" },
      },
    });
  }

  const pendingSlot = String(nextSess.bookingSlotToElicit || "").trim();
  if (
    pendingSlot &&
    LEX_YES_NO_SLOTS.has(pendingSlot) &&
    slotLower(slots, pendingSlot)
  ) {
    nextSess.bookingSlotToElicit = "";
    console.log("FALLBACK_RESUME_YESNO:", { pendingSlot, inputTranscript });
    return handleLexDialog({
      ...event,
      inputTranscript: inputTranscript || "",
      sessionState: {
        ...event.sessionState,
        sessionAttributes: nextSess,
        intent: { name: "PatientBooking", slots, state: "InProgress" },
      },
    });
  }

  const phoneCtx =
    pendingSlot === "phoneNumber" ||
    nextSess.awaitingPhoneCapture === "true" ||
    transcriptLooksLikePhoneUtterance(inputTranscript);

  if (phoneCtx) {
    nextSess.bookingSlotToElicit = "phoneNumber";
    nextSess.awaitingPhoneCapture = "true";
    console.log("FALLBACK_REELICIT_PHONE:", {
      inputTranscript,
      accum: nextSess.phoneDigitsAccum,
    });

    return elicitPhoneStep(
      {
        ...event,
        sessionState: {
          ...event.sessionState,
          sessionAttributes: nextSess,
        },
      },
      "PatientBooking",
      slots
    );
  }

  if (isBookingSessionActive(nextSess)) {
    console.log("FALLBACK_RESUME_BOOKING:", { pendingSlot, inputTranscript });
    return handleLexDialog({
      ...event,
      inputTranscript: inputTranscript || "",
      sessionState: {
        ...event.sessionState,
        sessionAttributes: nextSess,
        intent: { name: "PatientBooking", slots, state: "InProgress" },
      },
    });
  }

  return null;
}

function resumePatientBookingFromSession(event, inputTranscript) {
  const sess = event?.sessionState?.sessionAttributes ?? {};
  if (!isBookingSessionActive(sess) && !isPhoneCaptureContext(sess, inputTranscript)) {
    return null;
  }

  return handleFallbackPhoneCapture(event, inputTranscript);
}

function tryResumePatientBookingFromFallback(event, intentName, inputTranscript) {
  if (intentName !== "FallbackIntent") return null;

  const sess = event?.sessionState?.sessionAttributes ?? {};
  if (
    isPhoneCaptureContext(sess, inputTranscript) ||
    isBookingSessionActive(sess)
  ) {
    return handleFallbackPhoneCapture(event, inputTranscript);
  }

  const priorSlots = { ...(event?.sessionState?.intent?.slots ?? {}) };
  const pt =
    slotLower(priorSlots, "patientType") ||
    String(sess.patientType || "")
      .trim()
      .toLowerCase();
  const svc = detectServiceFromTranscript(event);

  if (!pt && !svc) return null;

  const slots = { ...priorSlots };
  if (pt) slots.patientType = lexScalarSlot(pt, pt);
  if (svc) slots.serviceType = lexScalarSlot(svc, inputTranscript || svc);

  if (!pt) return null;

  console.log("RESUME_PATIENT_BOOKING_FROM_FALLBACK:", {
    patientType: pt,
    service: svc,
    inputTranscript,
  });

  return handleLexDialog({
    ...event,
    inputTranscript: inputTranscript || event?.inputTranscript,
    sessionState: {
      ...event.sessionState,
      intent: {
        name: "PatientBooking",
        slots,
        state: "InProgress",
      },
    },
  });
}

function handleNonPatientBookingIntent(event, intentName, inputTranscript) {
  const sess = event?.sessionState?.sessionAttributes ?? {};
  const phoneLike = isPhoneCaptureContext(sess, inputTranscript);

  const resumed = tryResumePatientBookingFromFallback(
    event,
    intentName,
    inputTranscript
  );
  if (resumed) return resumed;

  if (intentName === "FallbackIntent") {
    if (phoneLike || isBookingSessionActive(sess)) {
      const mid = handleFallbackPhoneCapture(event, inputTranscript);
      if (mid) return mid;
    }
  }

  const slots = event?.sessionState?.intent?.slots ?? {};
  const state = event?.sessionState?.intent?.state ?? "InProgress";
  const t = inputTranscript.toLowerCase();

  const wantsBooking =
    !phoneLike &&
    (intentName === "BookAppointment" ||
      (!t && intentName === "BookAppointment") ||
      t.includes("book") ||
      t.includes("appointment") ||
      t.includes("schedule") ||
      (event?.missedUtterance === true && !isBookingSessionActive(sess)));

  if (intentName === "FallbackIntent" || intentName === "BookAppointment") {
    if (wantsBooking || intentName === "BookAppointment") {
      if (isBookingSessionActive(sess)) {
        const continueBooking = handleFallbackPhoneCapture(
          event,
          inputTranscript
        );
        if (continueBooking) return continueBooking;
      }

      return elicitSlotWithRetry(
        {
          ...event,
          sessionState: {
            ...event.sessionState,
            sessionAttributes: freshBookingSessionAttributes(
              event?.sessionState?.sessionAttributes ?? {}
            ),
          },
        },
        "PatientBooking",
        {},
        "patientType"
      );
    }

    if (isBookingSessionActive(sess) || phoneLike) {
      const mid = handleFallbackPhoneCapture(event, inputTranscript);
      if (mid) return mid;
    }

    return withLexSession(event, {
      sessionState: {
        dialogAction: { type: "Delegate" },
        intent: {
          name: intentName,
          slots,
          state: "InProgress",
        },
      },
      messages: [
        {
          contentType: "PlainText",
          content:
            "You can say book an appointment, or ask about our hours or location.",
        },
      ],
    });
  }

  return withLexSession(event, {
    sessionState: {
      dialogAction: { type: "Delegate" },
      intent: {
        name: intentName,
        slots,
        state,
      },
    },
  });
}

function elicitSlot(event, intentName, slots, slotToElicit, wrapFn) {
  return elicitSlotWithRetry(event, intentName, slots, slotToElicit, { wrapFn });
}

/** Yes/no slots — variant prompts + longer listen profile. */
function elicitYesNoSlot(event, intentName, slots, slotToElicit, wrapFn) {
  return elicitSlotWithRetry(event, intentName, slots, slotToElicit, { wrapFn });
}

/** Always speak the prompt in Lambda — Lex slot prompts alone are often silent on Connect. */
function elicitSlotWithMessage(
  event,
  intentName,
  slots,
  slotToElicit,
  message,
  sessionCtx = {}
) {
  const body = {
    sessionState: {
      dialogAction: {
        type: "ElicitSlot",
        slotToElicit,
      },
      intent: {
        name: intentName,
        slots,
        state: "InProgress",
      },
    },
  };
  if (message) {
    body.messages = [{ contentType: "PlainText", content: message }];
  }
  return attachBookingSession(event, body, sessionCtx, slotToElicit);
}

function elicitPhoneNumber(event, intentName, slots, sessionCtx = {}) {
  const msg = PHONE_DTMF_ONLY
    ? "Please enter your ten-digit phone number on your keypad, then press pound."
    : undefined;
  return elicitSlotWithRetry(event, intentName, slots, "phoneNumber", {
    sessionCtx,
    messageOverride: msg,
  });
}

function elicitPhoneStep(event, intentName, slots, wrapFn, sessionCtx = {}) {
  const sess = event?.sessionState?.sessionAttributes ?? {};
  const partialAccum = String(sess.phoneDigitsAccum || "").length > 0;
  const treatAsRetry =
    sess.bookingSlotToElicit === "phoneNumber" &&
    (partialAccum ||
      transcriptLooksLikePhoneUtterance(
        String(getCallerTranscript(event) || "")
      ));

  if (slotRaw(slots, "phoneNumber")) {
    slots.phoneNumber = clearedScalarSlot();
  }

  if (PHONE_DTMF_ONLY) {
    return elicitPhoneNumber(event, intentName, slots, sessionCtx);
  }

  return elicitSlotWithRetry(event, intentName, slots, "phoneNumber", {
    wrapFn,
    sessionCtx,
    treatAsRetry,
  });
}

function elicitBookingTime(event, intentName, slots, wrapFn) {
  const invalid = Boolean(slotRaw(slots, "bookingTime"));
  if (invalid) slots.bookingTime = clearedScalarSlot();

  return elicitSlotWithRetry(event, intentName, slots, "bookingTime", {
    wrapFn,
    ctx: { invalid },
    treatAsRetry: invalid,
  });
}

function elicitFullName(event, intentName, slots, wrapFn) {
  return elicitSlotWithRetry(event, intentName, slots, "fullName", { wrapFn });
}

function elicitEmail(event, intentName, slots, wrapFn) {
  if (slotRaw(slots, "email")) slots.email = clearedScalarSlot();

  return elicitSlotWithRetry(event, intentName, slots, "email", {
    wrapFn,
    treatAsRetry: Boolean(slotOriginal(slots, "email")),
  });
}

function closeResponse(event, intentName, slots, message) {
  return withLexSession(event, {
    sessionState: {
      dialogAction: {
        type: "Close",
      },
      intent: {
        name: intentName,
        slots,
        state: "Fulfilled",
      },
    },
    messages: [
      {
        contentType: "PlainText",
        content: message,
      },
    ],
  });
}

async function finishBooking(event, intentName, slots, s, opts = {}) {
  const successMsg =
    opts.successMessage ??
    "Thank you. Your appointment request has been submitted successfully.";

  if (
    s.bookingTime &&
    !isBookingTimeLexValueValid(slots, s.bookingTime, "", event)
  ) {
    console.log("INVALID_BOOKING_TIME_BLOCK_FINISH:", s.bookingTime);
    slots.bookingTime = clearedScalarSlot();
    return elicitBookingTime(event, intentName, slots);
  }

  try {
    const payload = buildPayloadFromSlots(slots, s);
    console.log("📦 ORYX PAYLOAD:", JSON.stringify(payload, null, 2));

    const result = await sendToOryx(payload);
    console.log("✅ ORYX RESPONSE:", JSON.stringify(result, null, 2));

    const booked = result?.success === true && result?.data?.success === true;

    if (booked) {
      return closeResponse(event, intentName, slots, successMsg);
    }

    return closeResponse(
      event,
      intentName,
      slots,
      result?.data?.message || "Booking could not be completed. Please try again."
    );
  } catch (err) {
    console.error("❌ ORYX BOOKING ERROR:", err?.stack || err);
    const msg = String(err?.message || "");
    if (msg.includes("Office hours") || msg.includes("booking time")) {
      slots.bookingTime = clearedScalarSlot();
      return elicitBookingTime(event, intentName, slots);
    }
    return closeResponse(
      event,
      intentName,
      slots,
      "Sorry, booking failed. Please try again later."
    );
  }
}

/* ---------------- ORYX / MIDDLEWARE ---------------- */

function buildPayloadFromSlots(slots, s) {
  const fullName = normalizeFullNameFromLex(String(s.fullName || "").trim());
  let { firstName, lastName } = splitFullName(fullName);
  if (firstName && !lastName) lastName = firstName;

  const dobDate = safeDate(s.dob);
  const serviceDate = safeDate(s.bookingDate);

  const { hour, minute } = parseBookingTimeToHourMinute(s.bookingTime);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid booking time from Lex: ${JSON.stringify(s.bookingTime)}`);
  }
  if (!isValidOfficeBookingTime(hour, minute)) {
    throw new Error(
      `Office hours only 8:00 AM - 4:00 PM: ${JSON.stringify(s.bookingTime)}`
    );
  }
  const { endHour, endMinute } = addMinutes(hour, minute, 30);

  const hasInsurance = String(s.hasInsurance || "").toLowerCase();
  const insuranceChanged = String(s.insuranceChanged || "").toLowerCase();
  const insurance =
    hasInsurance === "yes"
      ? "Yes"
      : hasInsurance === "no"
        ? "No"
        : insuranceChanged === "yes"
          ? "Yes"
          : insuranceChanged === "no"
            ? "No"
            : undefined;

  const patientType = String(s.patientType || "").toLowerCase();
  const newOrExisting = patientType === "existing" ? "existing" : "new";

  const appt = titleService(s.serviceType);

  const specialYes = String(s.hasSpecialNeeds || "").toLowerCase() === "yes";

  const notesParts = ["Booked via Twinkle ⭐️"];
  if (s.numAppointments) notesParts.push(`Requested appointments: ${s.numAppointments}`);
  if (s.lifeThreatening911) {
    notesParts.push(`Life-threatening screening: ${s.lifeThreatening911}`);
  }
  if (s.toothType) {
    notesParts.push(`Tooth type: ${s.toothType}`);
  }
  if (s.traumaPainInfection) {
    notesParts.push(`Trauma / pain / infection: ${s.traumaPainInfection}`);
  }
  if (s.referredOut) {
    notesParts.push(`Referred out for treatment (external): ${s.referredOut}`);
  }
  if (s.insuranceChanged) {
    notesParts.push(`Insurance information changed: ${s.insuranceChanged}`);
  }
  if (insurance) {
    notesParts.push(`Insurance: ${insurance}`);
  }
  if (s.insuranceCompanyName) {
    notesParts.push(`Insurance company: ${s.insuranceCompanyName}`);
  }
  if (s.insuranceMemberId) {
    notesParts.push(`Insurance member ID: ${s.insuranceMemberId}`);
  }

  return {
    apptType: appt,
    reason: appt,
    notes: notesParts.join(" | "),

    insurance,
    insuranceCompany: s.insuranceCompanyName || undefined,
    insuranceMemberId: s.insuranceMemberId || undefined,

    specialHealthcareNeeds: specialYes ? "Yes" : "No",
    specialHealthcareNeedsDetails: "",

    date: {
      year: serviceDate.getUTCFullYear(),
      month: serviceDate.getUTCMonth() + 1,
      day: serviceDate.getUTCDate(),
    },

    start: { hour, minute, second: 0, millis: 0 },
    end: { hour: endHour, minute: endMinute, second: 0, millis: 0 },

    dayOfWeek: serviceDate.getUTCDay(),

    operatoryId: 0,
    oralId: 0,

    firstName,
    lastName,
    preferredName: firstName,

    dob: {
      year: dobDate.getUTCFullYear(),
      month: dobDate.getUTCMonth() + 1,
      day: dobDate.getUTCDate(),
    },

    email: normalizeEmailFromLex(String(s.email || "").trim()),
    phoneNumber: String(s.phoneNumber || "").replace(/\D/g, "").trim(),

    newOrExisting,
  };
}

function titleService(serviceTypeLower) {
  const v = String(serviceTypeLower || "").trim().toLowerCase();
  if (v === "cleaning") return "Cleaning";
  /* Oryx + web book page use "Emergency", not "Dental Emergency". */
  if (v === "dental emergency") return "Emergency";
  if (v === "consultation") return "Consultation";
  if (v === "treatment") return "Treatment";
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "Cleaning";
}

/** If Oryx returns no online slots for this type, query Cleaning and map geometry (see sendToOryx). */
function apptTypeForAvailabilityFallback(bookApptType) {
  const t = String(bookApptType || "").trim();
  if (t === "Consultation" || t === "Emergency" || t === "Treatment") return "Cleaning";
  return t || "Cleaning";
}

/**
 * Oryx `operatoryId` is not the same as physical "Room N" labels.
 * Operatory rules (OP2=2 Cleaning/Emergency, OP3=3 Consultation, OP4=4 Treatment).
 * Env: SMILE_SQUAD_BOOKING_OPERATORY_TREATMENT default `4`
 */
function treatmentOperatoryId() {
  const id = Number(process.env.SMILE_SQUAD_BOOKING_OPERATORY_TREATMENT ?? "4");
  return Number.isFinite(id) && id > 0 ? id : 4;
}

/** Oryx ids for smilesquadpd: OP2≈6, OP3=3, OP4=4 (override via env JSON on API side). */
const DEFAULT_OPS_BY_TYPE = {
  Cleaning: [6, 2],
  Emergency: [6, 2],
  Consultation: [3],
};

function operatoryAllowSet(bookApptType) {
  const t = String(bookApptType || "").trim() || "Cleaning";
  if (t === "Treatment") return new Set([treatmentOperatoryId()]);
  const list = DEFAULT_OPS_BY_TYPE[t] || [2];
  return new Set(list);
}

function filterSlotsByOperatory(slots, bookApptType) {
  const arr = Array.isArray(slots) ? slots : [];
  const allow = operatoryAllowSet(bookApptType);
  return arr.filter((s) => allow.has(Number(s?.operatoryId)));
}

/** Prefer slots with oralId (provider); if none, keep list so booking can still be attempted. */
function filterSlotsWithValidOralId(slots) {
  const arr = Array.isArray(slots) ? slots : [];
  const ok = arr.filter((s) => Number(s?.oralId) > 0);
  return ok.length ? ok : arr;
}

/**
 * Slots for booking: operatory allow-list + prefer oralId.
 * Treatment: if no slot on the treatment operatory (default id 3) but schedule has other rows, widen once.
 */
function computeAvailableSlots(availRaw, bookApptType) {
  const raw = Array.isArray(availRaw) ? availRaw : [];
  const appt = String(bookApptType || "").trim();

  let slots = filterSlotsWithValidOralId(filterSlotsByOperatory(raw, appt));
  if (slots.length) return { slots, widenedOperatory: false };

  if (appt === "Treatment" && raw.length) {
    slots = filterSlotsWithValidOralId(raw);
    if (slots.length) return { slots, widenedOperatory: true };
  }

  return { slots: [], widenedOperatory: false };
}

/** Lex AMAZON.Time / Connect often send ISO or T12:00 — naive split(":") yields NaN and wrong slot. */
function parseBookingTimeToHourMinute(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { hour: NaN, minute: NaN };

  const mer = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s.replace(/\s+/g, " "));
  if (mer) {
    let h = Number(mer[1]);
    const m = Number(mer[2]);
    const isPm = mer[3].toUpperCase() === "PM";
    if (h === 12) h = isPm ? 12 : 0;
    else if (isPm) h += 12;
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hour: h, minute: m };
  }

  const isoDateTime = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (isoDateTime) {
    return { hour: Number(isoDateTime[2]), minute: Number(isoDateTime[3]) };
  }

  /* Lex AMAZON.Time often resolves "12pm" → interpretedValue "12:00" (24h noon, not midnight). */
  const tFragment =
    /(?:^|\s|T)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.exec(s);
  if (tFragment) {
    const h = Number(tFragment[1]);
    const m = Number(tFragment[2]);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hour: h, minute: m };
  }

  const clock =
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s) &&
    !/^\d{4}-\d{2}-\d{2}/.test(s) &&
    !s.includes("T");
  if (clock) {
    const parts = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (parts) {
      const h = Number(parts[1]);
      const m = Number(parts[2]);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hour: h, minute: m };
    }
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }

  const [a, b] = s.split(":").map((n) => Number(n));
  return { hour: a, minute: Number.isFinite(b) ? b : 0 };
}

function startMinutesFromSlot(slot) {
  return (
    Number(slot?.start?.hour) * 60 + Number(slot?.start?.minute)
  );
}

/** Exact match, else closest by wall-clock distance (not first row of the day). */
function pickBestSlot(availSlots, desiredHour, desiredMinute, bookApptType) {
  const slots = Array.isArray(availSlots) ? availSlots : [];
  if (!slots.length) return null;

  const wantH = Number(desiredHour);
  const wantM = Number(desiredMinute);
  const want = wantH * 60 + wantM;

  const exact = slots.find(
    (x) =>
      Number(x?.start?.hour) === wantH && Number(x?.start?.minute) === wantM
  );
  if (exact) return exact;

  if (!Number.isFinite(want)) return slots[0] || null;

  const allow = [...operatoryAllowSet(bookApptType)];
  const tieRank = (op) => {
    const i = allow.indexOf(Number(op));
    return i === -1 ? 50 : i;
  };

  let best = slots[0];
  let bestScore = Infinity;
  for (const x of slots) {
    const got = startMinutesFromSlot(x);
    if (!Number.isFinite(got)) continue;
    const circDist = Math.min(
      Math.abs(got - want),
      Math.abs(got + 24 * 60 - want),
      Math.abs(got - (want + 24 * 60))
    );
    const op = Number(x?.operatoryId);
    const score = circDist * 100 + tieRank(op);
    if (score < bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best || null;
}

function slotStartEndFromChosen(chosen) {
  const st = chosen?.start;
  const en = chosen?.end;
  return {
    start: {
      hour: Number(st?.hour),
      minute: Number(st?.minute),
      second: Number(st?.second ?? 0),
      millis: Number(st?.millis ?? 0),
    },
    end: {
      hour: Number(en?.hour),
      minute: Number(en?.minute),
      second: Number(en?.second ?? 0),
      millis: Number(en?.millis ?? 0),
    },
  };
}

function splitFullName(fullName) {
  const normalized = normalizeFullNameFromLex(String(fullName || "").trim());
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function safeDate(iso) {
  const d = new Date(String(iso || "").trim());
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

function addMinutes(h, m, add) {
  let endHour = Number(h);
  let endMinute = Number(m) + Number(add);
  while (endMinute >= 60) {
    endHour += 1;
    endMinute -= 60;
  }
  endHour = endHour % 24;
  return { endHour, endMinute };
}

async function fetchAvailability({ baseUrl, apiKey, previewCode, dateISO, apptType }) {
  const url =
    `${baseUrl.replace(/\/+$/, "")}/api/availability` +
    `?date=${encodeURIComponent(dateISO)}` +
    `&apptType=${encodeURIComponent(apptType)}` +
    `&firstAvail=false` +
    (previewCode ? `&code=${encodeURIComponent(previewCode)}` : "");

  const res = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      ...(previewCode ? { "x-preview-code": previewCode } : {}),
    },
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok || !json?.success) {
    throw new Error(`availability failed: HTTP ${res.status} ${text}`);
  }
  return Array.isArray(json.data) ? json.data : [];
}

// Phase 2: resolve tenant+bot via GET /api/internal/resolve-phone?did=... (PLATFORM_INTERNAL_SECRET)
// and use tenant-scoped operatory rules instead of duplicated env logic in this file.

async function sendToOryx(bookPayload) {
  const BOOKING_URL = process.env.API_BASE_URL;
  const API_KEY = process.env.CONNECT_WEBHOOK_SECRET;
  const PREVIEW = process.env.WEB_FORM_PREVIEW_CODE || "";

  if (!BOOKING_URL) throw new Error("API_BASE_URL missing");
  if (!API_KEY) throw new Error("CONNECT_WEBHOOK_SECRET missing");

  const u = new URL(BOOKING_URL);
  const baseUrl = `${u.protocol}//${u.host}`;

  const dateISO = `${String(bookPayload.date.year).padStart(4, "0")}-${String(
    bookPayload.date.month
  ).padStart(2, "0")}-${String(bookPayload.date.day).padStart(2, "0")}`;

  const apptType = bookPayload.apptType || "Cleaning";
  const desiredHour = bookPayload.start.hour;
  const desiredMinute = bookPayload.start.minute;

  /** Must match GET /api/availability apptType — Oryx rejects mismatched book vs schedule. */
  let lastQueriedApptType = apptType;

  let availRaw = await fetchAvailability({
    baseUrl,
    apiKey: API_KEY,
    previewCode: PREVIEW,
    dateISO,
    apptType: lastQueriedApptType,
  });

  let { slots: avail, widenedOperatory } = computeAvailableSlots(
    availRaw,
    apptType
  );

  if (!avail.length) {
    const fallback = apptTypeForAvailabilityFallback(apptType);
    if (fallback !== apptType) {
      lastQueriedApptType = fallback;
      availRaw = await fetchAvailability({
        baseUrl,
        apiKey: API_KEY,
        previewCode: PREVIEW,
        dateISO,
        apptType: lastQueriedApptType,
      });
      ({ slots: avail, widenedOperatory } = computeAvailableSlots(
        availRaw,
        apptType
      ));
    }

  }

  if (!avail.length) {
    throw new Error(
      "No slots in the allowed operatories for this service on that date. Set SMILE_SQUAD_BOOKING_OPERATORY_TREATMENT (default OP4 = operatoryId 4)."
    );
  }

  const chosen = pickBestSlot(avail, desiredHour, desiredMinute, apptType);
  if (!chosen) throw new Error("No availability returned for that date.");

  const { start: slotStart, end: slotEnd } = slotStartEndFromChosen(chosen);
  if (
    !Number.isFinite(slotStart.hour) ||
    !Number.isFinite(slotStart.minute) ||
    !Number.isFinite(slotEnd.hour) ||
    !Number.isFinite(slotEnd.minute)
  ) {
    throw new Error("Chosen slot is missing start/end times from availability.");
  }

  const oral = chosen.oralId != null ? Number(chosen.oralId) : 0;

  const requestedApptType = bookPayload.apptType;
  const bookedAsType = lastQueriedApptType;
  let notesForOryx =
    bookedAsType !== requestedApptType
      ? `${bookPayload.notes} | Requested appointment type: ${requestedApptType}`
      : bookPayload.notes;
  if (widenedOperatory) {
    notesForOryx = `${notesForOryx} | Treatment: no slot on preferred operatory; used next available from schedule.`;
  }

  const patched = {
    ...bookPayload,
    apptType: bookedAsType,
    reason: bookedAsType,
    notes: notesForOryx,
    dayOfWeek: Number(chosen.dayOfWeek),
    operatoryId: Number(chosen.operatoryId),
    oralId: Number.isFinite(oral) ? oral : 0,
    start: slotStart,
    end: slotEnd,
  };

  const res = await fetch(BOOKING_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify(patched),
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!res.ok) throw new Error(`booking API failed: ${res.status} ${text}`);
  return body;
}
