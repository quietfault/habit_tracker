import { useCallback, useEffect, useState } from "react";
import {
  Plus, Trash2, Pencil, X, ChevronDown, ChevronRight, FolderPlus,
  Circle, CircleDot, CheckCircle2, ArrowUp, ArrowDown, Calendar,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const C = {
  bg: "#131319", surface: "#1C1C24", surface2: "#23232E", line: "#2E2E3A",
  text: "#EDEDF2", muted: "#8C8C9C", faint: "#3A3A48", gold: "#F5B544", goldHot: "#FFCB5C",
  danger: "#E0656B",
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = ymd(new Date());
const MO = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
const CYCLE = ["not_started", "in_progress", "done"];
const next = (s) => CYCLE[(CYCLE.indexOf(s) + 1) % 3];
const STATUS_LABEL = { not_started: "Не начата", in_progress: "В работе", done: "Выполнена" };
const COLLAPSE_KEY = "gt-collapsed-groups";

const fmtDate = (s) => {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}`;
};

function StatusIcon({ status, size = 20 }) {
  if (status === "done") return <CheckCircle2 size={size} color={C.gold} fill={C.gold} fillOpacity={0.18} />;
  if (status === "in_progress") return <CircleDot size={size} color={C.goldHot} />;
  return <Circle size={size} color={C.faint} />;
}

export default function Goals() {
  const [groups, setGroups] = useState([]);
  const [goals, setGoals] = useState([]);
  const [stages, setStages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "[]")); } catch { return new Set(); }
  });
  const [expanded, setExpanded] = useState(() => new Set());
  const [dismissed, setDismissed] = useState(() => new Set());

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftGroup, setDraftGroup] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState("");
  const [addingStageFor, setAddingStageFor] = useState(null);
  const [stageDraft, setStageDraft] = useState("");

  const persistCollapsed = (s) => localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...s]));

  const load = useCallback(async () => {
    const [{ data: gg }, { data: gs }, { data: st }] = await Promise.all([
      supabase.from("goal_groups").select("*").order("sort_order"),
      supabase.from("goals").select("*").order("sort_order"),
      supabase.from("goal_stages").select("*").order("sort_order"),
    ]);
    setGroups(gg || []); setGoals(gs || []); setStages(st || []); setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const stagesFor = (goalId) => stages.filter((s) => s.goal_id === goalId).sort(bySort);

  // ── group mutations ──
  const addGroup = async () => {
    const name = groupDraft.trim(); if (!name) return;
    setGroupDraft(""); setAddingGroup(false);
    const { data, error } = await supabase.from("goal_groups").insert({ name, sort_order: groups.length }).select().single();
    if (!error && data) setGroups((g) => [...g, data]);
  };
  const renameGroup = async (id, name) => {
    setGroups((g) => g.map((x) => (x.id === id ? { ...x, name } : x)));
    await supabase.from("goal_groups").update({ name }).eq("id", id);
  };
  const removeGroup = async (id) => {
    setGroups((g) => g.filter((x) => x.id !== id));
    setGoals((g) => g.map((x) => (x.group_id === id ? { ...x, group_id: null } : x)));
    await supabase.from("goal_groups").delete().eq("id", id);
  };
  const toggleCollapse = (id) => setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); persistCollapsed(n); return n; });
  const allGroupIds = groups.map((g) => g.id);
  const anyCollapsed = allGroupIds.some((id) => collapsed.has(id));
  const toggleAll = () => { const n = anyCollapsed ? new Set() : new Set(allGroupIds); setCollapsed(n); persistCollapsed(n); };

  // ── goal mutations ──
  const addGoal = async () => {
    const name = draftName.trim(); if (!name) return;
    setDraftName(""); setDraftDate(""); setAdding(false);
    const maxSort = goals.reduce((m, g) => Math.max(m, g.sort_order ?? 0), 0);
    const { data, error } = await supabase.from("goals")
      .insert({ name, target_date: draftDate || null, group_id: draftGroup || null, status: "not_started", sort_order: maxSort + 1 })
      .select().single();
    if (!error && data) setGoals((g) => [...g, data]);
  };
  const removeGoal = async (id) => {
    setGoals((g) => g.filter((x) => x.id !== id));
    setStages((s) => s.filter((x) => x.goal_id !== id));
    await supabase.from("goals").delete().eq("id", id);
  };
  const setGoalName = async (id, name) => {
    setGoals((g) => g.map((x) => (x.id === id ? { ...x, name } : x)));
    await supabase.from("goals").update({ name }).eq("id", id);
  };
  const setGoalDate = async (id, date) => {
    setGoals((g) => g.map((x) => (x.id === id ? { ...x, target_date: date || null } : x)));
    await supabase.from("goals").update({ target_date: date || null }).eq("id", id);
  };
  const setGoalGroup = async (id, groupId) => {
    setGoals((g) => g.map((x) => (x.id === id ? { ...x, group_id: groupId } : x)));
    await supabase.from("goals").update({ group_id: groupId }).eq("id", id);
  };
  const setGoalStatus = async (id, status) => {
    setGoals((g) => g.map((x) => (x.id === id ? { ...x, status } : x)));
    await supabase.from("goals").update({ status }).eq("id", id);
    setDismissed((p) => new Set(p).add(id));
  };
  const cycleGoalStatus = (goal) => setGoalStatus(goal.id, next(goal.status));
  const moveGoal = async (goal, dir) => {
    const sibs = goals.filter((x) => (x.group_id || null) === (goal.group_id || null)).sort(bySort);
    const i = sibs.findIndex((x) => x.id === goal.id); const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    const other = sibs[j]; const a = goal.sort_order ?? 0, b = other.sort_order ?? 0;
    setGoals((prev) => prev.map((x) => x.id === goal.id ? { ...x, sort_order: b } : x.id === other.id ? { ...x, sort_order: a } : x));
    await Promise.all([
      supabase.from("goals").update({ sort_order: b }).eq("id", goal.id),
      supabase.from("goals").update({ sort_order: a }).eq("id", other.id),
    ]);
  };

  // ── stage mutations ──
  const addStage = async (goalId) => {
    const name = stageDraft.trim(); if (!name) return;
    setStageDraft(""); setAddingStageFor(null);
    const cnt = stagesFor(goalId).length;
    const { data, error } = await supabase.from("goal_stages").insert({ goal_id: goalId, name, status: "not_started", sort_order: cnt }).select().single();
    if (!error && data) { setStages((s) => [...s, data]); setExpanded((prev) => new Set(prev).add(goalId)); }
  };
  const removeStage = async (id) => { setStages((s) => s.filter((x) => x.id !== id)); await supabase.from("goal_stages").delete().eq("id", id); };
  const setStageName = async (id, name) => {
    setStages((s) => s.map((x) => (x.id === id ? { ...x, name } : x)));
    await supabase.from("goal_stages").update({ name }).eq("id", id);
  };
  const cycleStageStatus = async (stage) => {
    const st = next(stage.status);
    setStages((s) => s.map((x) => (x.id === stage.id ? { ...x, status: st } : x)));
    await supabase.from("goal_stages").update({ status: st }).eq("id", stage.id);
  };
  const moveStage = async (stage, dir) => {
    const sibs = stagesFor(stage.goal_id);
    const i = sibs.findIndex((x) => x.id === stage.id); const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    const other = sibs[j]; const a = stage.sort_order ?? 0, b = other.sort_order ?? 0;
    setStages((prev) => prev.map((x) => x.id === stage.id ? { ...x, sort_order: b } : x.id === other.id ? { ...x, sort_order: a } : x));
    await Promise.all([
      supabase.from("goal_stages").update({ sort_order: b }).eq("id", stage.id),
      supabase.from("goal_stages").update({ sort_order: a }).eq("id", other.id),
    ]);
  };

  const toggleExpand = (id) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const ungrouped = goals.filter((g) => !g.group_id).sort(bySort);
  const hasGroups = groups.length > 0;

  const goalRowProps = {
    editing, groups, stagesFor, setGoalName, setGoalDate, setGoalGroup, cycleGoalStatus, setGoalStatus, removeGoal, moveGoal,
    addingStageFor, setAddingStageFor, stageDraft, setStageDraft, addStage, removeStage, cycleStageStatus, setStageName, moveStage,
    expanded, toggleExpand, dismissed, setDismissed,
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        {hasGroups && (
          <button onClick={toggleAll} style={iconBtn(C.muted)}>{anyCollapsed ? "Развернуть всё" : "Свернуть всё"}</button>
        )}
        <button onClick={() => setEditing((e) => !e)} style={iconBtn(editing ? C.gold : C.muted)}>
          {editing ? <X size={13} /> : <Pencil size={13} />} {editing ? "Готово" : "Править"}
        </button>
      </div>

      {loaded && goals.length === 0 && !adding && (
        <div style={{ textAlign: "center", padding: "48px 0", borderRadius: 16, background: C.surface, border: `1px solid ${C.line}`, marginBottom: 16 }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Целей пока нет</div>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>Добавь первую — и распиши по ней этапы.</div>
          <button onClick={() => setAdding(true)} style={primaryBtn()}><Plus size={16} /> Добавить</button>
        </div>
      )}

      {groups.map((g) => {
        const items = goals.filter((x) => x.group_id === g.id).sort(bySort);
        const isCol = collapsed.has(g.id);
        const done = items.filter((x) => x.status === "done").length;
        return (
          <div key={g.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 2px", marginBottom: 8 }}>
              <button onClick={() => toggleCollapse(g.id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: C.text, cursor: "pointer", padding: 0, flex: 1, minWidth: 0 }}>
                {isCol ? <ChevronRight size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
                {editing ? (
                  <input className="ht-input" defaultValue={g.name} onBlur={(e) => renameGroup(g.id, e.target.value.trim() || g.name)} onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "3px 8px", color: C.text, fontSize: 14, fontWeight: 600 }} />
                ) : (
                  <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span>
                )}
              </button>
              <span style={{ fontSize: 12, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{done}/{items.length}</span>
              {editing && <button onClick={() => removeGroup(g.id)} title="Удалить группу" style={{ padding: 4, borderRadius: 8, color: C.danger, background: C.surface2, border: "none", cursor: "pointer" }}><Trash2 size={14} /></button>}
            </div>
            {!isCol && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.length === 0 && <div style={{ fontSize: 13, color: C.faint, paddingLeft: 22 }}>пусто</div>}
                {items.map((goal, i) => <GoalRow key={goal.id} goal={goal} canUp={i > 0} canDown={i < items.length - 1} {...goalRowProps} />)}
              </div>
            )}
          </div>
        );
      })}

      {ungrouped.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {hasGroups && <div style={{ fontWeight: 600, fontSize: 14, color: C.muted, padding: "4px 2px 8px 22px" }}>Без группы</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ungrouped.map((goal, i) => <GoalRow key={goal.id} goal={goal} canUp={i > 0} canDown={i < ungrouped.length - 1} {...goalRowProps} />)}
          </div>
        </div>
      )}

      {goals.length > 0 && !adding && <button onClick={() => setAdding(true)} style={dashedBtn()}><Plus size={16} /> Новая цель</button>}
      {adding && (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 8, borderRadius: 16, background: C.surface, border: `1px solid ${C.gold}55` }}>
          <input autoFocus className="ht-input" value={draftName} onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addGoal(); if (e.key === "Escape") { setAdding(false); setDraftName(""); } }}
            placeholder="Название цели…" style={{ flex: 1, minWidth: 140, background: "transparent", border: "none", padding: "6px 8px", fontSize: 14, color: C.text, outline: "none" }} />
          <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} style={dateInputStyle()} />
          {hasGroups && (
            <select value={draftGroup} onChange={(e) => setDraftGroup(e.target.value)}>
              <option value="">Без группы</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <button onClick={addGoal} style={{ padding: "6px 12px", borderRadius: 10, fontSize: 14, fontWeight: 500, background: C.gold, color: "#1A1208", border: "none", cursor: "pointer" }}>Добавить</button>
          <button onClick={() => { setAdding(false); setDraftName(""); }} aria-label="Отмена" style={{ padding: 6, borderRadius: 10, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}><X size={16} /></button>
        </div>
      )}

      {goals.length > 0 && (
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

      {goals.length === 0 && adding === false && groups.length === 0 && null}
    </div>
  );
}

function GoalRow({
  goal, canUp, canDown, editing, groups, stagesFor, setGoalName, setGoalDate, setGoalGroup, cycleGoalStatus, setGoalStatus,
  removeGoal, moveGoal, addingStageFor, setAddingStageFor, stageDraft, setStageDraft, addStage, removeStage, cycleStageStatus,
  setStageName, moveStage, expanded, toggleExpand, dismissed, setDismissed,
}) {
  const st = stagesFor(goal.id);
  const hasStages = st.length > 0;
  const isExp = expanded.has(goal.id);
  const overdue = goal.target_date && goal.status !== "done" && goal.target_date < TODAY;
  const allStagesDone = hasStages && st.every((s) => s.status === "done");
  const showPrompt = allStagesDone && goal.status !== "done" && !dismissed.has(goal.id);

  return (
    <div style={{ borderRadius: 16, background: C.surface, border: `1px solid ${goal.status === "done" ? C.gold + "55" : C.line}`, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: editing ? "stretch" : "center", gap: 12, padding: 12 }}>
        <button onClick={() => cycleGoalStatus(goal)} aria-label="Статус цели" style={{ flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", padding: 0, marginTop: editing ? 4 : 0 }}>
          <StatusIcon status={goal.status} />
        </button>

        {editing ? (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <input className="ht-input" defaultValue={goal.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== goal.name) setGoalName(goal.id, v); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              style={{ width: "100%", boxSizing: "border-box", background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", color: C.text, fontSize: 14, fontWeight: 500 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <input type="date" defaultValue={goal.target_date || ""} onChange={(e) => setGoalDate(goal.id, e.target.value)} style={dateInputStyle()} />
              <select value={goal.group_id || ""} onChange={(e) => setGoalGroup(goal.id, e.target.value || null)}>
                <option value="">Без группы</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button onClick={() => moveGoal(goal, -1)} disabled={!canUp} aria-label="Выше" style={miniBtn(!canUp)}><ArrowUp size={15} /></button>
              <button onClick={() => moveGoal(goal, 1)} disabled={!canDown} aria-label="Ниже" style={miniBtn(!canDown)}><ArrowDown size={15} /></button>
              <button onClick={() => removeGoal(goal.id)} aria-label="Удалить" style={{ padding: 7, borderRadius: 9, color: C.danger, background: C.surface2, border: "none", cursor: "pointer" }}><Trash2 size={15} /></button>
            </div>
          </div>
        ) : (
          <div style={{ minWidth: 0, flex: 1, cursor: hasStages ? "pointer" : "default" }} onClick={() => hasStages && toggleExpand(goal.id)}>
            <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{goal.name}</div>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 3 }}>
              <span style={{ fontSize: 12, color: goal.status === "done" ? C.goldHot : C.muted }}>{STATUS_LABEL[goal.status]}</span>
              {goal.target_date && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: overdue ? C.danger : C.muted }}>
                  <Calendar size={11} /> {fmtDate(goal.target_date)}
                </span>
              )}
              {hasStages && (
                <span style={{ fontSize: 12, color: C.muted, fontVariantNumeric: "tabular-nums" }}>
                  {st.filter((s) => s.status === "done").length}/{st.length} этапов
                </span>
              )}
            </div>
          </div>
        )}

        {!editing && hasStages && (
          <button onClick={() => toggleExpand(goal.id)} aria-label="Развернуть этапы" style={{ flexShrink: 0, background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}>
            {isExp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>

      {showPrompt && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: C.gold + "18", borderTop: `1px solid ${C.gold}33` }}>
          <span style={{ fontSize: 12.5, color: C.goldHot }}>Все этапы выполнены — цель тоже готова?</span>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setGoalStatus(goal.id, "done")} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, background: C.gold, color: "#1A1208", border: "none", cursor: "pointer" }}>Да, готово</button>
            <button onClick={() => setDismissed((p) => new Set(p).add(goal.id))} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, background: "transparent", color: C.muted, border: `1px solid ${C.line}`, cursor: "pointer" }}>Ещё нет</button>
          </div>
        </div>
      )}

      {(isExp || editing) && (
        <div style={{ padding: "10px 12px 12px", borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
          {st.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => cycleStageStatus(s)} aria-label="Статус этапа" style={{ flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                <StatusIcon status={s.status} size={17} />
              </button>
              {editing ? (
                <>
                  <input className="ht-input" defaultValue={s.name}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) setStageName(s.id, v); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    style={{ flex: 1, minWidth: 0, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 8px", color: C.text, fontSize: 13 }} />
                  <button onClick={() => moveStage(s, -1)} disabled={i === 0} aria-label="Выше" style={miniBtn(i === 0)}><ArrowUp size={13} /></button>
                  <button onClick={() => moveStage(s, 1)} disabled={i === st.length - 1} aria-label="Ниже" style={miniBtn(i === st.length - 1)}><ArrowDown size={13} /></button>
                  <button onClick={() => removeStage(s.id)} aria-label="Удалить этап" style={{ padding: 6, borderRadius: 8, color: C.danger, background: C.surface2, border: "none", cursor: "pointer" }}><Trash2 size={13} /></button>
                </>
              ) : (
                <span style={{ fontSize: 13, color: s.status === "done" ? C.muted : C.text, textDecoration: s.status === "done" ? "line-through" : "none" }}>{s.name}</span>
              )}
            </div>
          ))}

          {addingStageFor === goal.id ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <input autoFocus className="ht-input" value={stageDraft} onChange={(e) => setStageDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addStage(goal.id); if (e.key === "Escape") { setAddingStageFor(null); setStageDraft(""); } }}
                placeholder="Название этапа…" style={{ flex: 1, minWidth: 0, background: C.surface2, border: `1px solid ${C.gold}55`, borderRadius: 8, padding: "5px 8px", color: C.text, fontSize: 13 }} />
              <button onClick={() => addStage(goal.id)} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, background: C.gold, color: "#1A1208", border: "none", cursor: "pointer" }}>+</button>
              <button onClick={() => { setAddingStageFor(null); setStageDraft(""); }} aria-label="Отмена" style={{ padding: 5, borderRadius: 8, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => setAddingStageFor(goal.id)} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: C.muted, background: "transparent", border: "none", cursor: "pointer", padding: "2px 0" }}>
              <Plus size={13} /> Этап
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function iconBtn(color) { return { display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, padding: "5px 8px", borderRadius: 8, color, background: "transparent", border: "none", cursor: "pointer" }; }
function miniBtn(disabled) { return { padding: 7, borderRadius: 9, color: disabled ? C.faint : C.text, background: C.surface2, border: `1px solid ${C.line}`, cursor: disabled ? "default" : "pointer", display: "flex", opacity: disabled ? 0.5 : 1 }; }
function primaryBtn() { return { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, fontWeight: 500, fontSize: 14, background: C.gold, color: "#1A1208", border: "none", cursor: "pointer" }; }
function dashedBtn() { return { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 0", borderRadius: 16, fontSize: 14, fontWeight: 500, color: C.muted, border: `1px dashed ${C.line}`, background: "transparent", cursor: "pointer" }; }
function dateInputStyle() { return { background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 6px", fontSize: 12, color: C.text, colorScheme: "dark" }; }
