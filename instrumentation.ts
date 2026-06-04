/**
 * ECS injects secrets as a single JSON blob `APP_ENV_JSON` (see infra Terraform).
 * Merge into process.env before route handlers read WEB_FORM_PREVIEW_CODE and other keys.
 */
export function register() {
  const raw = process.env.APP_ENV_JSON;
  if (!raw?.trim()) return;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    mergeEnv(parsed);
    return;
  } catch {
    // SM may use pseudo-JSON: {KEY:value,...}
    mergePseudoJsonEnv(raw);
  }
}

function mergeEnv(parsed: Record<string, unknown>) {
  for (const [key, value] of Object.entries(parsed)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") process.env[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") process.env[key] = String(value);
  }
}

function mergePseudoJsonEnv(raw: string) {
  const s = raw.trim();
  if (!s.startsWith("{") || !s.endsWith("}")) return;
  const inner = s.slice(1, -1);
  for (const part of inner.split(/,(?=[A-Za-z_][A-Za-z0-9_]*:)/)) {
    const idx = part.indexOf(":");
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key && value && process.env[key] === undefined) process.env[key] = value;
  }
}
