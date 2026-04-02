# 日志系统指南

本文档介绍 302 AI Studio 的日志系统架构与使用方式，帮助开发者快速上手。

## 快速开始

在任何文件中只需两行即可接入日志：

```typescript
import { createLogger } from "@shared/logger";
const logger = createLogger("services");

logger.info("用户数据已加载");
logger.error("请求失败:", error);
```

**无需关心当前运行在主进程还是渲染进程**，`createLogger()` 会自动检测并路由到正确的后端。

## 目录结构

```
logs/
├── main/                    # 主进程日志
│   ├── 2026-04-02/
│   │   ├── 00/              # 按小时分级
│   │   │   ├── main.log
│   │   │   ├── services.log
│   │   │   └── server.log
│   │   ├── 01/
│   │   │   └── ...
│   │   └── 23/
│   └── 2026-04-03/
└── renderer/                # 渲染进程日志
    ├── 2026-04-02/
    │   ├── 00/
    │   │   ├── ui.log
    │   │   ├── state.log
    │   │   ├── chat.log
    │   │   └── marketplace.log
    │   └── ...
    └── ...
```

- 路径规则：`{logsPath}/{processType}/{yyyy-MM-dd}/{HH}/{category}.log`
- 开发模式：日志写入 `{项目根目录}/logs/`
- 生产模式：日志写入 `{userData}/logs/`
- 超过 14 天的日志目录会在应用启动时自动清理，并每 24 小时定时清理

## Category 分类

`createLogger(category)` 的 `category` 参数是 TypeScript 类型约束的，不能随意传字符串。

### 主进程可用 Category

| Category           | 适用范围         | 示例文件                            |
| ------------------ | ---------------- | ----------------------------------- |
| `"main"`           | 入口             | `electron/main/index.ts`            |
| `"services"`       | 所有 IPC 服务    | `electron/main/services/*/index.ts` |
| `"server"`         | Hono 后端        | `electron/main/server/*.ts`         |
| `"apis"`           | HTTP 客户端      | `electron/main/apis/*.ts`           |
| `"factories"`      | WebContents 工厂 | `electron/main/factories/*.ts`      |
| `"utils"`          | 主进程工具函数   | `electron/main/utils/*.ts`          |
| `"plugin-manager"` | 插件系统         | `electron/main/plugin-manager/*.ts` |
| `"preload"`        | 预加载脚本       | `electron/preload/index.ts`         |

### 渲染进程可用 Category

| Category        | 适用范围                 | 示例文件                                     |
| --------------- | ------------------------ | -------------------------------------------- |
| `"ui"`          | 组件、工具函数、API 调用 | 60+ 文件                                     |
| `"state"`       | Svelte 5 状态管理        | `src/lib/stores/*.svelte.ts`                 |
| `"chat"`        | 聊天状态                 | `src/lib/stores/chat-state.svelte.ts`        |
| `"marketplace"` | 插件市场                 | `src/lib/stores/marketplace-state.svelte.ts` |
| `"provider"`    | 模型/供应商              | 预留                                         |
| `"theme"`       | 主题系统                 | 预留                                         |
| `"session"`     | 用户会话                 | 预留                                         |

## 日志级别

```typescript
logger.debug("调试信息"); // 仅开发环境
logger.info("常规信息"); // 开发 + 生产
logger.warn("警告"); // 仅开发环境（生产文件中过滤）
logger.error("错误:", err); // 开发 + 生产
logger.fatal("致命错误"); // 开发 + 生产（映射为 error）
```

### 各环境级别策略

| 环境 | Console                       | File                                  |
| ---- | ----------------------------- | ------------------------------------- |
| 开发 | `debug` 级别起，ANSI 彩色输出 | `debug` 级别起，不过滤                |
| 生产 | `info` 级别起                 | `info` 级别起，过滤 `debug` 和 `warn` |

## 架构

```
                    src/shared/logger/
                    ┌─────────────────┐
                    │  createLogger()  │  统一 API，业务代码只用这个
                    └────────┬────────┘
                             │ process.type === "browser" ?
                    ┌────────┴────────┐
              Yes   │                 │  No
         ┌─────────▼──┐       ┌──────▼──────────┐
         │ mainLogFn  │       │ rendererScopeFn │
         │ (DI 注入)  │       │  (DI 注入)      │
         └─────┬──────┘       └──────┬──────────┘
               │                     │
               ▼                     ▼
        LoggerService          electron-log/renderer
        .logMain()             .scope(category)
               │                     │ (通过 preload 桥接)
               ▼                     ▼
          electron-log ──────────► file + console
          scope("main/{category}")
```

### DI 注入点

**主进程**：`electron/main/services/index.ts`

```typescript
import { loggerService } from "./logger-service";
import { initMainProcessLogger } from "@shared/logger";

initMainProcessLogger((level, category, message, ...args) => {
	loggerService.logMain(level, category, message, ...args);
});
```

**渲染进程**：`src/routes/+layout.svelte`

```typescript
import { initRendererLogger } from "@shared/logger";
import log from "electron-log/renderer";

initRendererLogger((category) => log.scope(category));
```

### 关键文件

| 文件                                             | 职责                                                |
| ------------------------------------------------ | --------------------------------------------------- |
| `src/shared/logger/types.ts`                     | 类型定义：`LogLevel`、`LogCategory`、`Logger` 接口  |
| `src/shared/logger/index.ts`                     | `createLogger()` 工厂函数 + DI 注入函数             |
| `electron/main/services/logger-service/index.ts` | 主进程日志服务（electron-log 配置、文件路径、清理） |

## 新增 Category

如果需要新增一个日志分类（例如新增 `"network"`），在 `src/shared/logger/types.ts` 中扩展对应的联合类型：

```typescript
export type RendererProcessCategory =
	| "ui"
	| "chat"
	// ... 现有 categories
	| "network"; // 新增
```

TypeScript 会在所有 `createLogger("network")` 调用处自动校验。
