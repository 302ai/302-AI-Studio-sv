# Prompt 变量替换系统详解

本文档介绍 302AIStudio 中的 Prompt 模板变量替换系统，帮助开发者理解变量是如何定义、编辑、存储和渲染的。

## 目录

- [什么是变量替换系统](#什么是变量替换系统)
- [支持的变量列表](#支持的变量列表)
- [变量的完整生命周期](#变量的完整生命周期)
- [核心代码结构](#核心代码结构)
- [变量类型：一次性 vs 动态](#变量类型一次性-vs-动态)
- [代码示例](#代码示例)
- [常见问题](#常见问题)

---

## 什么是变量替换系统

变量替换系统允许用户在 **System Prompt**（系统提示词）和 **User Prompt Template**（用户提示词模板）中使用特殊的占位符，这些占位符会在发送消息时被替换为实际的值。

### 简单示例

**用户编写的模板：**

```
你是一个助手。当前时间是 {{#now#}}。
用户的问题是：{{#input#}}
```

**发送时实际发给 AI 的内容：**

```
你是一个助手。当前时间是 2025-12-12 14:30:45。
用户的问题是：今天天气怎么样？
```

### 变量语法

所有变量使用统一的语法格式：

```
{{#变量名#}}
```

例如：`{{#date#}}`、`{{#input#}}`、`{{#now#}}`

---

## 支持的变量列表

| 变量名     | 语法             | 说明                 | 输出示例              |
| ---------- | ---------------- | -------------------- | --------------------- |
| `input`    | `{{#input#}}`    | 用户输入的原始内容   | `今天天气怎么样？`    |
| `date`     | `{{#date#}}`     | 当前日期             | `2025-12-12`          |
| `time`     | `{{#time#}}`     | 当前时间             | `14:30:45`            |
| `datetime` | `{{#datetime#}}` | 日期和时间           | `2025-12-12 14:30:45` |
| `now`      | `{{#now#}}`      | 当前日期时间（动态） | `2025-12-12 14:30:45` |
| `model_id` | `{{#model_id#}}` | 当前使用的模型名称   | `gpt-4o`              |

### 变量定义位置

文件：`src/shared/prompt-editor/constant.ts`

```typescript
export const PRESET_VARIABLES: UserPromptTemplateVariables[] = [
	"input",
	"date",
	"time",
	"datetime",
	"now",
	"model_id",
];
```

---

## 变量的完整生命周期

变量从定义到最终替换，经历以下 4 个阶段：

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. 编辑    │ ─▶ │  2. 保存    │ ─▶ │  3. 渲染    │ ─▶ │  4. 发送    │
│  (前端)     │    │  (数据库)   │    │  (后端)     │    │  (AI)       │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 阶段 1：编辑（前端）

用户在 **PromptEditor** 编辑器中编写模板。编辑器基于 Lexical 富文本框架。

**用户看到的界面：**

```
你是一个助手，当前时间 [now] ，用户问题：[input]
                        ↑              ↑
                    变量芯片        变量芯片
```

变量在编辑器中显示为可点击的「芯片」（Chip），而不是原始的 `{{#now#}}` 文本。

**如何插入变量：**

1. 在编辑器中输入 `{{`
2. 弹出变量选择菜单
3. 点击想要的变量即可插入

**相关文件：**

- `src/renderer/components/business/chat-input/tool-bar/chat-parameters/prompt-editor/`
    - `index.tsx` - 主编辑器组件
    - `nodes/variable-value-node.tsx` - 变量节点定义
    - `plugins/variable-plugin.tsx` - 变量输入触发逻辑

### 阶段 2：保存（数据库）

当用户保存模板时，编辑器内容被转换为纯文本格式存储。

**编辑器内部结构：**

```
ParagraphNode
  ├── CustomTextNode: "你是一个助手，当前时间 "
  ├── VariableValueNode: { variable: "now" }
  ├── CustomTextNode: " ，用户问题："
  └── VariableValueNode: { variable: "input" }
```

**保存到数据库的内容：**

```
你是一个助手，当前时间 {{#now#}} ，用户问题：{{#input#}}
```

**存储位置：**

- 表：`thread_forms`
- 字段：`chatParameters.systemPrompt` 或 `chatParameters.userPromptTemplate`

### 阶段 3：渲染（后端）

当用户发送消息时，后端会将模板中的变量替换为实际值。

**渲染过程：**

```typescript
// 1. 获取模板
const template = "你是助手，时间 {{#now#}}，问题：{{#input#}}";

// 2. 提取变量列表
const variables = ["now", "input"];

// 3. 依次替换每个变量
let result = template;
// {{#now#}} → "2025-12-12 14:30:45"
// {{#input#}} → "用户实际输入的内容"

// 4. 最终结果
result = "你是助手，时间 2025-12-12 14:30:45，问题：用户实际输入的内容";
```

**核心渲染文件：**

- `src/main/services/thread-forms-service.ts`
    - `renderTemplateByThreadId()` - 渲染用户提示词模板
    - `renderMessagesBySystemPrompt()` - 渲染系统提示词

### 阶段 4：发送（AI）

渲染后的内容发送给 AI 模型，同时保存渲染记录用于历史回溯。

**保存的渲染记录：**

```typescript
// messages 表中的字段
{
  content: "用户原始输入",
  userPromptTemplate: "问题：{{#input#}}",      // 使用的模板
  renderedContent: "问题：用户原始输入",         // 渲染后的内容
  variables: ["input"],                         // 使用的变量
  renderMap: '{"input": "用户原始输入"}'        // 变量→值的映射
}
```

---

## 核心代码结构

```
src/
├── shared/prompt-editor/
│   ├── constant.ts          # 变量定义和渲染器
│   └── utils.ts             # 工具函数（替换、匹配、验证）
│
├── renderer/components/business/chat-input/tool-bar/chat-parameters/
│   ├── prompt-editor/       # 前端编辑器组件
│   │   ├── index.tsx        # 主组件
│   │   ├── nodes/           # Lexical 节点
│   │   │   ├── custom-text-node.tsx
│   │   │   └── variable-value-node.tsx
│   │   └── plugins/         # Lexical 插件
│   │       └── variable-plugin.tsx
│   └── utils.ts             # 编辑器工具函数
│
└── main/services/
    ├── thread-forms-service.ts   # 模板渲染服务
    └── message-service.ts        # 消息服务（历史渲染）
```

---

## 变量类型：一次性 vs 动态

变量分为两种类型，它们在历史消息回溯时的行为不同：

### 一次性变量

**定义：** 首次发送时替换，之后始终使用当时的值。

**包含：** `input`、`date`、`time`、`datetime`、`model_id`

**行为示例：**

```
发送时间：2025-12-01 10:00:00
模板：今天是 {{#date#}}

首次发送 → "今天是 2025-12-01"
一周后查看历史 → "今天是 2025-12-01"  ← 保持原值
```

### 动态变量

**定义：** 每次使用时都重新计算当前值。

**包含：** `now`

**行为示例：**

```
发送时间：2025-12-01 10:00:00
模板：当前时间是 {{#now#}}

首次发送 → "当前时间是 2025-12-01 10:00:00"
一周后查看历史 → "当前时间是 2025-12-08 15:30:00"  ← 更新为当前时间
```

### 为什么这样设计？

| 变量          | 设计意图                                   |
| ------------- | ------------------------------------------ |
| `date`/`time` | 记录消息发送的时间点，历史查看时应保持原值 |
| `input`       | 用户的原始输入，永远不应改变               |
| `now`         | 用于「继续对话」场景，AI 需要知道当前时间  |

### 区分逻辑的代码位置

文件：`src/main/services/message-service.ts`

```typescript
// 只有包含 "now" 变量的消息才会重新渲染
if (!variables || !variables.has("now")) {
	return message; // 直接返回，不重新渲染
}
// 包含 now，重新渲染
const renderedContent = restoreRenderMap(renderMap);
```

文件：`src/shared/prompt-editor/utils.ts`

```typescript
export function restoreRenderMapByTemplate(template, renderMap) {
	Object.keys(renderMapJsonObj).forEach((key) => {
		if (key === "now") {
			// now 变量：重新计算当前时间
			const renderer = PRESET_VARIABLES_MAP.get("now")?.renderTemplate;
			template = renderer?.(template).replaced ?? "";
		} else {
			// 其他变量：使用保存的原值
			template = template.replace(key, renderMapJsonObj[key]);
		}
	});
	return template;
}
```

---

## 代码示例

### 示例 1：添加新变量

假设要添加一个 `{{#weekday#}}` 变量，显示当前星期几。

**步骤 1：定义变量**

文件：`src/shared/prompt-editor/constant.ts`

```typescript
// 添加到变量列表
export const PRESET_VARIABLES: UserPromptTemplateVariables[] = [
	"input",
	"date",
	"time",
	"datetime",
	"now",
	"model_id",
	"weekday", // 新增
];

// 添加渲染器
export const PRESET_VARIABLES_MAP = new Map([
	// ... 其他变量
	[
		"weekday",
		{
			renderTemplate: (template) => {
				const days = ["日", "一", "二", "三", "四", "五", "六"];
				const d = new Date();
				return replaceVar(template, "weekday", `星期${days[d.getDay()]}`);
			},
		},
	],
]);
```

**步骤 2：添加类型定义**

文件：`src/shared/triplit/types.ts`

```typescript
export type UserPromptTemplateVariables =
	| "input"
	| "date"
	| "time"
	| "datetime"
	| "now"
	| "model_id"
	| "weekday"; // 新增
```

### 示例 2：理解变量替换函数

文件：`src/shared/prompt-editor/utils.ts`

```typescript
/**
 * 替换模板中的变量
 * @param template - 包含变量的模板字符串
 * @param key - 变量名（不含 {{# #}}）
 * @param value - 替换后的值
 * @returns { replaced: 替换后的字符串, value: 替换的值 }
 */
export const replaceVar = (template: string, key: string, value: string) => {
	const replaced = template.replace(
		new RegExp(`\\{\\{#${key}#\\}\\}`, "g"), // 匹配 {{#key#}}
		value,
	);
	return { replaced, value };
};

// 使用示例
replaceVar("今天是 {{#date#}}", "date", "2025-12-12");
// 返回: { replaced: "今天是 2025-12-12", value: "2025-12-12" }
```

### 示例 3：验证模板是否有效

文件：`src/shared/prompt-editor/utils.ts`

```typescript
/**
 * 检查模板是否有效
 * 有效的模板必须包含 {{#input#}} 变量
 */
export function isValidVariablePrompt(value: string | null): boolean {
	if (!value) return true; // 空模板视为有效
	const VARIABLE_PATTERN = /\{\{#input#\}\}/;
	return VARIABLE_PATTERN.test(value);
}

// 使用示例
isValidVariablePrompt("问题：{{#input#}}"); // true
isValidVariablePrompt("只有日期：{{#date#}}"); // false（缺少 input）
```

---

## 常见问题

### Q1: 为什么 User Prompt Template 必须包含 `{{#input#}}`？

因为用户提示词模板的目的是包装用户输入。如果没有 `{{#input#}}`，用户输入的内容就会丢失。

验证逻辑在 `isValidVariablePrompt()` 函数中。

### Q2: System Prompt 可以使用哪些变量？

System Prompt 可以使用除 `input` 以外的所有变量：

- `date`、`time`、`datetime`、`now`、`model_id`

因为系统提示词不需要包含用户输入。

### Q3: 变量在编辑器中显示异常怎么办？

检查以下文件：

1. `variable-value-node.tsx` - 变量节点的渲染逻辑
2. `variable-chip.tsx` - 变量芯片的样式
3. `variable-plugin.tsx` - 变量输入触发逻辑

### Q4: 如何让新变量变成「动态变量」？

修改 `utils.ts` 中的 `restoreRenderMapByTemplate` 函数：

```typescript
if (key === "now" || key === "your_new_dynamic_var") {
	// 重新渲染
	const renderer = PRESET_VARIABLES_MAP.get(key)?.renderTemplate;
	template = renderer?.(template).replaced ?? "";
}
```

### Q5: renderMap 的作用是什么？

`renderMap` 记录了每个变量被替换成的值，用于：

1. 历史消息回溯时恢复原始值
2. 动态变量（now）的特殊处理
3. 调试和追踪变量替换过程

---

## 相关文件速查表

| 功能         | 文件路径                                                                              |
| ------------ | ------------------------------------------------------------------------------------- |
| 变量定义     | `src/shared/prompt-editor/constant.ts`                                                |
| 工具函数     | `src/shared/prompt-editor/utils.ts`                                                   |
| 前端编辑器   | `src/renderer/components/business/chat-input/tool-bar/chat-parameters/prompt-editor/` |
| 变量节点     | `.../prompt-editor/nodes/variable-value-node.tsx`                                     |
| 变量插件     | `.../prompt-editor/plugins/variable-plugin.tsx`                                       |
| 模板渲染服务 | `src/main/services/thread-forms-service.ts`                                           |
| 消息服务     | `src/main/services/message-service.ts`                                                |
| 类型定义     | `src/shared/triplit/types.ts`                                                         |

---

## 流程图总结

```
用户在编辑器输入 "{{"
        ↓
弹出变量选择菜单
        ↓
选择变量（如 now）
        ↓
插入 VariableValueNode 到编辑器
        ↓
用户保存模板
        ↓
VariableValueNode.getTextContent() 输出 "{{#now#}}"
        ↓
保存到数据库 thread_forms.chatParameters
        ↓
用户发送消息
        ↓
ThreadFormsService.renderTemplateByThreadId()
        ↓
matchedVariables() 提取变量列表 ["now", "input"]
        ↓
PRESET_VARIABLES_MAP.get("now").renderTemplate() 替换变量
        ↓
replaceVar(template, "now", "2025-12-12 14:30:45")
        ↓
渲染后的内容发送给 AI
        ↓
保存 renderMap 到 messages 表
```
