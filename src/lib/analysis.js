import { ADD, dow, human, isDateKey, lastYear, PARSE } from "./dates.js";
import { holidays } from "./holidays.js";
import { f0, f1, money, signed } from "./format.js";
import { isNoisy, kpi, num, pctChange, ppDiff } from "./kpi.js";

/** Everything the screen and the report both need, derived once. */
export function analyse({ date, basis, today, ly }) {
  const valid = isDateKey(date);
  const d = PARSE(valid ? date : "1970-01-01");
  const lyRef = lastYear(d, basis);
  const lySame = lastYear(d, "date");

  const T = kpi(today);
  const L = kpi(ly);
  const target = num(today.target);
  const dSales = pctChange(T.sales, L.sales);

  return {
    valid,
    d,
    lyRef,
    lySame,
    /* Only a date-to-date comparison can land on the wrong weekday; the
       -364 day basis is weekday-aligned by construction. */
    mismatch: basis === "date" && lySame.getUTCDay() !== d.getUTCDay(),
    weekdayShift: lySame.getUTCDay() !== d.getUTCDay(),
    hToday: valid ? holidays(d) : [],
    hLy: valid ? holidays(lyRef) : [],
    hAround: valid
      ? [-1, 1].map((off) => ({ off, hs: holidays(ADD(d, off)) })).filter((x) => x.hs.length)
      : [],
    T,
    L,
    target,
    dSales,
    toTarget: pctChange(T.sales, target),
    dTraffic: pctChange(T.traffic, L.traffic),
    dConv: ppDiff(T.conv, L.conv),
    dAtv: pctChange(T.atv, L.atv),
    dAur: pctChange(T.aur, L.aur),
    dUpt: pctChange(T.upt, L.upt),
    noisy: isNoisy(dSales, T.tx),
  };
}

const list = (hs) => hs.map((x) => `${x.region}: ${x.name}`).join(" · ");
const w = (x) =>
  `${x.desc || "—"}, max ${x.tmax === "" || x.tmax === null ? "—" : x.tmax}°C, precipitation ${
    x.rain === "" || x.rain === null ? "—" : x.rain
  } mm`;

/** The plain-text brief the model reports on. Facts only, no instructions. */
export function buildFacts(a, { basis, wToday, wLy, chips, notes }) {
  const { d, lyRef, lySame, T, L, target } = a;
  return `
DATE: ${human(d)} (${dow(d)})
COMPARED WITH: ${human(lyRef)} (${dow(lyRef)}) — basis: ${
    basis === "weekday" ? "same weekday last year (-364 days)" : "same calendar date"
  }
CALENDAR WARNING: ${
    a.mismatch
      ? `the same calendar date last year (${human(lySame)}) fell on a ${dow(
          lySame
        )}, not a ${dow(d)}. Date-to-date comparison distorts the gap.`
      : basis === "weekday" && a.weekdayShift
      ? `weekday-aligned comparison, so the compared day is ${human(lySame)} shifted to the nearest ${dow(d)}. Clean on weekday, one day off on the calendar.`
      : "same date and same weekday, clean comparison."
  }
HOLIDAYS TODAY: ${a.hToday.length ? list(a.hToday) : "none in NL / DE (NRW) / BE"}
HOLIDAYS ON THE COMPARED DAY: ${a.hLy.length ? list(a.hLy) : "none"}
HOLIDAYS NEXT TO TODAY: ${
    a.hAround.length
      ? a.hAround
          .map((x) => `${x.off > 0 ? "tomorrow" : "yesterday"} ${list(x.hs)}`)
          .join(" | ")
      : "none"
  }

TODAY — net sales ${money(T.sales)}${
    target !== null ? ` | target ${money(target)} (${signed(a.toTarget)}%)` : ""
  } | traffic ${f0(T.traffic)} | transactions ${f0(T.tx)} | conversion ${f1(T.conv)}% | ATV ${money(
    T.atv
  )} | AUR ${money(T.aur)} | UPT ${f1(T.upt)} | units ${f0(T.units)}
LAST YEAR — net sales ${money(L.sales)} | traffic ${f0(L.traffic)} | transactions ${f0(
    L.tx
  )} | conversion ${f1(L.conv)}% | ATV ${money(L.atv)} | AUR ${money(L.aur)} | UPT ${f1(
    L.upt
  )} | units ${f0(L.units)}
NET SALES vs LY: ${signed(a.dSales)}%
TRAFFIC vs LY: ${signed(a.dTraffic)}% | CONVERSION vs LY: ${signed(
    a.dConv
  )} percentage points | ATV vs LY: ${signed(a.dAtv)}% | AUR vs LY: ${signed(
    a.dAur
  )}% | UPT vs LY: ${signed(a.dUpt)}%
WEATHER TODAY: ${w(wToday)}
WEATHER ON THE COMPARED DAY: ${w(wLy)}
STORE CONTEXT: ${chips.length ? chips.join("; ") : "nothing flagged"}
NOTES: ${(notes || "none").slice(0, 4000)}
RELIABILITY: ${
    a.noisy
      ? "low transaction count — a single-digit gap may be noise, not a trend"
      : "enough volume to read the variance"
  }`.trim();
}
