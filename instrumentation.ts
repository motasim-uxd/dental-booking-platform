/**
 * ECS injects secrets as a single JSON blob `APP_ENV_JSON` (see infra Terraform).
 * Merge into process.env before route handlers read WEB_FORM_PREVIEW_CODE and other keys.
 */
export function register() {
  const raw = process.env.APP_ENV_JSON;
  if (!raw?.trim()) return;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "string") process.env[key] = value;
      else if (typeof value === "number" || typeof value === "boolean") process.env[key] = String(value);
    }
  } catch {
    // Invalid JSON in secret — leave env as-is; failing routes should surface errors.
  }
}
