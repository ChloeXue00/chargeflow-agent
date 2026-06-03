# 🚀 部署指南 / Deploy Guide

**全栈部署到 Vercel** —— 前端(静态) + 后端(Serverless Functions)在**同一个项目、同一个域名**。
免费、**不用绑信用卡**、一次部署、无 CORS 问题。约 8 分钟。

```
            ┌──────────────────────────────────────────┐
   浏览器 ──▶│  Vercel 项目 (chargeflow-agent)            │
            │  ├─ 静态前端  client/dist  →  /  和  /m    │
            │  └─ Serverless API  api/[...path].mjs → /api/* │──▶ Claude API
            └──────────────────────────────────────────┘
                         ANTHROPIC_API_KEY (env)
```

> 后端是 Express 应用,通过 `api/[...path].mjs` 以 Serverless Function 形式运行。
> 注意:serverless 文件系统只读,**记忆/待办为按实例的临时状态**(冷启动重置)——对 demo / 内测足够。

---

## ① 准备

- 一个 **Anthropic API key**(<https://console.anthropic.com> → API Keys,形如 `sk-ant-...`)
- 一个 GitHub 账号(仓库已就绪)

---

## ② 部署到 Vercel

1. 打开 <https://vercel.com/new> → 用 **GitHub 登录** → 导入 `ChloeXue00/chargeflow-agent`
2. **Root Directory** 保持 **仓库根目录**(不要选 `client`!根目录的 `vercel.json` 会自动构建前端 + 部署 API 函数)
3. 展开 **Environment Variables**,添加:
   | Name | Value |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | 你的真实 key `sk-ant-...` |
   | `ANTHROPIC_MODEL` | `claude-sonnet-4-6`(可选) |
   | `AMAP_WEB_KEY` | 高德 Web服务 key(可选)—— 配了就用**真实附近充电站**搜索,不配回退 mock |
4. 点 **Deploy**,等待构建完成

构建做了三件事(由根 `vercel.json` 驱动):`npm install` → `npm run build --workspace client` → 把 `api/` 目录部署为 Serverless Functions。

---

## ③ 验证

部署完成后拿到地址,形如 `https://chargeflow-agent.vercel.app`:

- **车机座舱版**:`https://你的域名.vercel.app/`
- **移动小程序版**:`https://你的域名.vercel.app/m`
- **后端健康检查**:`https://你的域名.vercel.app/api/health` → 应返回 `{"ok":true,...}`

在页面问一句「帮我看看现在电量够不够用」,能看到真实 Claude 回复 + 工具调用链路即成功 ✅。

---

## ④ 收尾(推荐)

- 把 [`README.md`](./README.md) / [`README_EN.md`](./README_EN.md) 顶部的 `chargeflow-agent.vercel.app` 占位换成你的真实域名。
- GitHub 仓库 **About**(右上齿轮):填 **Website** = Vercel 地址;**Topics** = `ai-agent` `llm` `anthropic` `function-calling` `react` `pwa`。

---

## ⑤ 移动端内测 / Mobile Beta

- 移动端在 **`/m`**;已配 PWA,手机上可"添加到主屏幕"当 App 用。
- **二维码**:`npx qrcode "https://你的域名.vercel.app/m"`(或任意二维码工具),贴到内测群/朋友圈扫码即用。
- **看数据**:已接入 **Vercel Web Analytics** —— 到 Vercel 项目 → **Analytics** 标签开启,即可看 PV / 访客;代码里还埋了自定义事件 **`agent_message`**(带 `surface: mobile | cockpit`),直接量化"多少人真的在跟 Agent 对话"。

---

## 成本与安全 / Cost & Safety

- `/api/chat` 已内置**限流**(默认 60s/IP 最多 20 次,环境变量 `RATE_LIMIT_MAX` 可调)、请求体上限 256KB、对话长度上限,防止 key 被刷量。
- **Prompt caching**:静态 system prompt 命中缓存,显著降低每次调用输入成本。
- 想进一步控成本:在 Vercel 调小 `RATE_LIMIT_MAX`,或在 [Anthropic Console](https://console.anthropic.com) 给 key 设每月消费上限。
- 想要"零成本只读演示":在 Vercel 删除 `ANTHROPIC_API_KEY` 或加 `MOCK_MODE=true`,即切回 mock 模式。

---

## 函数超时 / Function Timeout

Agent 一次对话可能要 10–20 秒(两次 Claude 调用 + 工具执行)。根 `vercel.json` 已把 `api/**` 的 `maxDuration` 设为 **60s**。若 Hobby 套餐对时长有限制导致部署告警,可下调到 `30`。

---

## 常见问题 / Troubleshooting

| 现象 | 原因 / 解决 |
| --- | --- |
| Root Directory 选错成 `client` | API 函数不会部署 → `/api/*` 404。改回**仓库根目录**重新部署 |
| `/api/health` 404 | 同上,或 `api/` 未被识别;确认 Root Directory = 根目录 |
| 发消息 500 | `ANTHROPIC_API_KEY` 没设或无效;看 Vercel → Deployments → Functions 日志 |
| 发消息一直转圈后超时 | 函数超时;确认 `vercel.json` 的 `maxDuration`,或先用 mock 模式 |
| 发消息返回 429 | 触发限流,稍等或调高 `RATE_LIMIT_MAX` |
| 记忆/待办刷新后没了 | 正常:serverless 文件系统只读,记忆是按实例临时状态 |
