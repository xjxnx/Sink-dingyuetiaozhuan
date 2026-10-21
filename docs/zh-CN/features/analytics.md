---
title: 访问分析与近实时视图
description: 启用访问分析、查看图表和日志、了解近实时视图、排除机器人并导出 CSV。
---

# 访问分析与近实时视图

访问分析是**可选**功能。不配置时，短链、登录和链接管理仍可用 — 图表、日志和近实时视图会是空的。

## 如何启用（三样都要）

需要同时具备：

1. **Analytics Engine 绑定**，名称必须是 `ANALYTICS`
   - **Workers：** 通常由部署配置生成（数据集默认 `sink`）
   - **Pages：** **Settings → Bindings → Add → Analytics Engine**
   - 变量名：`ANALYTICS`
   - 数据集：默认 `sink`。若设置了 `NUXT_DATASET`，这里必须相同

2. **账户 ID** — 把 `NUXT_CF_ACCOUNT_ID` 设为承载本应用的 Cloudflare 账户 ID  
   （仪表盘侧边栏账户名，或登录后 URL 里可见）

3. **API 令牌** — 把 `NUXT_CF_API_TOKEN` 设为加密密钥：
   - Cloudflare 仪表盘 → 右上角头像 → **My Profile** → **API Tokens** → **Create Token** → **Custom Token**
   - 权限仅需：**Account → Account Analytics → Read**
   - 建议限制到同一账户

::: warning All three settings are required to display statistics
Analytics is optional, but displaying statistics requires the `ANALYTICS` binding and **both** runtime credentials: `NUXT_CF_ACCOUNT_ID` and `NUXT_CF_API_TOKEN`.

On **Workers**, add the account ID as a variable and the API token as an encrypted secret under the Worker's **Settings → Runtime variables and secrets → Production** (also called **Variables and Secrets**). Values set only in **Workers Builds** are insufficient. The automatically created deployment token does not populate these settings.

On **Pages**, add both under the project's **Settings → Variables and Secrets → Production**. Pages shares these settings between build and runtime.

Limit the token to the account that owns the dataset, with **Account → Account Analytics → Read**. Save and deploy the changes, then wait for deployment to finish. The API token must remain valid.
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

## 能看到什么

成功的访问会进入计数器、图表、热力图、最近事件和位置。可按链接、时间、国家/地区、浏览器、系统、设备、来源筛选。

数字可能是**近似值**（Cloudflare 会对大流量采样）。低流量时也可能看起来不均匀。

要从统计和[点击 Webhook](/zh-CN/configuration/webhooks) 排除机器人，设置 `NUXT_DISABLE_BOT_ACCESS_LOG=true`。

## 近实时页面

::: tip 不是真正的实时流
这个页面**不用** WebSocket。大约每 10 秒刷新一次，并以大约每秒 1 个事件回放。暂停或标签页隐藏会停止回放。请当作“看起来像实时”的概览，而不是完整事件流。
:::

## 导出

可在仪表盘或统计导出 API 下载筛选后的 CSV（短链码、URL、访客、访问量、来源等）。

链接 JSON 导出是另一项功能 — 见[导入/导出](./import-export)。
