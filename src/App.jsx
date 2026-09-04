import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KEY, dow, human, isDateKey, todayKey } from "./lib/dates.js";
import { analyse, buildFacts } from "./lib/analysis.js";
import { f0, f1, money } from "./lib/format.js";
import { fetchWeather } from "./lib/weather.js";
import { parseHistory } from "./lib/importer.js";
import { initStore, loadDay, saveDay, saveMany, storageMode } from "./lib/store.js";
import { ApiError, getAppKey, setAppKey, streamReport, weatherBySearch } from "./lib/api.js";

const CHIPS = [
  "Promotion running", "Size breaks", "NRW school holidays", "Event at the outlet",
  "Short staffed", "New delivery on the floor", "Works / access closed", "Window changed",
];

const EMPTY_TODAY = { sales: "", target: "", traffic: "", transactions: "", units: "" };
const EMPTY_LY = { sales: "", traffic: "", transactions: "", units: "" };
const EMPTY_W = { desc: "", tmax: "", rain: "" };

const str = (v) => (v === null || v === undefined ? "" : String(v));

/* Defined outside the component: inside, React would remount every input on
   each keystroke and the field would lose focus. */
const Num = ({ id, label, value, onChange, ph }) => (
  <div>
    <label className="lbl" htmlFor={id}>{label}</label>
    <input id={id} type="number" inputMode="decimal" value={value} placeholder={ph}
           onChange={(e) => onChange(e.target.value)} />
  </div>
);

const Text = ({ id, label, value, onChange, ph }) => (
  <div>
    <label className="lbl" htmlFor={id}>{label}</label>
    <input id={id} value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} />
  </div>
);

function AccessGate({ onUnlock }) {
  const [value, setValue] = useState("");
  return (
    <div className="rd">
      <div className="card gate">
        <h2>Access key</h2>
        <p className="note" style={{ marginTop: 0 }}>
          This deployment is protected. Enter the key set on the server to use it.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); onUnlock(value.trim()); }}>
          <input type="password" value={value} autoFocus placeholder="Access key"
                 onChange={(e) => setValue(e.target.value)} />
          <div style={{ marginTop: 12 }}>
            <button className="btn" type="submit" disabled={!value.trim()}>Open</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("local");

  const [date, setDate] = useState(todayKey());
  const [basis, setBasis] = useState("weekday");
  const [today, setToday] = useState(EMPTY_TODAY);
  const [ly, setLy] = useState(EMPTY_LY);
  const [wToday, setWToday] = useState(EMPTY_W);
  const [wLy, setWLy] = useState(EMPTY_W);
  const [chips, setChips] = useState([]);
  const [notes, setNotes] = useState("");
  const [report, setReport] = useState("");

  const [busy, setBusy] = useState(false);
  const [loadingW, setLoadingW] = useState(null);
  const [msg, setMsg] = useState(null); // { text, err }
  const [imp, setImp] = useState("");
  const [copied, setCopied] = useState(false);

  const abort = useRef(null);
  const say = useCallback((text, err = false) => setMsg(text ? { text, err } : null), []);

  const a = useMemo(() => analyse({ date, basis, today, ly }), [date, basis, today, ly]);
  const lyKey = a.valid ? KEY(a.lyRef) : null;

  /* ---- storage: is a shared history configured, or are we browser-local? ---- */
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const m = await initStore();
        if (!stop) setMode(m);
      } catch (e) {
        if (!stop && e instanceof ApiError && e.status === 401) {
          setLocked(true);
          return;
        }
      }
      if (!stop) setReady(true);
    })();
    return () => { stop = true; };
  }, []);

  /* ---- the selected day: load whatever was saved for it, otherwise blank ---- */
  useEffect(() => {
    if (!ready || !isDateKey(date)) return;
    let stop = false;
    (async () => {
      const v = await loadDay(date);
      if (stop) return;
      setToday(v ? {
        sales: str(v.sales), target: str(v.target), traffic: str(v.traffic),
        transactions: str(v.transactions), units: str(v.units),
      } : EMPTY_TODAY);
      setWToday(v?.weather ? { desc: str(v.weather.desc), tmax: str(v.weather.tmax), rain: str(v.weather.rain) } : EMPTY_W);
      setChips(Array.isArray(v?.chips) ? v.chips : []);
      setNotes(str(v?.notes));
      setReport(str(v?.report));
    })();
    return () => { stop = true; };
  }, [ready, date]);

  /* ---- the comparison day ---- */
  useEffect(() => {
    if (!ready || !lyKey) return;
    let stop = false;
    (async () => {
      const v = await loadDay(lyKey);
      if (stop) return;
      setLy(v ? {
        sales: str(v.sales), traffic: str(v.traffic),
        transactions: str(v.transactions), units: str(v.units),
      } : EMPTY_LY);
      setWLy(v?.weather ? { desc: str(v.weather.desc), tmax: str(v.weather.tmax), rain: str(v.weather.rain) } : EMPTY_W);
      if (v) say("Last year loaded from your history.");
    })();
    return () => { stop = true; };
  }, [ready, lyKey, say]);

  useEffect(() => () => abort.current?.abort(), []);

  const unlock = async (key) => {
    setAppKey(key);
    try {
      const m = await initStore();
      setMode(m);
      setLocked(false);
      setReady(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAppKey("");
        say("That key was not accepted.", true);
      }
    }
  };

  const loadWeather = async (which) => {
    const day = which === "today" ? date : lyKey;
    if (!day) return;
    const set = which === "today" ? setWToday : setWLy;
    setLoadingW(which);
    say(`Looking up the weather for ${human(new Date(`${day}T12:00:00Z`))}…`);
    try {
      const w = await fetchWeather(day);
      set({ desc: w.desc, tmax: str(w.tmax), rain: str(w.rain) });
      say(`Weather loaded for ${day}.`);
    } catch {
      try {
        const w = await weatherBySearch(day);
        set({ desc: str(w.desc), tmax: str(w.tmax), rain: str(w.rain) });
        say(`Weather found by web search for ${day}. Worth a quick check.`);
      } catch (e) {
        say(`No weather found for ${day} (${e.message}). Type it in.`, true);
      }
    } finally {
      setLoadingW(null);
    }
  };

  const save = async () => {
    if (!isDateKey(date)) return say("Pick a valid date first.", true);
    try {
      const { where } = await saveDay(date, { ...today, weather: wToday, chips, notes, report });
      say(where === "cloud"
        ? "Day saved to the shared history. It comes back as next year's comparison."
        : "Day saved in this browser. It comes back as next year's comparison here.");
    } catch (e) {
      say(`The day could not be saved: ${e.message}`, true);
    }
  };

  const importHistory = async () => {
    const { days, skipped } = parseHistory(imp);
    if (!days.length) {
      return say(`Nothing imported. ${skipped[0]?.reason ?? "Check the format: date;sales;traffic;transactions;units"}.`, true);
    }
    try {
      const saved = await saveMany(days);
      setImp("");
      const tail = skipped.length ? ` ${skipped.length} line${skipped.length > 1 ? "s" : ""} skipped (line ${skipped.map((s) => s.line).join(", ")}).` : "";
      say(`${saved} day${saved === 1 ? "" : "s"} imported.${tail}`);
      if (lyKey && days.some((d) => d.date === lyKey)) {
        const v = await loadDay(lyKey);
        if (v) setLy({ sales: str(v.sales), traffic: str(v.traffic), transactions: str(v.transactions), units: str(v.units) });
      }
    } catch (e) {
      say(`Import failed: ${e.message}`, true);
    }
  };

  const generate = async () => {
    if (!a.valid) return say("Pick a valid date first.", true);
    setBusy(true);
    setReport("");
    say("Writing the report…");
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const facts = buildFacts(a, { basis, wToday, wLy, chips, notes });
      const out = await streamReport(facts, setReport, abort.current.signal);
      setReport(out);
      say(out ? "Report written. Save the day to keep it." : "The model returned nothing. Try again.", !out);
    } catch (e) {
      if (e.name !== "AbortError") say(`The report could not be generated: ${e.message}`, true);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      say("Copying is blocked in this browser — select the text and copy it by hand.", true);
    }
  };

  if (locked) return <AccessGate onUnlock={unlock} />;

  const { T, L, dSales, toTarget } = a;

  return (
    <div className="rd">
      <h1>End-of-day report</h1>
      <p className="sub">
        Roermond · check the day against last year before you write anything
        <span className="mode" style={{ marginLeft: 8 }}>
          {mode === "cloud" ? "shared history" : "history in this browser only"}
        </span>
      </p>

      <div className="grid">
        <div>
          <div className="card">
            <div className="row2">
              <div>
                <label className="lbl" htmlFor="date">Date</label>
                <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="lbl" htmlFor="basis">Compare against</label>
                <select id="basis" value={basis} onChange={(e) => setBasis(e.target.value)}>
                  <option value="weekday">Same weekday last year</option>
                  <option value="date">Same calendar date</option>
                </select>
              </div>
            </div>

            {!a.valid ? (
              <div className="flag bad">Pick a date to start. Nothing can be compared without one.</div>
            ) : (
              <>
                <div className="note">
                  Today is a {dow(a.d)}. You are comparing with {human(a.lyRef)}, a {dow(a.lyRef)}.
                </div>
                {a.mismatch && (
                  <div className="flag">
                    {human(a.lySame)} fell on a <b>{dow(a.lySame)}</b>, not a {dow(a.d)}. Comparing date to date
                    overstates or hides the gap: a {dow(a.lySame)} and a {dow(a.d)} do not trade the same.
                  </div>
                )}
                {(a.hToday.length > 0 || a.hLy.length > 0 || a.hAround.length > 0) && (
                  <div style={{ marginTop: 12 }}>
                    {a.hToday.map((h) => <span key={`t${h.region}${h.name}`} className="tag">Today · {h.region} {h.name}</span>)}
                    {a.hLy.map((h) => <span key={`l${h.region}${h.name}`} className="tag">Compared day · {h.region} {h.name}</span>)}
                    {a.hAround.map((x) => x.hs.map((h) => (
                      <span key={`${x.off}${h.region}${h.name}`} className="tag">
                        {x.off > 0 ? "Tomorrow" : "Yesterday"} · {h.region} {h.name}
                      </span>
                    )))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card">
            <h2>Today</h2>
            <div className="row">
              <Num id="t-sales" label="Net sales €" value={today.sales} ph="0" onChange={(v) => setToday({ ...today, sales: v })} />
              <Num id="t-traffic" label="Traffic" value={today.traffic} ph="0" onChange={(v) => setToday({ ...today, traffic: v })} />
              <Num id="t-tx" label="Transactions" value={today.transactions} ph="0" onChange={(v) => setToday({ ...today, transactions: v })} />
            </div>
            <div className="row2">
              <Num id="t-units" label="Units" value={today.units} ph="0" onChange={(v) => setToday({ ...today, units: v })} />
              <Num id="t-target" label="Target € (optional)" value={today.target} ph="0" onChange={(v) => setToday({ ...today, target: v })} />
            </div>
            <div className="row">
              <Text id="t-wdesc" label="Weather" value={wToday.desc} ph="rain, clear…" onChange={(v) => setWToday({ ...wToday, desc: v })} />
              <Num id="t-wmax" label="Max °C" value={wToday.tmax} ph="" onChange={(v) => setWToday({ ...wToday, tmax: v })} />
              <Num id="t-wrain" label="Rain mm" value={wToday.rain} ph="" onChange={(v) => setWToday({ ...wToday, rain: v })} />
            </div>
            <button className="btn ghost" onClick={() => loadWeather("today")} disabled={!a.valid || loadingW !== null}>
              {loadingW === "today" ? "Looking up…" : "Look up today's weather"}
            </button>
          </div>

          <div className="card">
            <h2>{a.valid ? human(a.lyRef) : "Last year"} · last year</h2>
            <div className="row2">
              <Num id="l-sales" label="Net sales €" value={ly.sales} ph="0" onChange={(v) => setLy({ ...ly, sales: v })} />
              <Num id="l-traffic" label="Traffic" value={ly.traffic} ph="0" onChange={(v) => setLy({ ...ly, traffic: v })} />
            </div>
            <div className="row2">
              <Num id="l-tx" label="Transactions" value={ly.transactions} ph="0" onChange={(v) => setLy({ ...ly, transactions: v })} />
              <Num id="l-units" label="Units" value={ly.units} ph="0" onChange={(v) => setLy({ ...ly, units: v })} />
            </div>
            <div className="row">
              <Text id="l-wdesc" label="Weather" value={wLy.desc} ph="rain, clear…" onChange={(v) => setWLy({ ...wLy, desc: v })} />
              <Num id="l-wmax" label="Max °C" value={wLy.tmax} ph="" onChange={(v) => setWLy({ ...wLy, tmax: v })} />
              <Num id="l-wrain" label="Rain mm" value={wLy.rain} ph="" onChange={(v) => setWLy({ ...wLy, rain: v })} />
            </div>
            <button className="btn ghost" onClick={() => loadWeather("ly")} disabled={!a.valid || loadingW !== null}>
              {loadingW === "ly" ? "Looking up…" : "Look up that day's weather"}
            </button>
          </div>

          <div className="card">
            <h2>What happened on the floor</h2>
            <div style={{ marginBottom: 10 }}>
              {CHIPS.map((c) => (
                <button key={c} className="chip" type="button" data-on={chips.includes(c) ? "1" : "0"}
                        aria-pressed={chips.includes(c)}
                        onClick={() => setChips(chips.includes(c) ? chips.filter((x) => x !== c) : [...chips, c])}>
                  {c}
                </button>
              ))}
            </div>
            <label className="lbl" htmlFor="notes">Notes</label>
            <textarea id="notes" rows={3} value={notes} maxLength={4000}
                      placeholder="What the numbers don't say: what sold, what was missing, anything that went wrong."
                      onChange={(e) => setNotes(e.target.value)} />
            <p className="note">
              Without this the report can only blame the weather. Thirty seconds here is worth more than all the KPIs.
            </p>
          </div>

          <div className="card">
            <h2>Load last year in one go</h2>
            <label className="lbl" htmlFor="imp">Paste days</label>
            <textarea id="imp" rows={4} value={imp}
                      placeholder={"2025-09-05;4820;310;41;68\n2025-09-06;7130;465;62;104"}
                      onChange={(e) => setImp(e.target.value)} />
            <p className="note">
              One line per day: date (YYYY-MM-DD), net sales, traffic, transactions, units. Semicolon, comma or tab, so you
              can paste columns straight out of Excel.
            </p>
            <button className="btn ghost" onClick={importHistory} disabled={!imp.trim()}>Import days</button>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="hero">
              <div className={"big " + (dSales === null ? "" : dSales >= 0 ? "up" : "down")}>
                {dSales === null ? "—" : (dSales >= 0 ? "+" : "") + dSales.toFixed(1) + "%"}
              </div>
              <div className="note" style={{ marginTop: 4 }}>
                net sales vs {dow(a.lyRef)} {human(a.lyRef)}
                {toTarget !== null && ` · ${toTarget >= 0 ? "+" : ""}${toTarget.toFixed(1)}% against target`}
              </div>
            </div>
            {a.noisy && (
              <div className="flag">
                At this transaction count a single-digit gap is noise. Don't turn it into a trend.
              </div>
            )}
            <div className="kpis">
              <div><span>Conversion</span>{f1(T.conv)}% <small>· LY {f1(L.conv)}%</small></div>
              <div><span>ATV</span>{money(T.atv)} <small>· LY {money(L.atv)}</small></div>
              <div><span>AUR</span>{money(T.aur)} <small>· LY {money(L.aur)}</small></div>
              <div><span>UPT</span>{f1(T.upt)} <small>· LY {f1(L.upt)}</small></div>
              <div><span>Traffic</span>{f0(T.traffic)} <small>· LY {f0(L.traffic)}</small></div>
              <div><span>Units</span>{f0(T.units)} <small>· LY {f0(L.units)}</small></div>
            </div>
            <div className="bar" style={{ marginTop: 16 }}>
              <button className="btn" onClick={generate} disabled={busy || T.sales === null || !a.valid}>
                {busy ? "Writing…" : "Write the report"}
              </button>
              <button className="btn ghost" onClick={save} disabled={!a.valid}>Save the day</button>
              {report && (
                <button className="btn ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
              )}
            </div>
            {msg && <div className={"msg" + (msg.err ? " err" : "")}>{msg.text}</div>}
          </div>

          <div className="card">
            <h2>Report</h2>
            {report ? (
              <div className="out">{report}</div>
            ) : (
              <p className="empty">
                Enter today's figures and last year's, flag what happened on the floor, then write the report. Every day you
                save stays in your history and comes back next year as the comparison.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
