---
title: Analytics and Realtime
description: Turn on visit analytics, read charts and logs, understand near-realtime view, exclude bots, and export CSV.
---

# Analytics and Realtime

Analytics is **optional**. Without it, short links, login, and link management still work — charts, logs, and realtime stay empty.

## Turn it on (three things)

**All three are required to display statistics**, even if short links already redirect successfully:

1. **Analytics Engine binding** named `ANALYTICS`
   - **Workers:** usually created by deploy settings (dataset default `sink`)
   - **Pages:** **Settings → Bindings → Add → Analytics Engine**
   - Variable name: `ANALYTICS`
   - Dataset: `sink` by default. If you set `NUXT_DATASET`, use the same name here

2. **Account ID** — set `NUXT_CF_ACCOUNT_ID` to the Cloudflare account that hosts this app  
   (Dashboard sidebar → account name, or the URL after you log in)

3. **API token** — set `NUXT_CF_API_TOKEN` as an encrypted secret:
   - Cloudflare dashboard → profile icon → **My Profile** → **API Tokens** → **Create Token** → **Custom Token**
   - Permission: **Account → Account Analytics → Read** only
   - Limit the token to that same account

::: warning Set the credentials at runtime
On **Workers**, add `NUXT_CF_ACCOUNT_ID` as a variable and `NUXT_CF_API_TOKEN` as an encrypted secret under the Worker's **Settings → Runtime variables and secrets → Production** (also called **Variables and Secrets**). Values set only in **Workers Builds** are insufficient. The automatically created deployment token does not populate these settings.

On **Pages**, add both under the project's **Settings → Variables and Secrets → Production**. Pages shares these settings between build and runtime.

Save and deploy the changes, then wait for deployment to finish. These values must be available to the deployed application, and the API token must remain valid.
:::

## Why a working link can show zero visits

The `ANALYTICS` binding **writes visits**. The account ID and API token **read statistics** through Cloudflare's Analytics Engine SQL API. Both parts must be configured.

If either runtime credential is missing, the application currently returns HTTP 200 with `{"data":[]}` instead of reporting a configuration error. The dashboard can therefore show zero or no data while the binding continues recording visits. Adding valid query credentials makes previously recorded events within Analytics Engine's retention period available; visits made without a working binding cannot be recovered this way.

An invalid or expired token can cause a query error. A different account, dataset, link filter, or date range can produce errors or empty results. Keep the `ANALYTICS` dataset and `NUXT_DATASET` aligned (`sink` by default).

## Verify the setup

1. Confirm both `NUXT_CF_*` names appear in the **Production runtime** settings and `NUXT_CF_API_TOKEN` is marked as encrypted.
2. Confirm `ANALYTICS` points to the dataset owned by that account and the token has **Account → Account Analytics → Read**.
3. Open the short URL itself to generate a visit. Allow time for Analytics Engine ingestion, then refresh that link's statistics page with a date range that includes the visit.
4. If statistics stay empty, inspect the dashboard's `/api/stats/counters` response in browser developer tools. HTTP 200 with `{"data":[]}` alone does not prove that no visits occurred; check the runtime credentials first, then the dataset and filters. For query failures, inspect Worker logs without sharing tokens or authorization headers.

## What you can see

Successful visits feed counters, charts, heatmaps, recent events, and locations. Filter by link, time, country, browser, OS, device, and referrer.

Numbers can be **approximate** (Cloudflare samples high traffic). Low traffic can look uneven for the same reason.

To hide detected bots from stats and [click webhooks](/configuration/webhooks), set `NUXT_DISABLE_BOT_ACCESS_LOG=true`.

## Near-realtime page

::: tip Not a live stream
This page does **not** use WebSocket. It refreshes about every 10 seconds and plays new events at about one per second. Pause or a hidden tab stops playback. Treat it as a live-looking overview, not a perfect event feed.
:::

## Export

Download filtered stats as CSV from the dashboard or the stats export API (slug, URL, viewers, views, referrers).

Link JSON export is separate — see [Import and Export](./import-export).
