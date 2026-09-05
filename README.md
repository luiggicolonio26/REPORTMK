# End-of-day report · Designer Outlet Roermond

Daily trading report for the store: today's figures against last year, holidays
and weather on both days, and a written report generated from the numbers.

Originally a single Claude artifact; this is the same tool as a normal website,
so it opens on any computer with nothing but the URL.

## What changed from the artifact

The artifact relied on two things that only exist inside Claude:

| Artifact | Here |
|---|---|
| `window.storage` | `localStorage`, or a shared KV store when one is configured |
| `fetch("https://api.anthropic.com/…")` straight from the browser | `/api/report` and `/api/weather-search`, with the key held server-side |

Everything else — the KPI maths, the NL/DE/BE holiday calendar, the weather
lookup, the report prompt — is the same, with the bugs listed at the bottom
fixed.

## Deploying

1. Import this repository at [vercel.com/new](https://vercel.com/new). The Vite
   preset is detected automatically; the `api/` folder becomes serverless
   functions.
2. **Settings → Environment Variables**, then redeploy.

   The report needs a model provider — set **exactly one** of these keys:

   | Provider | Cost | Sign-up | Notes |
   |---|---|---|---|
   | `GROQ_API_KEY` | free | email or Google/GitHub, no card, no phone | Open-weight models. ~1,000 reports a day. |
   | `MISTRAL_API_KEY` | free | needs phone verification | Best privacy posture of the free tiers. |
   | `ANTHROPIC_API_KEY` | ~$0.04 a report | card required | Sharpest reports, and the only one that can look up past weather by web search. |

   Set `LLM_PROVIDER` (`groq` / `mistral` / `anthropic`) only if more than one
   key is present — otherwise the app refuses to guess.

   Leave `LLM_MODEL` unset and the app asks the provider which models the
   account can use and picks the best one. Groq and Mistral retire model IDs
   every few months, so a pinned name eventually 404s; set `LLM_MODEL` only to
   force a specific model.

   Switching provider is these two variables and a redeploy. No code changes.

   Also worth setting:

   | Variable | Required | What it does |
   |---|---|---|
   | `APP_PASSWORD` | recommended | Anyone with the URL can otherwise use your API allowance. Set it and the site asks for the key once per browser. |
   | `KV_REST_API_URL` + `KV_REST_API_TOKEN` | optional | Shared history across computers. |

### Shared history (optional)

Without a KV store the app still works, but each computer keeps its own
history — the day you save at the store is not the day you see at home.

To share it: **Storage → Create Database → Upstash for Redis** in the Vercel
project. The integration sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`;
redeploy and the badge under the title changes from "history in this browser
only" to "shared history".

## Running locally

```bash
npm install
npm run dev      # front end only — /api needs the Vercel CLI
npm test         # unit tests for the dates, holidays, KPIs and the importer
```

For the API routes too: `npm i -g vercel && vercel dev`, with the variables
above in a local `.env` (see `.env.example`).

## How it is put together

```
src/lib/dates.js       day keys, weekday handling, the -364 day comparison
src/lib/holidays.js    NL / DE (NRW) / BE public holidays, Easter included
src/lib/kpi.js         conversion, ATV, AUR, UPT and the variances
src/lib/season.js      where the day sits in the outerwear selling year
src/lib/mix.js         best sellers and the customer nationality split
src/lib/weather.js     open-meteo, archive and forecast endpoints
src/lib/analysis.js    everything the screen and the report both need
src/lib/store.js       localStorage, or the shared store when configured
api/_lib/provider.js   Groq / Mistral / Anthropic behind one interface
api/report.js          the report, streamed so a slow day cannot time out
api/weather-search.js  fallback lookup, where the provider can search the web
api/history.js         shared history, backed by Redis over HTTP
```

## Bugs found in the original and fixed

1. **The app crashed if you cleared the date field.** The empty string became an
   invalid `Date`, and the holiday lookup then called `toISOString()` on it and
   threw a `RangeError` — a blank screen with no way back.
2. **The date could be wrong by a day.** `new Date().toISOString()` reports the
   UTC day, so between midnight and 02:00 Dutch time the app opened on
   yesterday's date.
3. **A day with no transactions showed no conversion.** `traffic && tx ? … :
   null` treats a genuine `0` as missing, so 0 transactions on 300 visitors read
   as "—" rather than 0%. The same held for ATV, AUR and UPT.
4. **Last year's figures stuck to the wrong day.** Changing the date left the
   previous day's comparison on screen when nothing was stored for the new one.
5. **Today's figures were never reloaded.** Saved days could be written but not
   read back, so re-opening a day showed an empty form — and saving it again
   overwrote the record with blanks.
6. **The weekday warning fired on the wrong basis.** It appeared even when the
   weekday-aligned comparison was selected, which is weekday-clean by
   construction.
7. **Weather gaps between the two endpoints.** The archive lags about five days,
   so a date 6-8 days back could fall between the archive and the forecast and
   return nothing. Both endpoints are now tried.
8. **Two holidays on one date silently overwrote each other**, because the
   holiday map was an object literal with computed keys.
9. **`2025-02-30` was accepted as a date** — JavaScript rolls it over to 2 March
   rather than rejecting it.
10. **Import destroyed saved days.** A bulk import replaced each day wholesale,
    dropping the weather, notes and report already stored against it. It now
    merges. It also silently accepted `4.820,50` as `4.82`; European and
    English number formats are both parsed now.
11. **The report could time out and return nothing.** It is streamed now, and
    arrives as it is written.
12. **Copy failed silently** when the clipboard was blocked.
13. **No error ever reached the user** — every failure path caught and discarded
    the reason. Errors now say what went wrong.

## Weather on providers without web search

Weather comes from open-meteo, which covers 1940 to sixteen days ahead and
needs no key. The web-search fallback only exists for days it has no record of,
and only Anthropic can run it — on Groq or Mistral the app says so and you type
the weather in. In practice this almost never comes up.

## Note on the prompt

The report is generated from a facts brief the app builds. The store notes go
into it as data, and the system prompt states they are data — a note typed into
the box cannot re-instruct the model.

The report is prose, not a bulleted summary: how the day went, what the drivers
attribute the result to, and — where they were recorded — what sold and who
bought it, read against the season.

Which KPIs beat last year is decided in `analyse()`, not by the model, and the
prompt may only credit the team on that list. A report that congratulates the
team on a metric that actually fell is worse than one that says nothing. Asking a model *why* a day went badly is the exact
pressure that produces invented causes, so the prompt says outright that "the
figures do not explain this, and here is what to check" is the correct answer
whenever the data does not carry one.
