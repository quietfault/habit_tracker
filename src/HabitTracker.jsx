import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Check, Flame, Trash2, Pencil, X, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";

const C = {
  bg: "#131319",
  surface: "#1C1C24",
  surface2: "#23232E",
  line: "#2E2E3A",
  text: "#EDEDF2",
  muted: "#8C8C9C",
  faint: "#3A3A48",
  gold: "#F5B544",
  goldHot: "#FFCB5C",
};

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const last7 = () =>
  [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MO = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];

export default function HabitTracker({ session }) {
  const [habits, setHabits] = useState([]);
  // done: Set of "habitId|YYYY-MM-DD"
  const [done, setDone] = useState(new Set());
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const days = useMemo(() => last7(), []);
  const today = ymd(new Date());

  const load = useCallback(async () => {
    const [{ data: hs }, { data: cs }] = await Promise.all([
      supabase.from("habits").select("*").order("sort_order"),
      supabase.from("completions").select("habit_id, day"),
    ]);
    setHabits(hs || []);
    setDone(new Set((cs || []).map((c) => `${c.habit_id}|${c.day}`)));
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // refetch when tab regains focus → picks up changes from other devices
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const toggle = async (hid, ds) => {
    const key = `${hid}|${ds}`;
    const has = done.has(key);
    // optimistic
    setDone((prev) => {
      const n = new Set(prev);
      has ? n.delete(key) : n.add(key);
      return n;
    });
    const { error } = has
      ? await supabase.from("completions").delete().eq("habit_id", hid).eq("day", ds)
      : await supabase.from("completions").insert({ habit_id: hid, day: ds });
    if (error) {
      // revert on failure
      setDone((prev) => {
        const n = new Set(prev);
        has ? n.add(key) : n.delete(key);
        return n;
      });
    }
  };

  const addHabit = async () => {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    setAdding(false);
    const { data, error } = await supabase
      .from("habits")
      .insert({ name, sort_order: habits.length })
      .select()
      .single();
    if (!error && data) setHabits((h) => [...h, data]);
  };

  const removeHabit = async (hid) => {
    setHabits((h) => h.filter((x) => x.id !== hid));
    setDone((prev) => {
      const n = new Set();
      prev.forEach((k) => {
        if (!k.startsWith(`${hid}|`)) n.add(k);
      });
      return n;
    });
    await supabase.from("habits").delete().eq("id", hid);
  };

  const streak = (hid) => {
    const has = (ds) => done.has(`${hid}|${ds}`);
    const d = new Date();
    if (!has(ymd(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (has(ymd(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  };

  const doneToday = habits.filter((h) => done.has(`${h.id}|${today}`)).length;
  const pct = habits.length ? Math.round((doneToday / habits.length) * 100) : 0;

  const now = new Date();
  const headerDate = `${WD[now.getDay()]} · ${now.getDate()} ${MO[now.getMonth()]}`;

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100%" }}>
      <style>{`
        .ht-pop { animation: htpop .22s cubic-bezier(.34,1.56,.64,1); }
        @keyframes htpop { 0%{transform:scale(.7)} 100%{transform:scale(1)} }
        .ht-input::placeholder { color: ${C.muted}; }
        .ht-input:focus { outline: 2px solid ${C.gold}; outline-offset: 1px; }
        button:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .ht-pop { animation: none; }
        }
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted }}>
            {headerDate}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setEditing((e) => !e)} style={iconBtn(C, editing ? C.gold : C.muted)}>
              {editing ? <X size={13} /> : <Pencil size={13} />}
              {editing ? "Готово" : "Править"}
            </button>
            <button onClick={() => supabase.auth.signOut()} style={iconBtn(C, C.muted)} title="Выйти">
              <LogOut size={13} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{doneToday}</span>
          <span style={{ fontSize: 18, color: C.muted }}>/ {habits.length} сегодня</span>
        </div>

        <div style={{ height: 6, width: "100%", borderRadius: 999, background: C.faint, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ height: "100%", borderRadius: 999, width: `${pct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldHot})`, transition: "width .5s" }} />
        </div>

        {loaded && habits.length === 0 && !adding && (
          <div style={{ textAlign: "center", padding: "48px 0", borderRadius: 16, background: C.surface, border: `1px solid ${C.line}`, marginBottom: 16 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Пока пусто</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>Добавь первую привычку — и поехали.</div>
            <button onClick={() => setAdding(true)} style={primaryBtn(C)}>
              <Plus size={16} /> Добавить
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {habits.map((h) => {
            const isToday = done.has(`${h.id}|${today}`);
            const s = streak(h.id);
            const hot = s >= 4;
            return (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, background: C.surface, border: `1px solid ${isToday ? C.gold + "55" : C.line}`, transition: "border-color .25s" }}>
                <button
                  onClick={() => toggle(h.id, today)}
                  aria-label={isToday ? "Снять отметку" : "Отметить сегодня"}
                  style={{ flexShrink: 0, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: isToday ? C.gold : "transparent", border: `2px solid ${isToday ? C.gold : C.faint}`, cursor: "pointer", transition: "all .2s" }}
                >
                  {isToday && <Check size={20} strokeWidth={3} color="#1A1208" className="ht-pop" />}
                </button>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Flame size={13} color={hot ? C.goldHot : s > 0 ? C.gold : C.faint} fill={hot ? C.goldHot : "none"} />
                    <span style={{ fontSize: 12, color: s > 0 ? C.muted : C.faint, fontVariantNumeric: "tabular-nums" }}>
                      {s > 0 ? `${s} дн.` : "нет серии"}
                    </span>
                  </div>
                </div>

                {editing ? (
                  <button onClick={() => removeHabit(h.id)} aria-label="Удалить привычку" style={{ flexShrink: 0, padding: 8, borderRadius: 10, color: "#E0656B", background: C.surface2, border: "none", cursor: "pointer" }}>
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <div style={{ flexShrink: 0, display: "flex", gap: 4 }}>
                    {days.map((d) => {
                      const ds = ymd(d);
                      const on = done.has(`${h.id}|${ds}`);
                      const isT = ds === today;
                      return (
                        <button
                          key={ds}
                          onClick={() => toggle(h.id, ds)}
                          aria-label={`${WD[d.getDay()]} ${d.getDate()}`}
                          title={`${WD[d.getDay()]} ${d.getDate()}`}
                          style={{ width: 16, height: 22, borderRadius: 6, padding: 0, background: on ? C.gold : C.surface2, border: isT ? `1.5px solid ${on ? C.goldHot : C.muted}` : `1px solid ${C.line}`, cursor: "pointer", transition: "background .2s" }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {habits.length > 0 && !adding && (
          <button onClick={() => setAdding(true)} style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 0", borderRadius: 16, fontSize: 14, fontWeight: 500, color: C.muted, border: `1px dashed ${C.line}`, background: "transparent", cursor: "pointer" }}>
            <Plus size={16} /> Новая привычка
          </button>
        )}

        {adding && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 16, background: C.surface, border: `1px solid ${C.gold}55` }}>
            <input
              autoFocus
              className="ht-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addHabit();
                if (e.key === "Escape") { setAdding(false); setDraft(""); }
              }}
              placeholder="Название привычки…"
              style={{ flex: 1, background: "transparent", border: "none", padding: "6px 8px", fontSize: 14, color: C.text, outline: "none" }}
            />
            <button onClick={addHabit} style={{ padding: "6px 12px", borderRadius: 10, fontSize: 14, fontWeight: 500, background: C.gold, color: "#1A1208", border: "none", cursor: "pointer" }}>
              Добавить
            </button>
            <button onClick={() => { setAdding(false); setDraft(""); }} aria-label="Отмена" style={{ padding: 6, borderRadius: 10, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 12, marginTop: 24, color: C.faint }}>
          Тапни кружок — отметить сегодня · квадратики — забэкфилить дни
        </div>
      </div>
    </div>
  );
}

function iconBtn(C, color) {
  return { display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, padding: "5px 8px", borderRadius: 8, color, background: "transparent", border: "none", cursor: "pointer" };
}
function primaryBtn(C) {
  return { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, fontWeight: 500, fontSize: 14, background: C.gold, color: "#1A1208", border: "none", cursor: "pointer" };
}
