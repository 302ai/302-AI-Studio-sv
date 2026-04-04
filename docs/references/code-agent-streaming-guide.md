# Code Agent 流式响应架构指南

本文档详细解释 302.AI Claude Code Agent 的流式响应处理架构，包括 `router.ts` 和 `claude-code-processor.ts` 之间的协作关系。

## 目录

1. [概述](#概述)
2. [核心概念](#核心概念)
3. [数据流图解](#数据流图解)
4. [SSE 协议基础](#sse-协议基础)
5. [两种格式对比](#两种格式对比)
6. [代码详解](#代码详解)
7. [乐观更新机制](#乐观更新机制)
8. [工具调用流程](#工具调用流程)
9. [常见问题](#常见问题)

---

## 概述

### 为什么需要这个架构？

当用户在 302 AI Studio 中使用 Claude Code Agent 时：

1. **前端** 使用 AI SDK 5.0 的 `Chat` 类来处理消息
2. **302.AI 服务器** 返回的是 Anthropic 格式的 SSE 流
3. **问题**：这两种格式不兼容！

因此，我们需要一个"翻译层"将 302.AI 的响应格式转换为 AI SDK 能理解的格式。

```
┌─────────────┐      ┌─────────────┐      ┌─────────────────────┐      ┌──────────┐
│   前端 UI   │ ←──→ │  router.ts  │ ←──→ │ claude-code-processor│ ←──→ │ 302.AI   │
│  (AI SDK)   │      │  (Hono 路由) │      │   (格式转换器)        │      │  服务器   │
└─────────────┘      └─────────────┘      └─────────────────────┘      └──────────┘
       ↑                                                                      │
       │                    AI SDK UIMessageStream 格式                        │
       └────────────────────────────────────────────────────────────────────────
                                   Anthropic SSE 格式
```

---

## 核心概念

### 什么是 SSE（Server-Sent Events）？

SSE 是一种让服务器主动向客户端推送数据的技术。想象一下：

- **传统 HTTP**：你问一个问题，服务器给你一个完整答案
- **SSE**：你问一个问题，服务器一个字一个字地告诉你答案（就像 ChatGPT 打字的效果）

SSE 的格式非常简单：

```
data: {"type":"text","content":"你"}

data: {"type":"text","content":"好"}

data: {"type":"text","content":"！"}

```

每条消息以 `data: ` 开头，消息之间用空行（`\n\n`）分隔。

### 什么是 UIMessageStream？

AI SDK 5.0 定义了一种标准的消息流格式，用于前端渲染 AI 响应。主要事件类型包括：

| 事件类型                | 说明         | 示例                                                                       |
| ----------------------- | ------------ | -------------------------------------------------------------------------- |
| `start`                 | 消息开始     | `{"type":"start","messageId":"msg-123"}`                                   |
| `text-start`            | 文本块开始   | `{"type":"text-start","id":"text-0"}`                                      |
| `text-delta`            | 文本增量     | `{"type":"text-delta","id":"text-0","delta":"你好"}`                       |
| `text-end`              | 文本块结束   | `{"type":"text-end","id":"text-0"}`                                        |
| `tool-input-start`      | 工具调用开始 | `{"type":"tool-input-start","toolCallId":"call-1","toolName":"Write"}`     |
| `tool-input-delta`      | 工具参数增量 | `{"type":"tool-input-delta","toolCallId":"call-1","inputTextDelta":"..."}` |
| `tool-input-available`  | 工具参数完成 | `{"type":"tool-input-available","toolCallId":"call-1","input":{...}}`      |
| `tool-output-available` | 工具执行结果 | `{"type":"tool-output-available","toolCallId":"call-1","output":{...}}`    |
| `finish`                | 消息结束     | `{"type":"finish","finishReason":"stop"}`                                  |

---

## 数据流图解

让我们用一个完整的例子来说明数据如何流动：

### 用户发送消息："写一个 Hello World"

```
时间线 →

[用户点击发送]
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: router.ts 立即发送 start 事件（乐观更新）                      │
│                                                                      │
│  data: {"type":"start","messageId":"msg-xxx","messageMetadata":{    │
│         "model":"claude-sonnet-4-5","provider":"302ai-code-agent"}} │
│                                                                      │
│  → 前端立刻显示 AI 消息占位符（"正在思考..."）                           │
└─────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: router.ts 向 302.AI 发起请求                                │
│                                                                      │
│  POST https://api.302.ai/v1/chat/completions                        │
│  Body: { model: "sandbox-xxx", messages: [...] }                    │
└─────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: 302.AI 返回 Anthropic 格式的 SSE 流                         │
│                                                                      │
│  data: {"type":"stream_event","event":{"type":"message_start",...}} │
│  data: {"type":"stream_event","event":{"type":"content_block_start",│
│         "content_block":{"type":"text"}}}                           │
│  data: {"type":"stream_event","event":{"type":"content_block_delta",│
│         "delta":{"type":"text_delta","text":"我来"}}}                │
│  ...                                                                │
└─────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: claude-code-processor.ts 转换格式                           │
│                                                                      │
│  输入: {"type":"stream_event","event":{"type":"content_block_delta", │
│         "delta":{"type":"text_delta","text":"我来"}}}                │
│                                                                      │
│  输出: data: {"type":"text-delta","id":"text-0","delta":"我来"}      │
└─────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: 前端 AI SDK 接收并渲染                                       │
│                                                                      │
│  Chat 类解析事件 → 更新 messages 状态 → UI 显示文字                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## SSE 协议基础

### SSE 消息结构

```
event: message_start          ← 可选的事件类型标识
data: {"type":"xxx",...}      ← 实际数据（必须以 "data: " 开头）
                              ← 空行表示消息结束
event: content_block_delta
data: {"type":"xxx",...}

```

### 处理 SSE 的挑战

1. **数据可能不完整**：网络传输时，一条消息可能分多次到达
2. **需要缓冲区**：保存未完成的数据，等待下一块到达
3. **需要状态追踪**：记住当前正在处理哪个文本块/工具调用

---

## 两种格式对比

### 302.AI (Anthropic 格式) vs AI SDK (UIMessageStream 格式)

| 场景         | 302.AI 输入格式                                                                                                           | AI SDK 输出格式                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 消息开始     | `{"type":"stream_event","event":{"type":"message_start",...}}`                                                            | `{"type":"start","messageId":"..."}`                                    |
| 文本开始     | `{"type":"stream_event","event":{"type":"content_block_start","content_block":{"type":"text"}}}`                          | `{"type":"text-start","id":"..."}`                                      |
| 文本增量     | `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}}`               | `{"type":"text-delta","id":"...","delta":"..."}`                        |
| 文本结束     | `{"type":"stream_event","event":{"type":"content_block_stop"}}`                                                           | `{"type":"text-end","id":"..."}`                                        |
| 工具调用开始 | `{"type":"stream_event","event":{"type":"content_block_start","content_block":{"type":"tool_use","name":"Write"}}}`       | `{"type":"tool-input-start","toolCallId":"...","toolName":"Write"}`     |
| 工具参数     | `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"..."}}}` | `{"type":"tool-input-delta","toolCallId":"...","inputTextDelta":"..."}` |
| 工具调用完成 | `{"type":"stream_event","event":{"type":"content_block_stop"}}`                                                           | `{"type":"tool-input-available","toolCallId":"...","input":{...}}`      |
| 工具执行结果 | `{"type":"user","message":{"content":[{"type":"tool_result",...}]}}`                                                      | `{"type":"tool-output-available","toolCallId":"...","output":{...}}`    |
| 消息结束     | `{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"end_turn"}}}`                             | `{"type":"finish","finishReason":"stop"}`                               |

---

## 代码详解

### 文件 1: `router.ts` - HTTP 路由处理

这个文件定义了 `/chat/302ai-code-agent` 路由，负责：

1. 接收前端请求
2. 立即发送 `start` 事件（乐观更新）
3. 转发请求到 302.AI
4. 返回转换后的流

```typescript
// 路由入口
app.post("/chat/302ai-code-agent", async (c) => {
  // 1. 解析请求参数
  const { model, apiKey, messages, threadId, ... } = await c.req.json();

  // 2. 预先生成 messageId（用于乐观更新）
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // 3. 创建转换器（传入预生成的 messageId）
  const claudeCodeFetch = createClaudeCodeFetch(messageId);

  // 4. 构建立即发送的 start 事件
  const immediateStartEvent = `data: ${JSON.stringify({
    type: "start",
    messageId,
    messageMetadata: {
      model,                        // 用户选择的模型
      provider: "302ai-code-agent", // 提供商标识
      createdAt: new Date().toISOString(),
    },
  })}\n\n`;

  // 5. 创建组合流
  const combinedStream = new ReadableStream({
    async start(controller) {
      // 5.1 立即发送 start 事件（不等待服务器响应）
      controller.enqueue(encoder.encode(immediateStartEvent));

      // 5.2 发起实际请求
      const response = await claudeCodeFetch(...);

      // 5.3 转发响应数据
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);  // 数据已被 processor 转换
      }
    },
  });

  // 6. 返回 SSE 响应
  return new Response(combinedStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",  // AI SDK 识别标记
    },
  });
});
```

#### 关键点解释

**为什么要预生成 messageId？**

```typescript
const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
```

- AI SDK 需要 `messageId` 来追踪消息
- 我们在发送请求**之前**就生成它
- 这样可以立即发送 `start` 事件，无需等待服务器

**为什么要立即发送 start？**

```typescript
controller.enqueue(encoder.encode(immediateStartEvent));  // ← 在 await 之前！
const response = await claudeCodeFetch(...);              // ← 这里才发请求
```

这就是"乐观更新"（Optimistic Update）：

- 用户点击发送后，**立刻**看到 AI 消息占位符
- 不需要等待网络请求往返
- 大大改善用户体验

---

### 文件 2: `claude-code-processor.ts` - 格式转换器

这个文件是核心转换逻辑，负责将 302.AI 的 Anthropic 格式转换为 AI SDK 格式。

#### 类结构

```typescript
class ClaudeCodeProcessor {
	// 状态变量
	private messageId: string = ""; // 当前消息 ID
	private buffer: string = ""; // SSE 数据缓冲区
	private contentBlocks: Map<number, ContentBlockState> = new Map(); // 内容块状态
	private hasStarted: boolean = false; // 是否已发送 start
	private textBlockCounter: number = 0; // 文本块计数器

	constructor(preGeneratedMessageId?: string) {
		if (preGeneratedMessageId) {
			// 使用预生成的 ID，跳过发送 start（因为 router 已发送）
			this.messageId = preGeneratedMessageId;
			this.hasStarted = true;
		}
	}
}
```

#### 核心方法 1: `processSSEChunk` - 处理 SSE 数据块

```typescript
processSSEChunk(chunk: string): string {
  // 1. 将新数据添加到缓冲区
  this.buffer += chunk;

  // 2. 按双换行符分割（SSE 消息分隔符）
  const events = this.buffer.split("\n\n");

  // 3. 最后一个可能不完整，保留在缓冲区
  this.buffer = events.pop() ?? "";

  // 4. 处理每个完整的事件
  const processedEvents: string[] = [];
  for (const event of events) {
    const lines = event.split("\n");
    for (const line of lines) {
      const processed = this.processLine(line);
      if (processed) {
        processedEvents.push(processed);
      }
    }
  }

  return processedEvents.join("\n\n") + "\n\n";
}
```

**图解缓冲区工作原理：**

```
假设网络分 3 次传输数据：

第 1 次收到: 'data: {"type":"a"}\n\ndata: {"ty'
                                        ↑
                                   这里数据不完整

处理后:
  - 发送: data: {"type":"a"}
  - 缓冲区保留: 'data: {"ty'

第 2 次收到: 'pe":"b"}\n\ndata: {"type":"c"'

缓冲区拼接: 'data: {"type":"b"}\n\ndata: {"type":"c"'

处理后:
  - 发送: data: {"type":"b"}
  - 缓冲区保留: 'data: {"type":"c"'

第 3 次收到: '}\n\n'

缓冲区拼接: 'data: {"type":"c"}\n\n'

处理后:
  - 发送: data: {"type":"c"}
  - 缓冲区清空
```

#### 核心方法 2: `transformAnthropicEvent` - 事件类型分发

```typescript
private transformAnthropicEvent(event: AnthropicEvent): string | null {
  switch (event.type) {
    case "message_start":
      return this.handleMessageStart(event);

    case "content_block_start":
      return this.handleContentBlockStart(event);

    case "content_block_delta":
      return this.handleContentBlockDelta(event);

    case "content_block_stop":
      return this.handleContentBlockStop(event);

    case "message_delta":
      return this.handleMessageDelta(event);

    case "message_stop":
    case "ping":
      return null;  // 忽略这些事件

    default:
      return null;
  }
}
```

#### 核心方法 3: `handleContentBlockStart` - 处理内容块开始

```typescript
private handleContentBlockStart(event: AnthropicEvent): string | null {
  const contentBlock = event.content_block;
  const index = event.index ?? 0;  // 内容块索引

  // 文本类型
  if (contentBlock.type === "text") {
    const textId = `text-${this.textBlockCounter++}`;

    // 保存状态（用于后续处理）
    this.contentBlocks.set(index, {
      type: "text",
      id: textId,
      inputJsonParts: [],
    });

    // 返回转换后的事件
    return `data: ${JSON.stringify({
      type: "text-start",
      id: textId,
    })}`;
  }

  // 工具调用类型
  if (contentBlock.type === "tool_use") {
    const toolCallId = contentBlock.id;
    const toolName = contentBlock.name;

    // 保存状态
    this.contentBlocks.set(index, {
      type: "tool_use",
      id: toolCallId,
      toolName: toolName,
      toolCallId: toolCallId,
      inputJsonParts: [],  // 用于累积 JSON 参数
    });

    return `data: ${JSON.stringify({
      type: "tool-input-start",
      toolCallId: toolCallId,
      toolName: toolName,
    })}`;
  }
}
```

**为什么需要 `contentBlocks` Map？**

因为：

1. 302.AI 用 `index` 来标识不同的内容块
2. 多个块可能**同时存在**（比如先文字后工具调用）
3. 我们需要追踪每个块的状态（ID、累积的数据等）

```
消息结构示例：
┌─────────────────────────────┐
│ index: 0  │ 文本: "我来创建..." │
├─────────────────────────────┤
│ index: 1  │ 工具: Write        │
│           │ 参数: {path:...}   │
└─────────────────────────────┘
```

#### 核心方法 4: `handleContentBlockDelta` - 处理增量数据

```typescript
private handleContentBlockDelta(event: AnthropicEvent): string | null {
  const delta = event.delta;
  const index = event.index ?? 0;
  const blockState = this.contentBlocks.get(index);

  // 文本增量
  if (delta.type === "text_delta" && delta.text) {
    return `data: ${JSON.stringify({
      type: "text-delta",
      id: blockState?.id,
      delta: delta.text,  // 实际的文字内容
    })}`;
  }

  // 工具参数增量（JSON 片段）
  if (delta.type === "input_json_delta" && delta.partial_json) {
    // 累积 JSON 片段（工具参数可能很长，分多次发送）
    blockState.inputJsonParts.push(delta.partial_json);

    return `data: ${JSON.stringify({
      type: "tool-input-delta",
      toolCallId: blockState.toolCallId,
      inputTextDelta: delta.partial_json,
    })}`;
  }
}
```

**工具参数累积示例：**

```
第 1 次: {"file_pa
第 2 次: th":"/home/
第 3 次: user/test.
第 4 次: txt","cont
第 5 次: ent":"Hello"}

累积结果: {"file_path":"/home/user/test.txt","content":"Hello"}
```

#### 核心方法 5: `handleContentBlockStop` - 处理内容块结束

```typescript
private handleContentBlockStop(event: AnthropicEvent): string | null {
  const index = event.index ?? 0;
  const blockState = this.contentBlocks.get(index);

  if (blockState.type === "text") {
    // 清理状态
    this.contentBlocks.delete(index);

    return `data: ${JSON.stringify({
      type: "text-end",
      id: blockState.id,
    })}`;
  }

  if (blockState.type === "tool_use") {
    // 拼接所有 JSON 片段
    const fullJson = blockState.inputJsonParts.join("");
    const input = JSON.parse(fullJson);  // 解析完整参数

    this.contentBlocks.delete(index);

    return `data: ${JSON.stringify({
      type: "tool-input-available",
      toolCallId: blockState.toolCallId,
      toolName: blockState.toolName,
      input: input,  // 完整的工具参数
    })}`;
  }
}
```

---

## 乐观更新机制

### 什么是乐观更新？

"乐观更新"是一种 UI 优化策略：**假设操作会成功，先更新 UI，再执行实际操作**。

### 没有乐观更新时的流程

```
[用户点击发送] → [等待网络请求] → [等待服务器处理] → [收到响应] → [显示 AI 消息]
                 ↑___________________500ms~2000ms___________________↑
                                    用户看到空白
```

### 有乐观更新时的流程

```
[用户点击发送] → [立即显示 AI 消息占位符] → [后台发送请求] → [流式更新内容]
                 ↑______10ms______↑
                    即时反馈！
```

### 代码实现

```typescript
// router.ts 中
const combinedStream = new ReadableStream({
  async start(controller) {
    // 1. 立即发送（不 await）
    controller.enqueue(encoder.encode(immediateStartEvent));

    // 2. 然后才发起网络请求（这里 await）
    const response = await claudeCodeFetch(...);

    // 3. 流式转发数据
    ...
  }
});
```

关键在于：`controller.enqueue()` 在 `await` **之前**执行。

### messageMetadata 的作用

```typescript
const immediateStartEvent = `data: ${JSON.stringify({
	type: "start",
	messageId,
	messageMetadata: {
		model, // ← 显示正确的模型名称
		provider: "302ai-code-agent", // ← 显示正确的图标
		createdAt: new Date().toISOString(),
	},
})}\n\n`;
```

前端通过 `messageMetadata` 知道：

- 显示哪个模型的图标
- 显示哪个模型的名称
- 消息创建时间

---

## 工具调用流程

Claude Code Agent 最强大的功能是**工具调用**——AI 可以执行实际操作（读写文件、运行命令等）。

### 工具调用完整流程图

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           工具调用完整流程                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. AI 决定调用工具                                                         │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ 302.AI 发送:                                                     │    │
│     │ {"type":"stream_event","event":{"type":"content_block_start",   │    │
│     │   "content_block":{"type":"tool_use","name":"Write","id":"x"}}} │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                             │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ 转换为:                                                          │    │
│     │ {"type":"tool-input-start","toolCallId":"x","toolName":"Write"} │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                             │
│     前端显示: [Write 工具] 正在准备参数...                                   │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  2. AI 流式发送工具参数                                                      │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ 302.AI 发送 (多次):                                              │    │
│     │ {"type":"stream_event","event":{"type":"content_block_delta",   │    │
│     │   "delta":{"type":"input_json_delta","partial_json":"..."}}}    │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                             │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ 转换为:                                                          │    │
│     │ {"type":"tool-input-delta","toolCallId":"x","inputTextDelta":""}│    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                             │
│     前端显示: 参数正在加载... {"file_path":"/home...                        │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  3. 工具参数完成                                                            │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ 302.AI 发送:                                                     │    │
│     │ {"type":"stream_event","event":{"type":"content_block_stop"}}   │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                             │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ 转换为:                                                          │    │
│     │ {"type":"tool-input-available","toolCallId":"x",                │    │
│     │  "toolName":"Write","input":{"file_path":"...","content":"..."}}│    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                             │
│     前端显示: [Write] 参数准备完成，等待执行...                               │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  4. 302.AI 沙箱执行工具，返回结果                                            │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ 302.AI 发送:                                                     │    │
│     │ {"type":"user","message":{"content":[{"type":"tool_result",     │    │
│     │   "tool_use_id":"x","content":"File written successfully"}]}}   │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                             │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ 转换为:                                                          │    │
│     │ {"type":"tool-output-available","toolCallId":"x",               │    │
│     │  "output":"File written successfully"}                          │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                             │
│     前端显示: [Write] ✓ 执行成功                                            │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  5. AI 继续生成文本或调用更多工具...                                          │
│     (重复上述流程)                                                          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 关键点：不发送 finish-step

```typescript
// handleMessageDelta 中
if (finishReason === "tool-calls") {
	// 重要：不发送任何事件！
	return null;
}
```

**为什么？**

如果发送 `finish-step` 或 `finish` 事件，AI SDK 的 `Chat` 类会认为消息结束了，触发 `onFinish` 回调。但实际上：

1. 工具还没执行
2. 结果还没返回
3. AI 可能还要继续说话

所以我们让流"自然流动"，只在真正结束时（`stop_reason: "end_turn"`）才发送 `finish`。

---

## 常见问题

### Q1: 为什么前端一开始显示 "gpt-4o"？

**原因**：`start` 事件中没有包含 `messageMetadata`，或使用了错误的字段名。

**解决方案**：确保使用 `messageMetadata`（不是 `metadata`）：

```typescript
// ✅ 正确
{
  type: "start",
  messageId,
  messageMetadata: { model, provider }  // ← 必须是 messageMetadata
}

// ❌ 错误
{
  type: "start",
  messageId,
  metadata: { model, provider }  // ← AI SDK 不识别这个
}
```

### Q2: 为什么消息发送后要等很久才看到 AI 回复？

**原因**：没有实现乐观更新，`start` 事件在网络请求完成后才发送。

**解决方案**：立即发送 `start` 事件：

```typescript
// ✅ 正确
controller.enqueue(immediateStartEvent);  // 先发送
const response = await fetch(...);        // 后请求

// ❌ 错误
const response = await fetch(...);        // 先请求
controller.enqueue(startEvent);           // 后发送
```

### Q3: 工具调用后流就断了？

**原因**：在 `stop_reason: "tool_use"` 时发送了 `finish` 事件。

**解决方案**：工具调用时不发送任何结束事件：

```typescript
if (delta.stop_reason === "tool_use") {
	return null; // 什么都不发！
}
```

### Q4: 工具参数解析失败？

**原因**：JSON 参数分多次发送，需要累积。

**解决方案**：使用数组累积所有片段，最后再解析：

```typescript
// 累积
blockState.inputJsonParts.push(delta.partial_json);

// 最后解析
const fullJson = blockState.inputJsonParts.join("");
const input = JSON.parse(fullJson);
```

---

## 总结

| 组件                       | 职责      | 关键功能                     |
| -------------------------- | --------- | ---------------------------- |
| `router.ts`                | HTTP 路由 | 乐观更新、请求转发、流组合   |
| `claude-code-processor.ts` | 格式转换  | SSE 解析、状态追踪、事件转换 |

**核心设计思想**：

1. **乐观更新**：立即反馈，提升体验
2. **流式转换**：实时处理，低延迟
3. **状态追踪**：正确处理多个内容块
4. **工具支持**：无缝处理工具调用循环

希望这份文档能帮助你理解 Code Agent 的流式响应架构！如有问题，欢迎继续探索代码。
