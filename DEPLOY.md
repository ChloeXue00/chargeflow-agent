# 🚀 部署指南 / Deploy Guide

架构:**前端 (React/Vite) → Vercel** · **后端 (Express) → Render** · **真实 Claude API**。
全程约 15 分钟,均使用免费额度。两个平台都用 GitHub 登录即可。

```
┌─────────────┐   HTTPS    ┌──────────────────┐   Anthropic SDK   ┌────────────┐
│  Vercel     │──────────▶ │  Render          │ ───────────────▶  │  Claude    │
│  (frontend) │            │  (Express API)   │                   │  API       │
└─────────────┘            └──────────────────┘                   └────────────┘
   VITE_API_BASE              ANTHROPIC_API_KEY
                              CLIENT_ORIGIN (CORS)
```

> ⚠️ 顺序很重要:**先部署后端拿到 URL → 再部署前端 → 最后回填 CORS**。

---

## ① 后端 → Render

1. 打开 <https://dashboard.render.com> → 用 GitHub 登录。
2. **New → Blueprint** → 选择 `ChloeXue00/chargeflow-agent` 仓库。
   Render 会自动读取仓库根目录的 [`render.yaml`](./render.yaml),识别出 `chargeflow-agent-api` 服务。
3. 点 **Apply**。它会提示你填两个标记为 `sync: false` 的密钥:
   | Key | Value |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | 你的真实 key(`sk-ant-...`) |
   | `CLIENT_ORIGIN` | 先随便填 `http://localhost:5173`,第 ③ 步再回来改 |
4. 等待 build 完成。拿到后端地址,形如 `https://chargeflow-agent-api.onrender.com`。
5. 验证:浏览器打开 `https://你的后端.onrender.com/api/health`,应返回
   `{"ok":true,"service":"chargeflow-agent-server"}`。

> 💤 免费版闲置 15 分钟会休眠,首次访问冷启动约 30–50 秒。这是免费档的正常表现。

---

## ② 前端 → Vercel

1. 打开 <https://vercel.com/new> → 用 GitHub 登录 → 导入 `chargeflow-agent` 仓库。
2. **Root Directory** 选择 `client`(关键!点 Edit 选 client 目录)。
   Vercel 会自动识别 Vite,build 命令与输出目录由 [`client/vercel.json`](./client/vercel.json) 提供。
3. 展开 **Environment Variables**,添加:
   | Name | Value |
   | --- | --- |
   | `VITE_API_BASE` | `https://你的后端.onrender.com/api` （注意结尾的 `/api`,无尾斜杠) |
4. 点 **Deploy**。完成后拿到前端地址,形如 `https://chargeflow-agent.vercel.app`。

---

## ③ 回填 CORS(让前端能访问后端)

1. 回到 Render → 你的服务 → **Environment** → 把 `CLIENT_ORIGIN` 改成你的 Vercel 域名:
   ```
   https://chargeflow-agent.vercel.app
   ```
   (无尾斜杠;如有多个域名用逗号分隔)
2. 保存 → Render 自动 redeploy。
3. 打开 Vercel 前端地址,问一句「帮我看看现在电量够不够用」,能看到真实 Claude 回复 + 工具调用链路即成功 ✅。

---

## ④ 收尾(可选但推荐)

- 把 [`README.md`](./README.md) 顶部两处 `chargeflow-agent.vercel.app` 替换为你的真实域名。
- 在 GitHub 仓库 **About** 区(右上齿轮)填入:
  - **Website**: 你的 Vercel 地址
  - **Description**: `LLM-powered intelligent EV cockpit agent — function calling, multi-tool orchestration & cross-session memory`
  - **Topics**: `ai-agent` `llm` `anthropic` `function-calling` `react` `ev-charging`

---

## ④.5 移动端内测 / Mobile Beta（可选）

部署后,移动小程序版在 **`https://你的域名.vercel.app/m`**(注意 `/m`)。

1. **生成二维码**:把 `/m` 地址丢进任意二维码生成器(或 `npx qrcode "https://你的域名.vercel.app/m"`),贴到朋友圈 / 内测群,扫码即用、可"添加到主屏幕"当 App(已配 PWA)。
2. **看内测数据**:前端已接入 **Vercel Web Analytics**。到 Vercel 项目 → **Analytics** 标签 → 开启即可看 PV / 访客;代码里还埋了自定义事件 **`agent_message`**(带 `surface: mobile | cockpit`),用来量化"到底有多少人真的在跟 Agent 对话"——这是验证需求最直接的信号。
3. 想要更强的留存/转化分析,可再接 PostHog / Plausible(非必需)。

---

## 成本与安全 / Cost & Safety

- 后端已内置 `/api/chat` **限流**(默认 60s/IP 最多 20 次,可用 `RATE_LIMIT_MAX` 调整)、请求体上限 256KB、对话长度上限,防止 key 被刷量。
- **Prompt caching** 让静态 system prompt 命中缓存,显著降低每次调用的输入成本。
- 想进一步控制开销:在 Render 把 `RATE_LIMIT_MAX` 调小,或在 [Anthropic Console](https://console.anthropic.com) 给 key 设置每月消费上限。
- 临时想要"零成本只读演示":在 Render 把 `ANTHROPIC_API_KEY` 删除或加一个 `MOCK_MODE=true`,即切回 mock 模式。

---

## 常见问题 / Troubleshooting

| 现象 | 原因 / 解决 |
| --- | --- |
| 前端报 CORS 错误 | `CLIENT_ORIGIN` 没填对(要和浏览器地址栏完全一致、无尾斜杠),改完等 Render redeploy |
| 前端能开但发消息 500 | 后端 `ANTHROPIC_API_KEY` 没设或无效;看 Render 日志 |
| 首次访问很慢 | Render 免费版冷启动,属正常 |
| 访问后端根路径显示 `Cannot GET /` | 正常,后端是纯 API,健康检查走 `/api/health` |
| 发消息返回 429 | 触发限流,稍等或调高 `RATE_LIMIT_MAX` |
