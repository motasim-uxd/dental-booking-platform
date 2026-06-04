"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Bot = {
  id: string;
  botKey: string;
  botType: string;
  enabled: boolean;
  promptsConfig: unknown;
  lexBotId: string | null;
};

type Phone = {
  id: string;
  e164: string;
  label: string | null;
  botId: string;
  bot: { botKey: string };
};

type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
  features: unknown;
  branding: unknown;
  webFormAccessCode: string | null;
  maxBots: number;
  pmsConfig: {
    pmsType: string;
    integrationMode: string;
    dualBookingEnabled: boolean;
    config: unknown;
    operatoryRules: unknown;
  } | null;
  bots: Bot[];
  phoneNumbers: Phone[];
};

export default function TenantManageClient({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const features = (tenant.features ?? {}) as { voice?: boolean; webForm?: boolean };
  const config = (tenant.pmsConfig?.config ?? {}) as { realm?: string };
  const branding = (tenant.branding ?? {}) as Record<string, string>;

  async function patchTenant(body: Record<string, unknown>) {
    setError("");
    setMsg("");
    const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error ?? "Save failed");
      return false;
    }
    setMsg("Saved.");
    router.refresh();
    return true;
  }

  async function onTenantSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await patchTenant({
      name: String(fd.get("name") ?? ""),
      status: String(fd.get("status") ?? "active"),
      oryxRealm: String(fd.get("oryxRealm") ?? ""),
      integrationMode: String(fd.get("integrationMode") ?? "external_only"),
      dualBookingEnabled: fd.get("dualBookingEnabled") === "on",
      features: {
        voice: fd.get("voice") === "on",
        webForm: fd.get("webForm") === "on",
      },
      webFormAccessCode: String(fd.get("webFormAccessCode") ?? "") || null,
      branding: {
        displayName: String(fd.get("displayName") ?? ""),
        tagline: String(fd.get("tagline") ?? ""),
        address: String(fd.get("address") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        websiteUrl: String(fd.get("websiteUrl") ?? ""),
      },
    });
  }

  async function onAddBot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch(`/api/admin/tenants/${tenant.id}/bots`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        botKey: String(fd.get("botKey") ?? ""),
        botType: String(fd.get("botType") ?? "other"),
        displayName: String(fd.get("displayName") ?? ""),
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error ?? "Add bot failed");
      return;
    }
    form.reset();
    router.refresh();
  }

  async function toggleBot(bot: Bot) {
    await fetch(`/api/admin/tenants/${tenant.id}/bots/${bot.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !bot.enabled }),
    });
    router.refresh();
  }

  async function updateBotDisplay(bot: Bot, displayName: string) {
    await fetch(`/api/admin/tenants/${tenant.id}/bots/${bot.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    router.refresh();
  }

  async function deleteBot(botId: string) {
    if (!confirm("Delete this bot?")) return;
    await fetch(`/api/admin/tenants/${tenant.id}/bots/${botId}`, { method: "DELETE" });
    router.refresh();
  }

  async function onAddPhone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch(`/api/admin/tenants/${tenant.id}/phones`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        botId: String(fd.get("botId") ?? ""),
        e164: String(fd.get("e164") ?? ""),
        label: String(fd.get("label") ?? ""),
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error ?? "Add phone failed");
      return;
    }
    form.reset();
    router.refresh();
  }

  async function deletePhone(phoneId: string) {
    if (!confirm("Remove this phone mapping?")) return;
    await fetch(`/api/admin/tenants/${tenant.id}/phones/${phoneId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <main className="admin-main">
      {error ? <p className="admin-error">{error}</p> : null}
      {msg ? <p style={{ color: "#166534", fontSize: "0.9rem" }}>{msg}</p> : null}

      <div className="admin-card">
        <h2>
          {tenant.name} <code style={{ fontWeight: 400 }}>({tenant.slug})</code>
        </h2>
        <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
          <a href={`/book/${tenant.slug}`} target="_blank" rel="noreferrer">
            Open web booking
          </a>
          {" · "}
          <code>/api/t/{tenant.slug}/…</code>
        </p>
        <form onSubmit={onTenantSubmit}>
          <div className="admin-grid-2">
            <div className="admin-field">
              <label htmlFor="name">Practice name</label>
              <input id="name" name="name" defaultValue={tenant.name} required />
            </div>
            <div className="admin-field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={tenant.status}>
                <option value="active">active</option>
                <option value="trial">trial</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="oryxRealm">Oryx realm</label>
              <input
                id="oryxRealm"
                name="oryxRealm"
                defaultValue={config.realm ?? ""}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="integrationMode">Integration mode</label>
              <select
                id="integrationMode"
                name="integrationMode"
                defaultValue={tenant.pmsConfig?.integrationMode ?? "external_only"}
              >
                <option value="external_only">external_only (Oryx)</option>
                <option value="internal_only">internal_only (platform DB)</option>
                <option value="dual">dual (Oryx + mirror)</option>
              </select>
            </div>
            <div className="admin-field">
              <label>
                <input
                  type="checkbox"
                  name="dualBookingEnabled"
                  defaultChecked={Boolean(tenant.pmsConfig?.dualBookingEnabled)}
                />{" "}
                Dual booking enabled (mirror to internal when mode=dual)
              </label>
            </div>
            <div className="admin-field">
              <label htmlFor="webFormAccessCode">Web form access code</label>
              <input
                id="webFormAccessCode"
                name="webFormAccessCode"
                defaultValue={tenant.webFormAccessCode ?? ""}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="displayName">Display name (web)</label>
              <input
                id="displayName"
                name="displayName"
                defaultValue={branding.displayName ?? ""}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="tagline">Tagline</label>
              <input id="tagline" name="tagline" defaultValue={branding.tagline ?? ""} />
            </div>
            <div className="admin-field">
              <label htmlFor="address">Address</label>
              <input id="address" name="address" defaultValue={branding.address ?? ""} />
            </div>
            <div className="admin-field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" defaultValue={branding.phone ?? ""} />
            </div>
          </div>
          <div className="admin-field">
            <label>
              <input type="checkbox" name="voice" defaultChecked={features.voice !== false} /> Voice
              (default product)
            </label>
          </div>
          <div className="admin-field">
            <label>
              <input type="checkbox" name="webForm" defaultChecked={Boolean(features.webForm)} />{" "}
              Web form add-on
            </label>
          </div>
          <button type="submit" className="admin-btn admin-btn-primary">
            Save tenant
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>Bots ({tenant.bots.length} / {tenant.maxBots})</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Type</th>
              <th>Display name</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tenant.bots.map((b) => {
              const prompts = (b.promptsConfig ?? {}) as { displayName?: string };
              return (
                <tr key={b.id}>
                  <td>
                    <code>{b.botKey}</code>
                  </td>
                  <td>{b.botType}</td>
                  <td>
                    <input
                      defaultValue={prompts.displayName ?? b.botKey}
                      onBlur={(e) => void updateBotDisplay(b, e.target.value)}
                      style={{ maxWidth: "10rem" }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`admin-btn ${b.enabled ? "admin-btn-primary" : "admin-btn-ghost"}`}
                      onClick={() => void toggleBot(b)}
                    >
                      {b.enabled ? "on" : "off"}
                    </button>
                  </td>
                  <td>
                    {b.botKey !== "booking" ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        onClick={() => void deleteBot(b.id)}
                      >
                        Delete
                      </button>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>required</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {tenant.bots.length < tenant.maxBots ? (
          <form onSubmit={onAddBot} style={{ marginTop: "1rem" }}>
            <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Add optional bot (on request)</p>
            <div className="admin-grid-2">
              <div className="admin-field">
                <label>botKey</label>
                <input name="botKey" placeholder="recall" required />
              </div>
              <div className="admin-field">
                <label>Display name</label>
                <input name="displayName" placeholder="Stephanie" />
              </div>
              <div className="admin-field">
                <label>Type</label>
                <select name="botType" defaultValue="other">
                  <option value="booking">booking</option>
                  <option value="admin">admin</option>
                  <option value="faq">faq</option>
                  <option value="other">other</option>
                </select>
              </div>
            </div>
            <button type="submit" className="admin-btn admin-btn-ghost">
              Add bot
            </button>
          </form>
        ) : null}
      </div>

      <div className="admin-card">
        <h2>Phone numbers (DID → bot)</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>E.164</th>
              <th>Label</th>
              <th>Bot</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tenant.phoneNumbers.map((p) => (
              <tr key={p.id}>
                <td>
                  <code>{p.e164}</code>
                </td>
                <td>{p.label ?? "—"}</td>
                <td>{p.bot.botKey}</td>
                <td>
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    onClick={() => void deletePhone(p.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={onAddPhone} style={{ marginTop: "1rem" }}>
          <div className="admin-grid-2">
            <div className="admin-field">
              <label>Bot</label>
              <select name="botId" required defaultValue={tenant.bots[0]?.id ?? ""}>
                {tenant.bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.botKey}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label>E.164</label>
              <input name="e164" placeholder="+17178848807" required />
            </div>
            <div className="admin-field">
              <label>Label</label>
              <input name="label" placeholder="Main line" />
            </div>
          </div>
          <button type="submit" className="admin-btn admin-btn-ghost">
            Add phone
          </button>
        </form>
      </div>
    </main>
  );
}
