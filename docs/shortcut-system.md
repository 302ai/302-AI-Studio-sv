# 快捷键系统设计文档

## 概述

这是一个为多窗口 + 多 WebContentsView 的 Electron 应用设计的完善快捷键系统。

## 架构

### 分层设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Global Shortcuts (OS)                     │
│                   (Electron globalShortcut)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│              Main Process - ShortcutEngine                   │
│  - 集中管理所有快捷键配置                                       │
│  - 冲突检测和优先级处理                                         │
│  - before-input-event 统一拦截                                │
│  - 动作分发到 TabService/WindowService                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
│  BrowserWindow │  │BrowserWindow│  │BrowserWindow│
│   (Window 1)   │  │  (Window 2) │  │  (Window 3) │
│                │  │             │  │             │
│ ┌────────────┐ │  │┌───────────┐│  │┌───────────┐│
│ │ ShellView  │ │  ││ ShellView ││  ││ ShellView ││
│ └────────────┘ │  │└───────────┘│  │└───────────┘│
│ ┌────────────┐ │  │┌───────────┐│  │┌───────────┐│
│ │  Tab View  │ │  ││ Tab View  ││  ││ Tab View  ││
│ │(KeyManager)│ │  ││(KeyManager││  ││(KeyManager││
│ └────────────┘ │  │└───────────┘│  │└───────────┘│
└────────────────┘  └─────────────┘  └─────────────┘
```

### 作用域层次

1. **global**: 全局快捷键（应用未激活时也生效）
   - 使用 `globalShortcut.register()`
   - 示例：全局截图、唤醒应用

2. **app**: 应用级快捷键（所有窗口共享）
   - 在 `before-input-event` 中匹配
   - 示例：打开设置、新建窗口

3. **window**: 窗口级快捷键（特定窗口）
   - 基于 `windowId` 匹配
   - 示例：窗口内的工具栏切换

4. **webview**: WebContentsView 级快捷键
   - 基于 `viewId/tabId` 匹配
   - 示例：特定 tab 内的操作

### 优先级机制

```
WebContentsView (highest)
      ↓ (if not matched)
    Window
      ↓ (if not matched)
     App
      ↓ (if not matched)
   Global (lowest)
```

一旦匹配，则 `event.preventDefault()` 并执行，不再向下传递。

### 输入态处理

快捷键可以标记 `requiresNonEditable: boolean`:

- `true`: 在 input/textarea/contenteditable 中不触发
- `false`: 无论是否在输入态都触发

渲染进程 KeyManager 检测焦点元素类型，上报给主进程。

## 实现细节

### 主进程 - ShortcutEngine

**核心职责**：

1. 维护快捷键配置索引
2. 检测冲突
3. 注册全局快捷键
4. 拦截 `before-input-event`
5. 匹配并分发动作

**关键方法**：

- `init(shortcuts, handler)`: 初始化
- `updateShortcuts(shortcuts)`: 动态更新配置
- `attachToView(view, windowId, viewId)`: 附加到 WebContentsView
- `handleBeforeInput()`: 处理键盘输入

### 渲染进程 - KeyManager

**核心职责**：

1. 监听 DOM `keydown` 事件
2. 判断是否在输入态
3. 对 webview scope 的快捷键消费事件
4. 通知主进程按键事件

**关键方法**：

- `handleKeyDown()`: 处理按键
- `handleShortcutSync()`: 同步配置
- `isEditableTarget()`: 判断输入态

### ShortcutActionsHandler

**核心职责**：
执行快捷键对应的动作

**动作类型**：

- **Tab 操作**: newTab, closeCurrentTab, nextTab, previousTab, switchToTab1-9
- **Window 操作**: openSettings, toggleSidebar, toggleModelPanel
- **Chat 操作**: newChat, clearMessages, stopGeneration, regenerateResponse

## 数据流

### 1. 初始化流程

```
1. 应用启动
   ↓
2. ShortcutEngine.init() (主进程)
   ↓
3. 从 shortcutSettings store 加载配置
   ↓
4. 注册 global shortcuts
   ↓
5. 为每个 WebContentsView 附加 before-input-event 处理器
   ↓
6. KeyManager 初始化 (每个渲染进程)
```

### 2. 按键处理流程

```
用户按键
   ↓
渲染进程 KeyManager.handleKeyDown()
   │
   ├─→ 是否输入态？ → 是 → 是否 requiresNonEditable？ → 是 → 忽略
   │                                                    ↓ 否
   │                                                  继续
   ↓
主进程 before-input-event
   ↓
ShortcutEngine.handleBeforeInput()
   │
   ├─→ 匹配 webview scope？ → 是 → preventDefault + dispatch
   ├─→ 匹配 window scope？  → 是 → preventDefault + dispatch
   ├─→ 匹配 app scope？     → 是 → preventDefault + dispatch
   └─→ 否 → 放行

   ↓ (if matched)
ShortcutActionsHandler.handle(action, ctx)
   │
   ├─→ Tab 操作   → TabService
   ├─→ Window 操作 → WindowService
   └─→ Chat 操作   → 发送到 renderer
```

### 3. 配置更新流程

```
用户在 UI 修改快捷键
   ↓
shortcutSettings.updateShortcut()
   ↓
PersistedState 持久化并广播
   ↓
所有窗口接收 sync 事件
   ↓
主进程 ShortcutEngine.updateShortcuts()
   │
   ├─→ 重建索引
   ├─→ 检测冲突
   ├─→ 重新注册 globalShortcuts
   └─→ 广播到所有渲染进程
       ↓
   KeyManager.handleShortcutSync()
```

## 冲突检测

### 同作用域冲突

同一 scope 内，同一键绑定多个 action：

- 检测：在 `detectConflicts()` 中按 key 分组
- 处理：按 `order` 字段优先级排序，取优先级最高的
- 提示：在 UI 中标记冲突项

### 跨作用域冲突

不同 scope 内，同一键绑定不同 action：

- 行为：由优先级自然处理（webview > window > app > global）
- 提示：可选地在 UI 提示"此键在其他作用域有绑定"

### 全局注册失败

`globalShortcut.register()` 返回 false：

- 原因：OS 保留或被其他应用占用
- 处理：标记失败，可选降级为 app scope
- 提示：通知用户修改快捷键

## 平台差异

### 修饰键映射

- **macOS**: Cmd (Command)
- **Windows/Linux**: Ctrl (Control)

配置中统一使用 `"Cmd"`，在解析时根据平台转换：

- `keysToAccelerator()`: Cmd → CommandOrControl
- `normalizeKeys()`: meta → Cmd (macOS) or Meta (others)

### 特殊快捷键

- **Cmd+Tab** (macOS): 系统保留，无法拦截
  - 替代方案：Ctrl+Tab, Cmd+Option+Left/Right
- **Cmd+Q** (macOS): 系统保留
  - 通过 `app.on('before-quit')` 特殊处理

## 使用示例

### 1. 初始化 ShortcutEngine

```typescript
// electron/main/index.ts
import { shortcutEngine, shortcutActionsHandler } from "./services/shortcut-service";
import { shortcutSettings } from "$lib/stores/shortcut-settings.state.svelte";

// 在 app.on('ready') 中初始化
const shortcuts = await getShortcutsFromStore(); // 从持久化 store 加载
shortcutEngine.init(shortcuts, (action, ctx) => {
	shortcutActionsHandler.handle(action, ctx);
});
```

### 2. 附加到 WebContentsView

```typescript
// electron/main/services/tab-service/index.ts
import { shortcutEngine } from "../shortcut-service";

private async newWebContentsView(windowId: number, tab: Tab): Promise<WebContentsView> {
  const view = WebContentsFactory.createTabView({ ... });

  // 附加快捷键处理
  shortcutEngine.attachToView(view, windowId, tab.id);

  return view;
}
```

### 3. 在渲染进程初始化 KeyManager

```typescript
// src/lib/utils/key-manager.ts (自动初始化)
// 或在 +layout.svelte 中手动导入
import "$lib/utils/key-manager";
```

### 4. 监听快捷键动作

```svelte
<!-- src/routes/(with-sidebar)/chat/+page.svelte -->
<script lang="ts">
	import { onMount } from "svelte";

	onMount(() => {
		window.electronAPI?.onShortcutAction?.((event) => {
			if (event.action === "clearMessages") {
				// 清空消息
			}
			if (event.action === "stopGeneration") {
				// 停止生成
			}
		});
	});
</script>
```

## API 参考

### 类型定义

```typescript
// shared/types/shortcut.ts
export type ShortcutScope = "global" | "app" | "window" | "webview";

export interface ShortcutBinding {
	id: string;
	action: string;
	keys: string[];
	scope: ShortcutScope;
	order: number;
	requiresNonEditable?: boolean;
}

export interface ShortcutContext {
	windowId: number;
	viewId?: string;
	tabId?: string;
}
```

### 工具函数

```typescript
// shared/utils/shortcut-utils.ts
export function normalizeKeys(input: InputEventLike): string[];
export function keysToString(keys: string[]): string;
export function stringToKeys(str: string): string[];
export function keysToAccelerator(keys: string[]): string;
export function keysEqual(keys1: string[], keys2: string[]): boolean;
export function formatKeys(keys: string[]): string;
```

## 注意事项

1. **不要在渲染进程直接注册全局快捷键**
   - 使用 IPC 通知主进程

2. **确保 windowId 和 viewId 正确**
   - 在 preload 中注入
   - 在创建 view 时正确传递

3. **处理平台差异**
   - 使用 `normalizeKeys` 统一格式
   - 使用 `PLATFORM_KEY_MAP` 显示

4. **输入态判断要准确**
   - 包括 contenteditable
   - 包括自定义输入组件

5. **冲突要及时提示**
   - 在 UI 中显示冲突
   - 提供解决建议

## 扩展点

### 1. 添加新动作

```typescript
// electron/main/services/shortcut-service/actions-handler.ts
async handle(action: string, ctx: ShortcutContext): Promise<void> {
  switch (action) {
    case "myNewAction":
      await this.handleMyNewAction(ctx);
      break;
  }
}

private async handleMyNewAction(ctx: ShortcutContext): Promise<void> {
  // 实现逻辑
}
```

### 2. 添加新作用域

修改 `ShortcutScope` 类型并更新匹配逻辑。

### 3. 自定义冲突检测

在 `ShortcutEngine.detectConflicts()` 中实现自定义规则。

## 测试建议

1. **单元测试**
   - `normalizeKeys()` 不同输入
   - `detectConflicts()` 各种冲突场景

2. **集成测试**
   - 多窗口快捷键隔离
   - 动态更新配置
   - 输入态判断

3. **手动测试**
   - 各平台快捷键是否正常
   - 冲突提示是否准确
   - 边界情况（全屏、多显示器等）

## 已知限制

1. macOS Cmd+Tab 无法拦截（系统保留）
2. 某些全局快捷键可能被 OS 或其他应用占用
3. before-input-event 无法获取 DOM target（需渲染进程协助）

## 版本历史

- v1.0.0: 初始实现，支持四层作用域和优先级
