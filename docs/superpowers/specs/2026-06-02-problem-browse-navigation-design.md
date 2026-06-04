# Problem Browse Navigation — Design Spec

**Date:** 2026-06-02  
**Status:** Approved (user requirements)  
**Goal:** Let users explore any seeded problem via `/browse`, `/next`, and inline buttons, with the same digest + rich Telegram flow as `/today`, without changing curriculum `current_day`.

---

## Behavior

| Action | Effect |
|--------|--------|
| `/today` | Problem for `subscribers.current_day` (curriculum). Sets `browse_day` to that day for prev/next chain. |
| `/next` | Next problem in catalog (by `day_number`). Updates `browse_day`. Same digest + keyboards as `/today`. |
| `/browse` | Inline keyboard listing catalog; tap opens problem (`pv:{slug}`). |
| Buttons on digest | ◀ Prev (`bp`), Next ▶ (`bn`), Browse (`bb`), Today (`bt`) |

**`current_day` unchanged** by browse/next (daily cron + official track preserved).

## Catalog

`SELECT day_number, slug, title FROM problems ORDER BY day_number`  
Rich keyboards when `content_json` present; legacy digest otherwise.

## Data

`subscribers.browse_day INTEGER` — last browsed curriculum day for prev/next.

## Callbacks (≤64 bytes)

- `pv:{slug}` — open problem
- `bn`, `bp`, `bb`, `bt` — nav actions

## Shared delivery

`sendProblemDigest()` in `worker/src/telegram/problem-delivery.ts` used by `/today`, `/next`, `/browse`, and nav callbacks.
