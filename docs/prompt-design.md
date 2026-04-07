# Prompt Engineering 设计文档

## 1. System Prompt 全文（带注释）

```text
You are ChargeFlow Agent, a personal AI assistant built for a portfolio demo.

Role layer:
- Be proactive, clear, and trustworthy.
- Distinguish between information lookup, scheduling, note retrieval, and casual chat.

Tool layer:
- Use tools whenever the user asks about schedules, creating events, or searching notes.
- Prefer tool calls over hallucinating calendar or knowledge-base data.

Memory layer:
- Use these remembered facts when helpful:
- User usually avoids meetings on Wednesday afternoons.

Constraint layer:
- Keep answers concise but useful.
- Explain tool results naturally.
- If a preference conflicts with a scheduling request, mention it politely.
- If information is missing, ask one focused follow-up question.
```

### 设计意图说明
- **角色层**：保证 Agent 的人格和任务边界清晰
- **工具层**：提高 tool use 触发率，减少模型瞎编
- **记忆层**：让用户偏好在多轮对话中形成连续性
- **约束层**：规范回答风格与异常处理策略

## 2. Prompt 分层结构
1. **角色层**：定义 Agent 身份、目标、语气
2. **工具层**：说明何时必须调用 tool，如何解释结果
3. **记忆层**：注入 durable memory，增强个性化与上下文连续性
4. **约束层**：限制输出长度、要求 follow-up 问题聚焦、避免 hallucination

## 3. Few-shot Examples 设计
### Example A：查询日程
- 用户：帮我看看明天有什么安排
- 期望：调用 `get_calendar_events` 后再回答

### Example B：创建会议
- 用户：下周三下午 3 点帮我约一个和产品团队的会议
- 期望：调用 `create_calendar_event`，若用户偏好冲突则给出提醒

### Example C：搜索笔记
- 用户：帮我找一下关于面试故事的笔记
- 期望：调用 `search_notes`

## 4. 常见 Bad Case 与修复策略
- **Bad Case 1：模型直接编造日程**
  - 修复：在工具层加入“schedule queries must use tool”硬约束
- **Bad Case 2：创建事件缺少时间参数**
  - 修复：约束层要求只问一个聚焦澄清问题
- **Bad Case 3：用户记忆未被利用**
  - 修复：将 memory 注入改为显式 bullet list，并在 prompt 中加入 preference conflict reminder

## 5. 工具调用 JSON Schema 定义

### get_calendar_events
```json
{
  "type": "object",
  "properties": {
    "date": { "type": "string" },
    "rangeStart": { "type": "string" },
    "rangeEnd": { "type": "string" },
    "keyword": { "type": "string" }
  },
  "additionalProperties": false
}
```

### create_calendar_event
```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "start": { "type": "string" },
    "end": { "type": "string" },
    "location": { "type": "string" },
    "attendees": { "type": "array", "items": { "type": "string" } },
    "notes": { "type": "string" }
  },
  "required": ["title", "start", "end"],
  "additionalProperties": false
}
```

### search_notes
```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string" }
  },
  "required": ["query"],
  "additionalProperties": false
}
```
