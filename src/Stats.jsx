import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";

const C = {
  surface: "#1C1C24", surface2: "#23232E", line: "#2E2E3A",
  text: "#EDEDF2", muted: "#8C8C9C", faint: "#3A3A48", gold: "#F5B544", goldHot: "#FFCB5C",
};
const GOLD_RGB = "245,181,68";

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = (d) => { const x = new Date(d); x.setHours(0,0,0,0); const w = (x.getDay() + 6) % 7; return addDays(x, -w); };
const rangeDays = (n) => [...Array(n)].map((_, i) => addDays(new Date(), -(n - 1 - i)));
const PERIODS = [{ n: 7, label: "7 дней" }, { n: 30, label: "30 дней" }, { n: 90, label: "90 дней" }];
const NONE = "__none__";

export default function Stats({ habits, done, groups }) {
  const [period, setPeriod] = useState(30);
  const hasUngrouped = habits.some((h) => !h.group_id);
  const [active, setActive] = useState(() => new Set([...groups.map((g) => g.id), NONE]));
  const [expanded, setExpanded] = useState(() => new Set());

  const days = useMemo(() => rangeDays(period), [period]);
  const today = ymd(new Date());
  const isDone = (hid, ds) => done.has(`${hid}|${ds}`);
  const isWeekly = (h) => (h.target_per_week ?? 7) < 7;
  const countInWeekOf = (hid, anyDate) => {
    const m = monday(anyDate);
    let c = 0;
    for (let i = 0; i < 7; i++) if (isDone(hid, ymd(addDays(m, i)))) c++;
    return c;
  };
  const adherence = (h) => {
    const dc = days.filter((d) => isDone(h.id, ymd(d))).length;
    const expected = isWeekly(h) ? h.target_per_week * (period / 7) : period;
    return expected ? Math.min(100, Math.round((dc / expected) * 100)) : 0;
  };

  const keyOf = (h) => h.group_id || NONE;
  const activeHabits = habits.filter((h) => active.has(keyOf(h)));

  const toggleActive = (k) => setActive((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleExp = (k) => setExpanded((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // верхний график — по активным привычкам (как в v3: недельная закрыта = вся неделя)
  const daily = days.map((d) => {
    const ds = ymd(d);
    const hit = activeHabits.filter((h) => isWeekly(h) ? countInWeekOf(h.id, d) >= h.target_per_week : isDone(h.id, ds)).length;
    return { date: `${d.getDate()}.${d.getMonth() + 1}`, pct: activeHabits.length ? Math.round((hit / activeHabits.length) * 100) : 0 };
  });
  const avg = activeHabits.length ? Math.round(activeHabits.reduce((s, h) => s + adherence(h), 0) / activeHabits.length) : 0;

  // блоки: группы по порядку + «Без группы»
  const blocks = [
    ...groups.map((g) => ({ key: g.id, name: g.name, items: habits.filter((h) => h.group_id === g.id) })),
    ...(hasUngrouped ? [{ key: NONE, name: "Без группы", items: habits.filter((h) => !h.group_id) }] : []),
  ];

  const filterChips = [
    ...groups.map((g) => ({ key: g.id, name: g.name })),
    ...(hasUngrouped ? [{ key: NONE, name: "Без группы" }] : []),
  ];

  if (habits.length === 0)
    return <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Добавь привычки — здесь появится статистика.</div>;

  return (
    <div>
      {/* период */}
      <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: C.surface, marginBottom: 14 }}>
        {PERIODS.map((p) => (
          <button key={p.n} onClick={() => setPeriod(p.n)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer", background: period === p.n ? C.surface2 : "transparent", color: period === p.n ? C.text : C.muted }}>{p.label}</button>
        ))}
      </div>

      {/* фильтр по группам */}
      {filterChips.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {filterChips.map((c) => {
            const on = active.has(c.key);
            return <button key={c.key} onClick={() => toggleActive(c.key)} style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: `1px solid ${on ? C.gold : C.line}`, background: on ? C.gold + "22" : "transparent", color: on ? C.goldHot : C.muted }}>{c.name}</button>;
          })}
        </div>
      )}

      {activeHabits.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "30px 0" }}>Включи хотя бы одну группу выше.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: C.gold, fontVariantNumeric: "tabular-nums" }}>{avg}%</span>
            <span style={{ fontSize: 14, color: C.muted }}>средн. за {period} дн.</span>
          </div>

          {/* дневная динамика */}
          <div style={card()}>
            <div style={cardTitle()}>Дневная динамика</div>
            <ResponsiveContainer width="100%" height={170}>
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

          {/* хитмап по группам */}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {blocks.filter((b) => active.has(b.key)).map((b) => {
              const isExp = expanded.has(b.key);
              const groupAvg = b.items.length ? Math.round(b.items.reduce((s, h) => s + adherence(h), 0) / b.items.length) : 0;
              const aggValue = (d) => {
                if (!b.items.length) return 0;
                const hit = b.items.filter((h) => isDone(h.id, ymd(d))).length;
                return hit / b.items.length;
              };
              return (
                <div key={b.key} style={card()}>
                  <button onClick={() => toggleExp(b.key)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: 10 }}>
                    {isExp ? <ChevronDown size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
                    <span style={{ fontWeight: 600, fontSize: 14, color: C.text, flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
                    <span style={{ fontSize: 12, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{groupAvg}% · {b.items.length}</span>
                  </button>

                  <HeatGrid days={days} period={period} today={today} valueFor={aggValue} />

                  {isExp && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                      {b.items.length === 0 && <div style={{ fontSize: 13, color: C.faint }}>пусто</div>}
                      {b.items.map((h) => (
                        <div key={h.id}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "75%" }}>{h.name}{isWeekly(h) ? ` · ${h.target_per_week}×` : ""}</span>
                            <span style={{ fontSize: 12, color: C.gold, fontVariantNumeric: "tabular-nums" }}>{adherence(h)}%</span>
                          </div>
                          <HeatGrid days={days} period={period} today={today} valueFor={(d) => (isDone(h.id, ymd(d)) ? 1 : 0)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function HeatGrid({ days, period, today, valueFor }) {
  const inRange = useMemo(() => new Set(days.map((d) => ymd(d))), [days]);
  if (period === 7) {
    return (
      <div style={{ display: "flex", gap: 4 }}>
        {days.map((d) => <Cell key={ymd(d)} v={valueFor(d)} w={16} h={22} isT={ymd(d) === today} label={`${d.getDate()}.${d.getMonth() + 1}`} />)}
      </div>
    );
  }
  const start = monday(days[0]);
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const weeks = [];
  let cur = start;
  while (cur <= end) { const col = []; for (let r = 0; r < 7; r++) col.push(addDays(cur, r)); weeks.push(col); cur = addDays(cur, 7); }
  return (
    <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
      {weeks.map((col, ci) => (
        <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {col.map((d) => {
            const key = ymd(d);
            if (!inRange.has(key)) return <div key={key} style={{ width: 12, height: 12, flexShrink: 0 }} />;
            return <Cell key={key} v={valueFor(d)} w={12} h={12} isT={key === today} label={`${d.getDate()}.${d.getMonth() + 1}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

function Cell({ v, w, h, isT, label }) {
  const bg = v > 0 ? `rgba(${GOLD_RGB},${(0.3 + 0.7 * Math.min(1, v)).toFixed(2)})` : C.surface2;
  return <div title={label} style={{ width: w, height: h, borderRadius: 4, boxSizing: "border-box", flexShrink: 0, background: bg, border: isT ? `1.5px solid ${v > 0 ? C.goldHot : C.muted}` : `1px solid ${C.line}` }} />;
}

function card() { return { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14 }; }
function cardTitle() { return { fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 10 }; }
function tooltip() { return { background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, color: C.text, fontSize: 12 }; }
