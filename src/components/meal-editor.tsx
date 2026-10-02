"use client";
import { useState } from "react";
import { Coffee, Sun, Moon, Plus, Trash2, Check, Undo2 } from "lucide-react";
import type { Meal, Service } from "@/lib/types";
import { money, parseRupees, standardMeals, type MealInput } from "@/lib/domain";

const icons = { breakfast: Coffee, lunch: Sun, dinner: Moon, custom: Plus };
type EditorProps = {
  services: Service[]; meals: Meal[]; day: string; busy: boolean; error: string;
  save: (input: MealInput) => Promise<boolean>; remove: (meal: Meal) => Promise<boolean>;
  pay: (meal: Meal) => void; reverse: (meal: Meal) => void;
};
export function MealEditor(props: EditorProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const [extraId, setExtraId] = useState("");
  const [localError, setLocalError] = useState("");
  return <div>
    <p className="muted">Tick the meals you had. Empty meals are unused and won’t be charged.</p>
    {(props.error || localError) && <p role="alert" className="error sticky-error">{props.error || localError}</p>}
    {!props.services.length && <p className="empty-inline">Add a food service to start recording your meals.</p>}
    {props.services.map(service => <section key={service.id} className="day-service">
      <div className="day-service-heading"><div><h3>{service.name}</h3><span className="muted small">{service.category}{service.archived ? " · Archived" : ""}</span></div><span className="tag">{money(props.meals.filter(m => m.serviceId === service.id && m.day === props.day).reduce((n, m) => n + m.amount, 0))}</span></div>
      {standardMeals.map(kind => {
        const meal = props.meals.find(m => m.serviceId === service.id && m.day === props.day && m.kind === kind);
        return <MealRow key={`${service.id}-${kind}-${meal?.version ?? 0}`} service={service} day={props.day} kind={kind} meal={meal} busy={props.busy} save={props.save} remove={props.remove} pay={props.pay} reverse={props.reverse} onError={setLocalError} />;
      })}
      {props.meals.filter(m => m.serviceId === service.id && m.day === props.day && m.kind === "custom").map(meal => <MealRow key={`${meal.id}-${meal.version}`} service={service} day={props.day} kind="custom" meal={meal} busy={props.busy} save={props.save} remove={props.remove} pay={props.pay} reverse={props.reverse} onError={setLocalError} />)}
      {adding === service.id ? <form className="extra-form" onSubmit={async e => {
        e.preventDefault(); const data = new FormData(e.currentTarget); setLocalError("");
        try {
          const saved = await props.save({ id: extraId, serviceId: service.id, day: props.day, kind: "custom", label: String(data.get("label")), amount: parseRupees(String(data.get("amount"))), version: 0 });
          if (saved) setAdding(null);
        } catch (err) { setLocalError(err instanceof Error ? err.message : "Check the amount."); }
      }}><label>Custom meal<input name="label" aria-label="Custom meal name" placeholder="e.g. Evening snacks" required maxLength={80} disabled={props.busy} autoFocus /></label><label>Amount (₹)<input name="amount" aria-label="Custom meal amount" inputMode="decimal" placeholder="0.00" required disabled={props.busy} /></label><div className="button-row"><button className="button primary" disabled={props.busy}>Add meal</button><button type="button" className="button ghost" disabled={props.busy} onClick={() => setAdding(null)}>Cancel</button></div></form> : <button className="add-extra" disabled={props.busy || service.archived} onClick={() => { setAdding(service.id); setExtraId(crypto.randomUUID()); }}><Plus size={16} /> Add a custom meal</button>}
    </section>)}
  </div>;
}

function MealRow({ service, day, kind, meal, busy, save, remove, pay, reverse, onError }: {
  service: Service; day: string; kind: Meal["kind"]; meal?: Meal; busy: boolean;
  save: EditorProps["save"]; remove: EditorProps["remove"]; pay: EditorProps["pay"]; reverse: EditorProps["reverse"]; onError: (error: string) => void;
}) {
  const [id] = useState(() => meal?.id ?? crypto.randomUUID());
  const [amount, setAmount] = useState(String((meal?.amount ?? (kind === "custom" ? 0 : service[kind])) / 100));
  const [label, setLabel] = useState(meal?.label ?? kind);
  const Icon = icons[kind];
  const dirty = meal && (amount !== String(meal.amount / 100) || label !== meal.label);
  async function record() {
    onError("");
    try { return await save({ id, serviceId: service.id, day, kind, label, amount: parseRupees(amount), version: meal?.version ?? 0 }); }
    catch (err) { onError(err instanceof Error ? err.message : "Check the amount."); return false; }
  }
  return <div className={`meal-row ${meal ? "taken" : ""}`}>
    <label className="meal-taken"><input type="checkbox" aria-label={`${service.name} ${kind === "custom" ? meal?.label : kind} taken`} checked={Boolean(meal)} disabled={busy || Boolean(meal?.paymentId) || service.archived} onChange={() => meal ? void remove(meal) : void record()} /><Icon size={18} /><span className="capitalize">{kind === "custom" ? "Extra" : kind}</span></label>
    {kind === "custom" && <input className="custom-label" aria-label={`Meal name ${meal?.label}`} value={label} maxLength={80} disabled={busy || Boolean(meal?.paymentId) || service.archived} onChange={e => setLabel(e.target.value)} />}
    <label className="meal-amount"><span>₹</span><input aria-label={`${meal?.label ?? kind} amount for ${service.name}`} inputMode="decimal" value={amount} disabled={busy || Boolean(meal?.paymentId) || service.archived} onChange={e => setAmount(e.target.value)} /></label>
    {dirty && !meal?.paymentId && <button className="small-button" disabled={busy || service.archived} onClick={record}>Save</button>}
    {meal && <button className={`paid-toggle ${meal.paymentId ? "is-paid" : ""}`} disabled={busy || Boolean(dirty)} onClick={() => meal.paymentId ? reverse(meal) : pay(meal)} aria-label={`${meal.paymentId ? "Reverse payment for" : "Mark paid:"} ${meal.label}`} title={meal.paymentId ? "Reverse payment" : "Mark this meal paid"}>{meal.paymentId ? <><Undo2 size={13} /><span>Paid</span></> : <><Check size={13} /><span>Pay</span></>}</button>}
    {kind === "custom" && meal && !meal.paymentId && <button className="icon-button danger" disabled={busy || service.archived} aria-label={`Remove ${meal.label}`} onClick={() => remove(meal)}><Trash2 size={16} /></button>}
  </div>;
}
