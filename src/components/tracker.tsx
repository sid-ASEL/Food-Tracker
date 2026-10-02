"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Leaf, CalendarDays, Wallet, Store, Plus, ChevronLeft, ChevronRight, ArrowUpRight, ArrowRight, RefreshCw, LogOut, Copy, Check, Archive, Pencil, Undo2, Coffee } from "lucide-react";
import * as actions from "@/app/actions";
import { balances, calendarDays, money, monthEnd, shiftMonth, type MealInput, type ServiceInput } from "@/lib/domain";
import type { Meal, Payment, Result, Service, Snapshot } from "@/lib/types";
import { Modal } from "./modal";
import { ServiceForm } from "./service-form";
import { MealEditor } from "./meal-editor";
import { InstallApp } from "./install-app";
import { ThemeToggle } from "./theme-toggle";

type Tab = "tracker" | "payments" | "services";
type Confirmation = { title: string; description: string; label: string; execute: () => Promise<Result<Snapshot>>; after?: () => void };
const monthLabel = (month: string) => new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const dayLabel = (day: string) => new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

export function Tracker({ initial, today, userName }: { initial: Snapshot; today: string; userName: string }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("tracker");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [filter, setFilter] = useState("all");
  const [day, setDay] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(today);
  const [serviceForm, setServiceForm] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const busyRef = useRef(false);
  const requests = useRef(new Map<string, string>());

  const run = useCallback(async (execute: () => Promise<Result<Snapshot>>, successMessage = ""): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await execute();
      if (!result.ok) { setError(result.error); return false; }
      setData(result.data); setNotice(successMessage); return true;
    } catch { setError("Could not reach your tracker. Your changes have not been confirmed; please retry."); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible" && !busyRef.current) void run(actions.refreshData); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [run]);

  function request(key: string) {
    if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID());
    return requests.current.get(key)!;
  }
  function confirmPayment(meal: Meal) {
    const key = `meal-${meal.id}-${meal.version}`;
    setConfirmation({ title: "Mark this meal paid?", description: `${meal.label} at ${data.services.find(s => s.id === meal.serviceId)?.name} · ${money(meal.amount)}. Confirm once you’ve paid externally.`, label: "Mark paid", execute: () => actions.markPaid(meal.serviceId, meal.day, request(key), meal.id, [{ id: meal.id, version: meal.version }]), after: () => requests.current.delete(key) });
  }
  function confirmReverse(payment: Payment) {
    setConfirmation({ title: "Reverse this payment?", description: `This reopens all ${payment.mealCount} meal${payment.mealCount === 1 ? "" : "s"} covered by this ${money(payment.amount)} payment. The original record stays in your history.`, label: "Reverse payment", execute: () => actions.reversePayment(payment.serviceId, payment.id) });
  }
  function confirmSettle(service: Service) {
    const totals = balances(data.meals, service.id, month);
    const expected = data.meals.filter(m => m.serviceId === service.id && m.day <= monthEnd(month) && !m.paymentId).map(m => ({ id: m.id, version: m.version }));
    const key = `settle-${service.id}-${month}-${expected.map(m => `${m.id}:${m.version}`).join(",")}`;
    setConfirmation({ title: "All paid up?", description: `Record ${money(totals.due)} paid to ${service.name}, covering all unpaid meals through ${monthLabel(month)}, including older arrears. Your tracker will open ${monthLabel(shiftMonth(month, 1))}.`, label: "Pay all outstanding", execute: () => actions.settleService(service.id, monthEnd(month), request(key), expected), after: () => { requests.current.delete(key); setMonth(shiftMonth(month, 1)); setTab("tracker"); setDay(null); } });
  }
  async function saveMeal(input: MealInput) { return run(() => actions.saveMeal(input), "Meal saved."); }
  async function saveService(input: ServiceInput) {
    const saved = await run(() => actions.saveService(input), "Food service saved.");
    if (saved) setServiceForm(null);
    return saved;
  }
  async function copyPhone(service: Service) {
    try { await navigator.clipboard.writeText(service.phone); setCopied(service.id); setTimeout(() => setCopied(null), 2500); }
    catch { setError("Could not copy the phone number. You can select and copy it manually."); }
  }

  const shownServices = data.services.filter(s => filter === "all" || s.id === filter);
  const monthMeals = data.meals.filter(m => m.day.startsWith(month) && shownServices.some(s => s.id === m.serviceId));
  const totals = shownServices.reduce((acc, service) => {
    const b = balances(data.meals, service.id, month);
    return { charges: acc.charges + b.charges, paid: acc.paid + b.paid, due: acc.due + b.due, arrears: acc.arrears + b.arrears };
  }, { charges: 0, paid: 0, due: 0, arrears: 0 });
  const activeServices = data.services.filter(s => !s.archived);
  const summaryDay = selectedDay.startsWith(month) ? selectedDay : `${month}-01`;
  const dailyMeals = monthMeals.filter(m => m.day === summaryDay);
  const editorServices = shownServices.filter(s => !s.archived || data.meals.some(m => m.serviceId === s.id && m.day === day));
  const modalTitle = confirmation?.title ?? (day ? dayLabel(day) : serviceForm === "new" ? "Add a food service" : "Edit food service");
  const feedback = <>{error && <div className="error" role="alert">{error}<button className="text-button" disabled={busy} onClick={() => run(actions.refreshData)}>Reload latest data</button></div>}{notice && <div className="notice" role="status"><Check size={15} />{notice}</div>}</>;

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark" aria-hidden="true" />mealbook</div><span className="section-label nav-label">YOUR DAILY TABLE</span>
      <nav aria-label="Main navigation">{([{ id: "tracker", label: "Meal tracker", Icon: CalendarDays }, { id: "payments", label: "Payments", Icon: Wallet }, { id: "services", label: "Food services", Icon: Store }] as const).map(({ id, label, Icon }) => <button key={id} className={`nav-item ${tab === id ? "active" : ""}`} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon size={20} /><span>{label}</span>{tab === id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-note"><div className="note-leaf"><Leaf size={26} /></div><h3>A little routine.<br />A lot less guesswork.</h3><p>Log your meals and leave the mental maths to us.</p></div><div className="sidebar-bottom"><span className="avatar">{userName.slice(0, 1).toUpperCase()}</span><div><strong>{userName}</strong><span>Personal workspace</span></div><form action={actions.logOut}><button className="icon-button" aria-label="Sign out"><LogOut size={18} /></button></form></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><span className="mobile-brand"><span className="brand-mark" aria-hidden="true" /><span>mealbook</span></span><span className="topbar-date">{dayLabel(today)}</span><div className="topbar-actions"><span className="private-tag">Personal tracker</span><ThemeToggle /><InstallApp /><button className={`icon-button ${busy ? "spinning" : ""}`} aria-label="Refresh data" disabled={busy} onClick={() => run(actions.refreshData)}><RefreshCw size={17} /></button><form className="mobile-logout" action={actions.logOut}><button className="icon-button" aria-label="Sign out"><LogOut size={17} /></button></form></div></header>
      <div className="page-content">
        <div className="page-heading"><div><span className="eyebrow">{tab === "tracker" ? "YOUR EVERYDAY, SIMPLIFIED" : tab === "payments" ? "A CLEAR PICTURE" : "THE PEOPLE WHO FEED YOU"}</span><h1>{tab === "tracker" ? "Your meal tracker" : tab === "payments" ? "Payments & balances" : "Your food services"}<span className="heading-dot">.</span></h1><p>{tab === "tracker" ? `Hey ${userName}, keep the meals logged and the balances clear.` : tab === "payments" ? "See what’s settled, what’s due, and every payment along the way." : "Your regular spots, their meal prices, and payment details."}</p></div><button className="button primary" onClick={() => { setError(""); setServiceForm("new"); }}><Plus size={17} /> Add service</button></div>
        {feedback}
        {tab !== "services" && <>
          <div className="stat-grid"><Stat label="MEALS THIS MONTH" value={String(monthMeals.length)} hint="Every meal you’ve recorded" icon={<Coffee size={20} />} /><Stat label="MONTH’S TOTAL" value={money(totals.charges)} hint={`${money(totals.paid)} already paid`} icon={<Wallet size={20} />} /><Stat label="LEFT TO PAY" value={money(totals.due)} hint={totals.arrears ? `${money(totals.arrears)} includes earlier arrears` : "Through the selected month"} icon={<ArrowUpRight size={20} />} highlight /></div>
          <div className="toolbar"><div className="month-picker"><button className="icon-button" aria-label="Previous month" disabled={month === "2000-01"} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={19} /></button><label className="month-input"><span>{monthLabel(month)}</span><input type="month" aria-label="Select month and year" value={month} min="2000-01" max="2100-12" onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value) && e.target.value >= "2000-01" && e.target.value <= "2100-12") setMonth(e.target.value); }} /></label><button className="icon-button" aria-label="Next month" disabled={month === "2100-12"} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={19} /></button></div><div className="toolbar-right"><button className="text-button today-button" onClick={() => setMonth(today.slice(0, 7))}>This month</button><label className="service-filter"><Store size={16} /><select aria-label="Filter by food service" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All food services</option>{data.services.map(s => <option key={s.id} value={s.id}>{s.name}{s.archived ? " (archived)" : ""}</option>)}</select></label></div></div>
        </>}
        {tab === "tracker" && <>
          <section className="calendar-panel"><div className="panel-heading"><div><h2>A month at your table</h2><p>Tap a day to record meals or mark them paid.</p></div><div className="legend"><span><i className="dot green" />Paid</span><span><i className="dot amber" />Unpaid</span></div></div>
            <div className="calendar-grid">{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => <div className="weekday" key={d}>{d}</div>)}{calendarDays(month).map((date, i) => {
              const entries = monthMeals.filter(m => m.day === date);
              const due = entries.filter(m => !m.paymentId);
              return date ? <button key={date} className={`calendar-day ${date === today ? "is-today" : ""} ${entries.length ? "has-meals" : ""} ${date === summaryDay ? "is-selected" : ""}`} aria-label={`${dayLabel(date)}, ${entries.length} meals, ${due.length} unpaid`} onClick={() => { setError(""); setNotice(""); setSelectedDay(date); setDay(date); }}><span className="day-number">{Number(date.slice(-2))}</span>{date === today && <span className="today-label">TODAY</span>}{entries.length > 0 && <div className="day-details"><span className="day-dots" aria-hidden="true">{entries.some(m => m.paymentId) && <i className="dot green" />}{due.length > 0 && <i className="dot amber" />}</span><span className="meal-count">{entries.length} <span>meal{entries.length === 1 ? "" : "s"}</span></span><span className={`day-amount ${due.length ? "unpaid" : "settled"}`}><i className={`dot ${due.length ? "amber" : "green"}`} />{money(entries.reduce((n, m) => n + m.amount, 0))}</span></div>}</button> : <div className="calendar-day blank" key={`blank-${i}`} />;
            })}</div><div className="calendar-footer"><Leaf size={15} /><span>Empty days are unused. Only recorded meals count toward your balance.</span></div>
          </section>
          {activeServices.length > 0 && <section className="daily-summary" aria-label="Selected day meals"><div className="daily-heading"><span className="daily-icon"><Coffee size={22} /></span><div><h2>{dayLabel(summaryDay)}</h2><p>{dailyMeals.length} meal{dailyMeals.length === 1 ? "" : "s"} logged{summaryDay === today ? " today" : ""}</p></div><button className="small-button" onClick={() => { setError(""); setDay(summaryDay); }}><Pencil size={15} />Log meal</button></div>{dailyMeals.length ? <div className="daily-list">{dailyMeals.map(meal => <div className="daily-meal" key={meal.id}><i className={`dot ${meal.paymentId ? "green" : "amber"}`} /><div><strong>{meal.label}</strong><span>{data.services.find(s => s.id === meal.serviceId)?.name}</span></div><strong>{money(meal.amount)}</strong>{meal.paymentId ? <span className="tag">Paid</span> : <button className="pay-meal" disabled={busy} onClick={() => confirmPayment(meal)}>Pay {money(meal.amount)}</button>}</div>)}</div> : <p className="daily-empty">Nothing logged yet. Record a meal to keep your balance up to date.</p>}</section>}
          {!activeServices.length && <div className="onboarding"><div><h2>Your first meal starts here.</h2><p>Add a food service, set your meal prices, and pick a day to begin.</p></div><button className="button primary" onClick={() => setServiceForm("new")}>Add your first service <ArrowRight size={16} /></button></div>}
          {activeServices.length > 0 && <div className="below-calendar"><div><span className="section-label">ON YOUR TABLE</span><div className="service-chips">{activeServices.map(s => <button className="service-chip" key={s.id} onClick={() => setFilter(filter === s.id ? "all" : s.id)} aria-pressed={filter === s.id}><span className="chip-initial">{s.name.slice(0, 1)}</span>{s.name}<span>{s.category}</span></button>)}</div></div><button className="text-button" onClick={() => setTab("payments")}>View payment balances <ArrowRight size={16} /></button></div>}
        </>}
        {tab === "payments" && <>
          <div className="section-heading"><h2>Service balances</h2><span className="muted small">Through {monthLabel(month)}</span></div>
          {!shownServices.length && <Empty title="Nothing due yet." text="Add a service and record a meal to start tracking your balances." action={() => setServiceForm("new")} actionLabel="Set up first caterer" />}
          <div className="balance-grid">{shownServices.map(s => { const b = balances(data.meals, s.id, month); const unpaid = data.meals.some(m => m.serviceId === s.id && m.day <= monthEnd(month) && !m.paymentId); return <article className="balance-card" key={s.id}><div className="service-card-heading"><span className="service-emblem">{s.name.slice(0, 1)}</span><div><h3>{s.name}</h3><span className="muted small">{s.category}{s.archived ? " · Archived" : ""}</span></div><span className={`tag ${unpaid ? "amber-tag" : ""}`}>{unpaid ? "Payment due" : "All clear"}</span></div><div className="balance-lines"><div><span>This month</span><strong>{money(b.charges)}</strong></div><div><span>Already paid this month</span><strong>{money(b.paid)}</strong></div><div><span>Earlier unpaid meals</span><strong>{money(b.arrears)}</strong></div></div><div className="balance-total"><span>Left to pay</span><strong>{money(b.due)}</strong></div><button className="phone-copy" onClick={() => copyPhone(s)} aria-label={`Copy payment phone for ${s.name}`}><span>Payment phone <strong>{s.phone}</strong></span>{copied === s.id ? <Check size={16} /> : <Copy size={16} />}</button><button className="button primary full" disabled={busy || !unpaid || month === "2100-12"} onClick={() => confirmSettle(s)}>{unpaid ? "Pay all outstanding" : "All paid up"}<Check size={16} /></button></article>; })}</div>
          <div className="section-heading history-heading"><h2>Payment history</h2><span className="muted small">Payments recorded manually</span></div>
          <div className="history-panel">{data.payments.filter(p => filter === "all" || p.serviceId === filter).length === 0 ? <Empty title="A fresh start." text="Your payments will appear here once you mark meals paid." /> : data.payments.filter(p => filter === "all" || p.serviceId === filter).map(p => <div key={p.id} className={`history-row ${p.reversedAt ? "reversed" : ""}`}><span className="history-icon"><Wallet size={18} /></span><div className="history-info"><strong>{data.services.find(s => s.id === p.serviceId)?.name}</strong><span>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(p.createdAt))} · {p.mealCount} meal{p.mealCount === 1 ? "" : "s"}</span><span className="small">Through {dayLabel(p.cutoff)}{p.reversedAt ? ` · Reversed ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(p.reversedAt))}` : ""}</span></div><strong className="history-amount">{money(p.amount)}</strong>{p.reversedAt ? <span className="tag">Reversed</span> : <button className="small-button" disabled={busy} onClick={() => confirmReverse(p)}><Undo2 size={14} />Reverse</button>}</div>)}</div>
        </>}
        {tab === "services" && <>
          <div className="section-heading"><h2>Your regulars</h2><span className="muted small">{activeServices.length} active service{activeServices.length === 1 ? "" : "s"}</span></div>
          {!data.services.length && <Empty title="Who’s cooking?" text="Add your tiffin, mess, or favourite restaurant to get started." action={() => setServiceForm("new")} actionLabel="Set up first kitchen" />}
          <div className="service-grid">{data.services.map(s => <article className={`service-card ${s.archived ? "archived" : ""}`} key={s.id}><div className="service-card-heading"><span className="service-emblem">{s.name.slice(0, 1)}</span><div><h3>{s.name}</h3><span className="muted small">{s.category}</span></div><span className="tag">{s.archived ? "Archived" : "Active"}</span></div><div className="service-rates">{(["breakfast", "lunch", "dinner"] as const).map(kind => <div key={kind}><span className="capitalize">{kind}</span><strong>{money(s[kind])}</strong></div>)}</div><button className="phone-copy" onClick={() => copyPhone(s)}><span>Payment phone <strong>{s.phone}</strong></span>{copied === s.id ? <Check size={16} /> : <Copy size={16} />}</button><div className="service-actions"><button className="small-button" disabled={busy} onClick={() => { setError(""); setServiceForm(s.id); }}><Pencil size={14} />Edit service</button><button className="text-button" disabled={busy} onClick={() => setConfirmation({ title: s.archived ? "Restore this service?" : "Archive this service?", description: s.archived ? "This service will be available for recording meals again." : "Existing meals, payments, and outstanding balances will be kept. New meals will be disabled until you restore it.", label: s.archived ? "Restore service" : "Archive service", execute: () => actions.saveService({ ...s, archived: !s.archived }) })}><Archive size={14} />{s.archived ? "Restore" : "Archive"}</button></div></article>)}</div>
        </>}
        <footer className="page-footer">Made for your everyday. <Leaf size={12} /> All amounts in Indian rupees.</footer>
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{([{ id: "tracker", label: "Tracker", Icon: CalendarDays }, { id: "payments", label: "Payments", Icon: Wallet }, { id: "services", label: "Services", Icon: Store }] as const).map(({ id, label, Icon }) => <button key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon size={21} /><span>{label}</span></button>)}</nav>
    {(confirmation || day || serviceForm) && <Modal title={modalTitle} wide={Boolean(day && !confirmation)} busy={busy} onClose={() => { if (confirmation) setConfirmation(null); else { setDay(null); setServiceForm(null); } }}>
      {confirmation ? <><p className="confirm-description">{confirmation.description}</p>{feedback}<div className="button-row"><button className="button ghost" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={async () => { const confirmed = confirmation; const saved = await run(confirmed.execute, "Saved. Your balances are up to date."); if (saved) { setConfirmation(null); confirmed.after?.(); } }}>{busy ? "Saving…" : confirmation.label}</button></div></> : day ? <MealEditor services={editorServices} meals={data.meals} day={day} busy={busy} error={error} save={saveMeal} remove={meal => run(() => actions.removeMeal(meal.serviceId, meal.id, meal.version), "Meal removed.")} pay={confirmPayment} reverse={meal => { const payment = data.payments.find(p => p.id === meal.paymentId); if (payment) confirmReverse(payment); }} /> : <ServiceForm key={`${serviceForm}-${data.services.find(s => s.id === serviceForm)?.version ?? 0}`} service={data.services.find(s => s.id === serviceForm)} busy={busy} error={error} onSave={saveService} />}
      {day && !confirmation && !editorServices.length && <button className="button primary full" onClick={() => { setDay(null); setServiceForm("new"); }}><Plus size={18} />Add a food service</button>}
      {!confirmation && error && <button className="text-button" disabled={busy} onClick={() => run(actions.refreshData)}>Reload latest data</button>}
    </Modal>}
  </div>;
}
function Stat({ label, value, hint, icon, highlight = false }: { label: string; value: string; hint: string; icon: React.ReactNode; highlight?: boolean }) {
  return <div className={`stat-card ${highlight ? "highlight" : ""}`}><div className="stat-top"><span className="section-label">{label}</span><span className="stat-icon">{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-hint">{hint}</span></div>;
}
function Empty({ title, text, action, actionLabel }: { title: string; text: string; action?: () => void; actionLabel?: string }) {
  return <div className="empty-state"><span className="empty-icon"><Leaf size={26} /></span><h3>{title}</h3><p>{text}</p>{action && <button className="button ghost" onClick={action}><Plus size={18} />{actionLabel}</button>}</div>;
}
