import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";

const C = {
  surface: "#1C1C24", surface2: "#23232E", line: "#2E2E3A",
  text: "#EDEDF2", muted: "#8C8C9C", faint: "#3A3A48", gold: "#F5B544", goldHot: "#FFCB5C",
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = (d) => { const x = new Date(d); x.setHours(0,0,0,0); const w = (x.getDay() + 6) % 7; return addDays(x, -w); };
const rangeDays = (n) => [...Array(n)].map((_, i) => addDays(new Date(), -(n - 1 - i)));
const PERIODS = [{ n: 7, label: "7 дней" }, { n: 30, label: "30 дней" }, { n: 90, label: "90 дней" }];

export default function Stats({ habits, done }) {
  const [period, setPeriod] = useState(30);
  const [selected, setSelected] = useState(() => new Set(habits.map((h) => h.id)));
  const days = useMemo(() => rangeDays(period), [period]);
  const sel = habits.filter((h) => selected.has(h.id));

  const isDone = (hid, ds) => done.has(`${hid}|${ds}`);
  const isWeekly = (h) => (h.target_per_week ?? 7) < 7;
  const countInWeekOf = (hid, anyDate) => {
    const m = monday(anyDate);
    let c = 0;
    for (let i = 0; i < 7; i++) if (isDone(hid, ymd(addDays(m, i)))) c++;
    return c;
  };

  // adherence %: сделано / ожидалось за период (для недельных ожидается target × недель)
  const perHabit = sel.map((h) => {
    const doneCount = days.filter((d) => isDone(h.id, ymd(d))).length;
    const expected = isWeekly(h) ? h.target_per_week * (period / 7) : period;
    const pct = expected ? Math.min(100, Math.round((doneCount / expected) * 100)) : 0;
    return { name: h.name, pct };
  });

  // дневная динамика: день «закрыт» для привычки, если ежедневная сделана в этот день
  // или недельная уже добрала свою цель на той неделе
  const daily = days.map((d) => {
    const ds = ymd(d);
    const hit = sel.filter((h) =>
      isWeekly(h) ? countInWeekOf(h.id, d) >= h.target_per_week : isDone(h.id, ds)
    ).length;
    const pct = sel.length ? Math.round((hit / sel.length) * 100) : 0;
    return { date: `${d.getDate()}.${d.getMonth() + 1}`, pct };
  });

  const avg = perHabit.length ? Math.round(perHabit.reduce((s, x) => s + x.pct, 0) / perHabit.length) : 0;
  const toggleSel = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (habits.length === 0)
    return <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Добавь привычки — здесь появится статистика.</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: C.surface, marginBottom: 14 }}>
        {PERIODS.map((p) => (
          <button key={p.n} onClick={() => setPeriod(p.n)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer", background: period === p.n ? C.surface2 : "transparent", color: period === p.n ? C.text : C.muted }}>{p.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {habits.map((h) => {
          const on = selected.has(h.id);
          return <button key={h.id} onClick={() => toggleSel(h.id)} style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: `1px solid ${on ? C.gold : C.line}`, background: on ? C.gold + "22" : "transparent", color: on ? C.goldHot : C.muted }}>{h.name}{isWeekly(h) ? ` · ${h.target_per_week}×` : ""}</button>;
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button onClick={() => setSelected(new Set(habits.map((h) => h.id)))} style={linkBtn()}>Все</button>
        <button onClick={() => setSelected(new Set())} style={linkBtn()}>Никого</button>
      </div>

      {sel.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "30px 0" }}>Выбери привычки выше, чтобы увидеть графики.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: C.gold, fontVariantNumeric: "tabular-nums" }}>{avg}%</span>
            <span style={{ fontSize: 14, color: C.muted }}>средн. выполнение за {period} дн.</span>
          </div>

          <div style={card()}>
            <div style={cardTitle()}>Выполнение по привычкам</div>
            <ResponsiveContainer width="100%" height={Math.max(120, perHabit.length * 38)}>
              <BarChart data={perHabit} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={C.line} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: C.muted, fontSize: 11 }} stroke={C.line} unit="%" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: C.text, fontSize: 12 }} stroke={C.line} />
                <Tooltip cursor={{ fill: C.surface2 }} contentStyle={tooltip()} formatter={(v) => [`${v}%`, "выполнено"]} />
                <Bar dataKey="pct" fill={C.gold} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...card(), marginTop: 12 }}>
            <div style={cardTitle()}>Дневная динамика</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={daily} margin={{ left: -20, right: 8, top: 4, bottom: 4 }}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.gold} stopOpacity={0.5} /><stop offset="100%" stopColor={C.gold} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} stroke={C.line} interval="preserveStartEnd" minTickGap={24} />
                <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 11 }} stroke={C.line} unit="%" />
                <Tooltip contentStyle={tooltip()} formatter={(v) => [`${v}%`, "выполнено"]} />
                <Area type="monotone" dataKey="pct" stroke={C.goldHot} strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function card() { return { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14 }; }
function cardTitle() { return { fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 10 }; }
function tooltip() { return { background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, color: C.text, fontSize: 12 }; }
function linkBtn() { return { background: "transparent", border: "none", color: C.muted, fontSize: 12.5, cursor: "pointer", padding: 0, textDecoration: "underline" }; }
