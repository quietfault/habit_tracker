import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Check, Flame, Trash2, Pencil, X, LogOut, ChevronDown, ChevronRight, BarChart3, ListChecks, FolderPlus, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "./supabaseClient";
import Stats from "./Stats.jsx";

const C = {
  bg: "#131319", surface: "#1C1C24", surface2: "#23232E", line: "#2E2E3A",
  text: "#EDEDF2", muted: "#8C8C9C", faint: "#3A3A48", gold: "#F5B544", goldHot: "#FFCB5C",
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = (d) => { const x = new Date(d); x.setHours(0,0,0,0); const w = (x.getDay() + 6) % 7; return addDays(x, -w); };
const last7 = () => [...Array(7)].map((_, i) => addDays(new Date(), -(6 - i)));

const WD = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
const MO = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
const TARGETS = [
  { v: 7, label: "Ежедневно" },
  { v: 1, label: "1×/нед" }, { v: 2, label: "2×/нед" }, { v: 3, label: "3×/нед" },
  { v: 4, label: "4×/нед" }, { v: 5, label: "5×/нед" }, { v: 6, label: "6×/нед" },
];
const COLLAPSE_KEY = "ht-collapsed-groups";
const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

export default function HabitTracker({ session }) {
  const [groups, setGroups] = useState([]);
  const [habits, setHabits] = useState([]);
  const [done, setDone] = useState(new Set());
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("today");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftGroup, setDraftGroup] = useState("");
  const [draftTarget, setDraftTarget] = useState(7);
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState("");
  const [collapsed, setCollapsed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "[]")); } catch { return new Set(); }
  });

  const days = useMemo(() => last7(), []);
  const now = new Date();
  const today = ymd(now);
  const persistCollapsed = (s) => localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...s]));

  const load = useCallback(async () => {
    const [{ data: gs }, { data: hs }, { data: cs }] = await Promise.all([
      supabase.from("groups").select("*").order("sort_order"),
      supabase.from("habits").select("*").order("sort_order"),
      supabase.from("completions").select("habit_id, day"),
    ]);
    setGroups(gs || []);
    setHabits(hs || []);
    setDone(new Set((cs || []).map((c) => `${c.habit_id}|${c.day}`)));
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const countInWeekOf = useCallback((hid, anyDate) => {
    const m = monday(anyDate);
    let c = 0;
    for (let i = 0; i < 7; i++) if (done.has(`${hid}|${ymd(addDays(m, i))}`)) c++;
    return c;
  }, [done]);
  const weeklyStreak = useCallback((hid, target) => {
    let m = monday(now);
    if (countInWeekOf(hid, m) < target) m = addDays(m, -7);
    let n = 0;
    while (countInWeekOf(hid, m) >= target) { n++; m = addDays(m, -7); }
    return n;
  }, [countInWeekOf, now]);
  const streak = (hid) => {
    const has = (ds) => done.has(`${hid}|${ds}`);
    let d = new Date(now);
    if (!has(ymd(d))) d = addDays(d, -1);
    let n = 0;
    while (has(ymd(d))) { n++; d = addDays(d, -1); }
    return n;
  };
  const isWeekly = (h) => (h.target_per_week ?? 7) < 7;
  const isSatisfied = (h) => isWeekly(h) ? countInWeekOf(h.id, now) >= h.target_per_week : done.has(`${h.id}|${today}`);

  const toggle = async (hid, ds) => {
    const key = `${hid}|${ds}`;
    const has = done.has(key);
    setDone((prev) => { const n = new Set(prev); has ? n.delete(key) : n.add(key); return n; });
    const { error } = has
      ? await supabase.from("completions").delete().eq("habit_id", hid).eq("day", ds)
      : await supabase.from("completions").insert({ habit_id: hid, day: ds });
    if (error) setDone((prev) => { const n = new Set(prev); has ? n.add(key) : n.delete(key); return n; });
  };
  const addHabit = async () => {
    const name = draft.trim();
    if (!name) return;
    setDraft(""); setAdding(false);
    const maxSort = habits.reduce((m, h) => Math.max(m, h.sort_order ?? 0), 0);
    const { data, error } = await supabase.from("habits")
      .insert({ name, sort_order: maxSort + 1, group_id: draftGroup || null, target_per_week: draftTarget })
      .select().single();
    if (!error && data) setHabits((h) => [...h, data]);
  };
  const removeHabit = async (hid) => {
    setHabits((h) => h.filter((x) => x.id !== hid));
    setDone((prev) => { const n = new Set(); prev.forEach((k) => { if (!k.startsWith(`${hid}|`)) n.add(k); }); return n; });
    await supabase.from("habits").delete().eq("id", hid);
  };
  const setHabitGroup = async (hid, groupId) => {
    setHabits((h) => h.map((x) => (x.id === hid ? { ...x, group_id: groupId } : x)));
    await supabase.from("habits").update({ group_id: groupId }).eq("id", hid);
  };
  const setHabitTarget = async (hid, t) => {
    setHabits((h) => h.map((x) => (x.id === hid ? { ...x, target_per_week: t } : x)));
    await supabase.from("habits").update({ target_per_week: t }).eq("id", hid);
  };
  const setHabitName = async (hid, name) => {
    setHabits((h) => h.map((x) => (x.id === hid ? { ...x, name } : x)));
    await supabase.from("habits").update({ name }).eq("id", hid);
  };
  // переставляет привычку внутри её группы (меняет sort_order с соседом)
  const moveHabit = async (h, dir) => {
    const sibs = habits.filter((x) => (x.group_id || null) === (h.group_id || null)).sort(bySort);
    const i = sibs.findIndex((x) => x.id === h.id);
    const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    const other = sibs[j];
    const a = h.sort_order ?? 0, b = other.sort_order ?? 0;
    setHabits((prev) => prev.map((x) => x.id === h.id ? { ...x, sort_order: b } : x.id === other.id ? { ...x, sort_order: a } : x));
    await Promise.all([
      supabase.from("habits").update({ sort_order: b }).eq("id", h.id),
      supabase.from("habits").update({ sort_order: a }).eq("id", other.id),
    ]);
  };
  const addGroup = async () => {
    const name = groupDraft.trim();
    if (!name) return;
    setGroupDraft(""); setAddingGroup(false);
    const { data, error } = await supabase.from("groups").insert({ name, sort_order: groups.length }).select().single();
    if (!error && data) setGroups((g) => [...g, data]);
  };
  const renameGroup = async (id, name) => {
    setGroups((g) => g.map((x) => (x.id === id ? { ...x, name } : x)));
    await supabase.from("groups").update({ name }).eq("id", id);
  };
  const removeGroup = async (id) => {
    setGroups((g) => g.filter((x) => x.id !== id));
    setHabits((h) => h.map((x) => (x.group_id === id ? { ...x, group_id: null } : x)));
    await supabase.from("groups").delete().eq("id", id);
  };
  const toggleCollapse = (id) => setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); persistCollapsed(n); return n; });
  const allGroupIds = groups.map((g) => g.id);
  const anyCollapsed = allGroupIds.some((id) => collapsed.has(id));
  const toggleAll = () => { const n = anyCollapsed ? new Set() : new Set(allGroupIds); setCollapsed(n); persistCollapsed(n); };

  const dailyHabits = habits.filter((h) => !isWeekly(h));
  const doneToday = dailyHabits.filter((h) => done.has(`${h.id}|${today}`)).length;
  const pct = dailyHabits.length ? Math.round((doneToday / dailyHabits.length) * 100) : 0;
  const headerDate = `${WD[now.getDay()]} · ${now.getDate()} ${MO[now.getMonth()]}`;
  const ungrouped = habits.filter((h) => !h.group_id).sort(bySort);
  const hasGroups = groups.length > 0;

  const rowProps = { done, today, days, editing, groups, toggle, removeHabit, setHabitGroup, setHabitTarget,
    setHabitName, moveHabit, streak, countInWeekOf, weeklyStreak, isWeekly, isSatisfied, now };

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100%" }}>
      <style>{`
        .ht-pop{animation:htpop .22s cubic-bezier(.34,1.56,.64,1)}@keyframes htpop{0%{transform:scale(.7)}100%{transform:scale(1)}}
        .ht-input::placeholder{color:${C.muted}}.ht-input:focus{outline:2px solid ${C.gold};outline-offset:1px}
        button:focus-visible{outline:2px solid ${C.gold};outline-offset:2px}
        select{color:${C.text};background:${C.surface2};border:1px solid ${C.line};border-radius:8px;padding:4px 6px;font-size:12px}
        @media (prefers-reduced-motion:reduce){.ht-pop{animation:none}}
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted }}>{headerDate}</div>
          <div style={{ display: "flex", gap: 4 }}>
            {view === "today" && (
              <button onClick={() => setEditing((e) => !e)} style={iconBtn(editing ? C.gold : C.muted)}>
                {editing ? <X size={13} /> : <Pencil size={13} />} {editing ? "Готово" : "Править"}
              </button>
            )}
            <button onClick={() => supabase.auth.signOut()} style={iconBtn(C.muted)} title="Выйти"><LogOut size={13} /></button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: C.surface, marginBottom: 20 }}>
          <SegBtn active={view === "today"} onClick={() => setView("today")} icon={<ListChecks size={15} />} label="Сегодня" />
          <SegBtn active={view === "stats"} onClick={() => setView("stats")} icon={<BarChart3 size={15} />} label="Статистика" />
        </div>

        {view === "stats" ? (
          <Stats habits={habits} done={done} groups={groups} />
        ) : (
          <>
            {dailyHabits.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{doneToday}</span>
                  <span style={{ fontSize: 18, color: C.muted }}>/ {dailyHabits.length} сегодня</span>
                </div>
                <div style={{ height: 6, width: "100%", borderRadius: 999, background: C.faint, overflow: "hidden", marginBottom: 20 }}>
                  <div style={{ height: "100%", borderRadius: 999, width: `${pct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldHot})`, transition: "width .5s" }} />
                </div>
              </>
            )}

            {hasGroups && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button onClick={toggleAll} style={{ ...iconBtn(C.muted), fontSize: 12 }}>{anyCollapsed ? "Развернуть всё" : "Свернуть всё"}</button>
              </div>
            )}

            {loaded && habits.length === 0 && !adding && (
              <div style={{ textAlign: "center", padding: "48px 0", borderRadius: 16, background: C.surface, border: `1px solid ${C.line}`, marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Пока пусто</div>
                <div style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>Добавь первую привычку — и поехали.</div>
                <button onClick={() => setAdding(true)} style={primaryBtn()}><Plus size={16} /> Добавить</button>
              </div>
            )}

            {groups.map((g) => {
              const items = habits.filter((h) => h.group_id === g.id).sort(bySort);
              const isCol = collapsed.has(g.id);
              const ok = items.filter((h) => isSatisfied(h)).length;
              return (
                <div key={g.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 2px", marginBottom: 8 }}>
                    <button onClick={() => toggleCollapse(g.id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: C.text, cursor: "pointer", padding: 0, flex: 1, minWidth: 0 }}>
                      {isCol ? <ChevronRight size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
                      {editing ? (
                        <input className="ht-input" defaultValue={g.name} onBlur={(e) => renameGroup(g.id, e.target.value.trim() || g.name)} onClick={(e) => e.stopPropagation()} style={{ flex: 1, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "3px 8px", color: C.text, fontSize: 14, fontWeight: 600 }} />
                      ) : (
                        <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span>
                      )}
                    </button>
                    <span style={{ fontSize: 12, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{ok}/{items.length}</span>
                    {editing && <button onClick={() => removeGroup(g.id)} title="Удалить группу" style={{ padding: 4, borderRadius: 8, color: "#E0656B", background: C.surface2, border: "none", cursor: "pointer" }}><Trash2 size={14} /></button>}
                  </div>
                  {!isCol && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {items.length === 0 && <div style={{ fontSize: 13, color: C.faint, paddingLeft: 22 }}>пусто</div>}
                      {items.map((h, i) => <HabitRow key={h.id} h={h} canUp={i > 0} canDown={i < items.length - 1} {...rowProps} />)}
                    </div>
                  )}
                </div>
              );
            })}

            {ungrouped.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {hasGroups && <div style={{ fontWeight: 600, fontSize: 14, color: C.muted, padding: "4px 2px 8px 22px" }}>Без группы</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ungrouped.map((h, i) => <HabitRow key={h.id} h={h} canUp={i > 0} canDown={i < ungrouped.length - 1} {...rowProps} />)}
                </div>
              </div>
            )}

            {habits.length > 0 && !adding && <button onClick={() => setAdding(true)} style={dashedBtn()}><Plus size={16} /> Новая привычка</button>}
            {adding && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 8, borderRadius: 16, background: C.surface, border: `1px solid ${C.gold}55` }}>
                <input autoFocus className="ht-input" value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addHabit(); if (e.key === "Escape") { setAdding(false); setDraft(""); } }}
                  placeholder="Название привычки…" style={{ flex: 1, minWidth: 130, background: "transparent", border: "none", padding: "6px 8px", fontSize: 14, color: C.text, outline: "none" }} />
                <select value={draftTarget} onChange={(e) => setDraftTarget(Number(e.target.value))}>
                  {TARGETS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
                {hasGroups && (
                  <select value={draftGroup} onChange={(e) => setDraftGroup(e.target.value)}>
                    <option value="">Без группы</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
                <button onClick={addHabit} style={{ padding: "6px 12px", borderRadius: 10, fontSize: 14, fontWeight: 500, background: C.gold, color: "#1A1208", border: "none", cursor: "pointer" }}>Добавить</button>
                <button onClick={() => { setAdding(false); setDraft(""); }} aria-label="Отмена" style={{ padding: 6, borderRadius: 10, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}><X size={16} /></button>
              </div>
            )}

            {habits.length > 0 && (
              addingGroup ? (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 16, background: C.surface, border: `1px solid ${C.line}` }}>
                  <input autoFocus className="ht-input" value={groupDraft} onChange={(e) => setGroupDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addGroup(); if (e.key === "Escape") { setAddingGroup(false); setGroupDraft(""); } }}
                    placeholder="Название группы…" style={{ flex: 1, background: "transparent", border: "none", padding: "6px 8px", fontSize: 14, color: C.text, outline: "none" }} />
                  <button onClick={addGroup} style={{ padding: "6px 12px", borderRadius: 10, fontSize: 14, fontWeight: 500, background: C.surface2, color: C.text, border: `1px solid ${C.line}`, cursor: "pointer" }}>Создать</button>
                  <button onClick={() => { setAddingGroup(false); setGroupDraft(""); }} aria-label="Отмена" style={{ padding: 6, borderRadius: 10, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => setAddingGroup(true)} style={{ ...dashedBtn(), marginTop: 8 }}><FolderPlus size={16} /> Новая группа</button>
              )
            )}

            <div style={{ textAlign: "center", fontSize: 12, marginTop: 24, color: C.faint }}>Тапни кружок — отметить день · недельные цели считаются за неделю</div>
          </>
        )}
      </div>
    </div>
  );
}

function HabitRow({ h, done, today, days, editing, groups, toggle, removeHabit, setHabitGroup, setHabitTarget, setHabitName, moveHabit, streak, countInWeekOf, weeklyStreak, isWeekly, isSatisfied, now, canUp, canDown }) {
  const weekly = isWeekly(h);
  const satisfied = isSatisfied(h);
  const todayDone = done.has(`${h.id}|${today}`);

  let subtitle;
  if (weekly) {
    const wc = countInWeekOf(h.id, now);
    const ws = weeklyStreak(h.id, h.target_per_week);
    const met = wc >= h.target_per_week;
    subtitle = (
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: met ? C.goldHot : C.muted, fontVariantNumeric: "tabular-nums" }}>{wc}/{h.target_per_week} на неделе</span>
        {ws > 0 && <><Flame size={12} color={C.gold} /><span style={{ fontSize: 12, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{ws} нед</span></>}
      </div>
    );
  } else {
    const s = streak(h.id);
    const hot = s >= 4;
    subtitle = (
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
        <Flame size={13} color={hot ? C.goldHot : s > 0 ? C.gold : C.faint} fill={hot ? C.goldHot : "none"} />
        <span style={{ fontSize: 12, color: s > 0 ? C.muted : C.faint, fontVariantNumeric: "tabular-nums" }}>{s > 0 ? `${s} дн.` : "нет серии"}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: editing ? "stretch" : "center", gap: 12, padding: 12, borderRadius: 16, background: C.surface, border: `1px solid ${satisfied ? C.gold + "55" : C.line}`, transition: "border-color .25s" }}>
      <button onClick={() => toggle(h.id, today)} aria-label="Отметить сегодня"
        style={{ flexShrink: 0, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: todayDone ? C.gold : "transparent", border: `2px solid ${todayDone ? C.gold : C.faint}`, cursor: "pointer", transition: "all .2s" }}>
        {todayDone && <Check size={20} strokeWidth={3} color="#1A1208" className="ht-pop" />}
      </button>

      {editing ? (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <input className="ht-input" defaultValue={h.name}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.name) setHabitName(h.id, v); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            style={{ width: "100%", boxSizing: "border-box", background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", color: C.text, fontSize: 14, fontWeight: 500 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <select value={h.target_per_week ?? 7} onChange={(e) => setHabitTarget(h.id, Number(e.target.value))}>
              {TARGETS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <select value={h.group_id || ""} onChange={(e) => setHabitGroup(h.id, e.target.value || null)}>
              <option value="">Без группы</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button onClick={() => moveHabit(h, -1)} disabled={!canUp} aria-label="Выше" style={miniBtn(!canUp)}><ArrowUp size={15} /></button>
            <button onClick={() => moveHabit(h, 1)} disabled={!canDown} aria-label="Ниже" style={miniBtn(!canDown)}><ArrowDown size={15} /></button>
            <button onClick={() => removeHabit(h.id)} aria-label="Удалить" style={{ padding: 7, borderRadius: 9, color: "#E0656B", background: C.surface2, border: "none", cursor: "pointer" }}><Trash2 size={15} /></button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
            {subtitle}
          </div>
          <div style={{ flexShrink: 0, display: "flex", gap: 4 }}>
            {days.map((d) => {
              const ds = ymd(d);
              const on = done.has(`${h.id}|${ds}`);
              const isT = ds === today;
              return <button key={ds} onClick={() => toggle(h.id, ds)} aria-label={`${WD[d.getDay()]} ${d.getDate()}`} title={`${WD[d.getDay()]} ${d.getDate()}`}
                style={{ width: 16, height: 22, borderRadius: 6, padding: 0, background: on ? C.gold : C.surface2, border: isT ? `1.5px solid ${on ? C.goldHot : C.muted}` : `1px solid ${C.line}`, cursor: "pointer", transition: "background .2s" }} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SegBtn({ active, onClick, icon, label }) {
  return <button onClick={onClick} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 9, fontSize: 14, fontWeight: 500, cursor: "pointer", border: "none", background: active ? C.surface2 : "transparent", color: active ? C.text : C.muted }}>{icon} {label}</button>;
}
function iconBtn(color) { return { display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, padding: "5px 8px", borderRadius: 8, color, background: "transparent", border: "none", cursor: "pointer" }; }
function miniBtn(disabled) { return { padding: 7, borderRadius: 9, color: disabled ? C.faint : C.text, background: C.surface2, border: `1px solid ${C.line}`, cursor: disabled ? "default" : "pointer", display: "flex", opacity: disabled ? 0.5 : 1 }; }
function primaryBtn() { return { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, fontWeight: 500, fontSize: 14, background: C.gold, color: "#1A1208", border: "none", cursor: "pointer" }; }
function dashedBtn() { return { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 0", borderRadius: 16, fontSize: 14, fontWeight: 500, color: C.muted, border: `1px dashed ${C.line}`, background: "transparent", cursor: "pointer" }; }
