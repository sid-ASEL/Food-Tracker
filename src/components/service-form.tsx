"use client";
import { useState } from "react";
import type { Service } from "@/lib/types";
import { parseRupees, type ServiceInput } from "@/lib/domain";
const presets = ["Tiffin", "Mess", "Restaurant"];
export function ServiceForm({ service, busy, error, onSave }: { service?: Service; busy: boolean; error: string; onSave: (value: ServiceInput) => Promise<boolean> }) {
  const [id] = useState(() => service?.id ?? crypto.randomUUID());
  const [category, setCategory] = useState(service && !presets.includes(service.category) ? "Other" : service?.category ?? "Tiffin");
  const [localError, setLocalError] = useState("");
  return <form onSubmit={async e => {
    e.preventDefault(); setLocalError("");
    const data = new FormData(e.currentTarget);
    try {
      await onSave({ id, name: String(data.get("name")), phone: String(data.get("phone")), category: category === "Other" ? String(data.get("customCategory")) : category,
        breakfast: parseRupees(String(data.get("breakfast"))), lunch: parseRupees(String(data.get("lunch"))), dinner: parseRupees(String(data.get("dinner"))), archived: service?.archived ?? false, version: service?.version ?? 0 });
    } catch (err) { setLocalError(err instanceof Error ? err.message : "Check your amounts."); }
  }}>
    <p className="muted">Set it up once. We’ll use these prices when you record a meal.</p>
    <fieldset disabled={busy} className="form-fields">
      <label>Service name<input name="name" defaultValue={service?.name} placeholder="e.g. Amma’s Kitchen" required maxLength={80} autoFocus /></label>
      <div className="form-grid"><label>Category<select value={category} onChange={e => setCategory(e.target.value)}>{[...presets, "Other"].map(v => <option key={v}>{v}</option>)}</select></label><label>Payment phone<input name="phone" type="tel" defaultValue={service?.phone} placeholder="e.g. 9876543210" required maxLength={20} /></label></div>
      {category === "Other" && <label>Custom category<input name="customCategory" defaultValue={service?.category} placeholder="e.g. Office canteen" required maxLength={40} /></label>}
      <div className="section-label">STANDARD MEAL PRICES · ₹</div>
      <div className="price-grid">{(["breakfast", "lunch", "dinner"] as const).map(kind => <label key={kind} className="capitalize">{kind}<input aria-label={`${kind} price`} name={kind} inputMode="decimal" defaultValue={service ? String(service[kind] / 100) : ""} placeholder="0.00" required /></label>)}</div>
      <p className="hint">Prices can be overridden for individual meals. Changes here won’t alter meals you’ve already recorded.</p>
    </fieldset>
    {(localError || error) && <p className="error" role="alert">{localError || error}</p>}
    <button className="button primary full" disabled={busy} type="submit">{busy ? "Saving…" : service ? "Save changes" : "Add food service"}</button>
  </form>;
}
