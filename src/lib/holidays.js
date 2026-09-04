import { ADD, KEY, PARSE } from "./dates.js";

/* Anonymous Gregorian computus. Returns Easter Sunday at noon UTC. */
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31);
  const da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, da, 12));
}

/* DE is North Rhine-Westphalia, the catchment the outlet actually draws from. */
const DEFS = {
  DE: (fx, rel) => [
    [fx(1, 1), "Neujahr"], [rel(-2), "Karfreitag"], [rel(0), "Ostersonntag"], [rel(1), "Ostermontag"],
    [fx(5, 1), "Tag der Arbeit"], [rel(39), "Christi Himmelfahrt"], [rel(49), "Pfingstsonntag"],
    [rel(50), "Pfingstmontag"], [rel(60), "Fronleichnam"], [fx(10, 3), "Tag der Deutschen Einheit"],
    [fx(11, 1), "Allerheiligen"], [fx(12, 25), "1. Weihnachtstag"], [fx(12, 26), "2. Weihnachtstag"],
  ],
  BE: (fx, rel) => [
    [fx(1, 1), "Nieuwjaar"], [rel(0), "Pasen"], [rel(1), "Paasmaandag"], [fx(5, 1), "Dag van de Arbeid"],
    [rel(39), "O.H. Hemelvaart"], [rel(49), "Pinksteren"], [rel(50), "Pinkstermaandag"],
    [fx(7, 21), "Nationale feestdag"], [fx(8, 15), "O.L.V. Hemelvaart"], [fx(11, 1), "Allerheiligen"],
    [fx(11, 11), "Wapenstilstand"], [fx(12, 25), "Kerstmis"],
  ],
  NL: (fx, rel) => [
    [fx(1, 1), "Nieuwjaarsdag"], [rel(-2), "Goede Vrijdag"], [rel(0), "Eerste Paasdag"], [rel(1), "Tweede Paasdag"],
    [fx(4, 27), "Koningsdag"], [rel(39), "Hemelvaartsdag"], [rel(49), "Eerste Pinksterdag"],
    [rel(50), "Tweede Pinksterdag"], [fx(12, 25), "Eerste Kerstdag"], [fx(12, 26), "Tweede Kerstdag"],
  ],
};

export const REGIONS = ["DE", "BE", "NL"];

function holidayMap(y) {
  const E = easter(y);
  const rel = (n) => KEY(ADD(E, n));
  const fx = (mo, da) => KEY(new Date(Date.UTC(y, mo - 1, da, 12)));
  const out = {};
  for (const region of REGIONS) {
    const map = {};
    /* push instead of assign: two holidays can land on the same date and one
       must not silently swallow the other. */
    for (const [key, name] of DEFS[region](fx, rel)) (map[key] ||= []).push(name);
    out[region] = map;
  }
  return out;
}

const CACHE = new Map();

/** Accepts a Date or a "YYYY-MM-DD" key. Returns [{region, name}] — [] if the date is invalid. */
export function holidays(date) {
  const d = typeof date === "string" ? PARSE(date) : date;
  if (!d || Number.isNaN(d.getTime())) return [];
  const y = d.getUTCFullYear();
  if (!CACHE.has(y)) CACHE.set(y, holidayMap(y));
  const m = CACHE.get(y);
  const k = KEY(d);
  return REGIONS.flatMap((region) => (m[region][k] || []).map((name) => ({ region, name })));
}
