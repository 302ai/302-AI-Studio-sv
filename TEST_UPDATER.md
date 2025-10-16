# Electron Updater 测试指南

## 方法 1: 添加测试模式（推荐）

### 1.1 在 UpdaterService 添加测试方法

在 `electron/main/services/updater-service/index.ts` 添加以下测试方法：

```typescript
// 添加到 UpdaterService 类中
async simulateUpdateAvailable(_event: IpcMainInvokeEvent): Promise<void> {
  console.log("🧪 Simulating update available");
  broadcastService.broadcastChannelToAll("updater:update-available");
}

async simulateUpdateDownloaded(_event: IpcMainInvokeEvent): Promise<void> {
  console.log("🧪 Simulating update downloaded");
  this.updateDownloaded = true;
  broadcastService.broadcastChannelToAll("updater:update-downloaded", {
    releaseNotes: "Test release notes",
    releaseName: "v1.0.1-test",
  });
  await this.showUpdateDownloadedDialog();
}

async simulateUpdateError(_event: IpcMainInvokeEvent): Promise<void> {
  console.log("🧪 Simulating update error");
  broadcastService.broadcastChannelToAll("updater:update-error", {
    message: "Test error message",
  });
}
```

### 1.2 在开发者工具中测试

打开应用后，在浏览器开发者工具的 Console 中运行：

```javascript
// 模拟发现更新
await window.electronAPI.updaterService.simulateUpdateAvailable();

// 模拟更新下载完成（会弹出 dialog）
await window.electronAPI.updaterService.simulateUpdateDownloaded();

// 模拟更新错误
await window.electronAPI.updaterService.simulateUpdateError();

// 检查更新是否已下载
await window.electronAPI.updaterService.isUpdateDownloaded();
```

---

## 方法 2: 使用真实的 Update Server

### 2.1 前置条件

1. 应用必须**代码签名**（macOS 需要 Apple Developer 证书，Windows 需要代码签名证书）
2. 必须有一个**已发布的版本**在 GitHub Releases 中
3. 当前测试版本号必须**低于**已发布的版本

### 2.2 测试步骤

1. **修改当前版本号**（临时降低版本）

   ```bash
   # 在 package.json 中将 version 改为比 GitHub 最新版本低的版本
   # 例如，如果 GitHub 最新是 1.0.5，改为 1.0.4
   ```

2. **构建并打包应用**

   ```bash
   pnpm run build
   pnpm run package
   ```

3. **运行打包后的应用**
   - macOS: `/out/302-AI-Studio-darwin-arm64/302-AI-Studio.app`
   - Windows: `/out/302-AI-Studio-win32-x64/302-AI-Studio.exe`

4. **触发更新检查**
   - 打开应用设置 → 版本更新
   - 点击「检查更新」按钮
   - 观察控制台日志和 UI 变化

---

## 方法 3: 搭建本地 Update Server

### 3.1 使用 electron-release-server

可以在本地搭建一个模拟的更新服务器，参考：

- https://github.com/ArekSredzki/electron-release-server

### 3.2 使用简单的 HTTP 服务器

创建一个简单的更新清单文件并通过 HTTP 服务提供：

```json
// update-manifest.json
{
	"url": "https://example.com/download/app-1.0.1.zip",
	"name": "1.0.1",
	"notes": "测试更新内容",
	"pub_date": "2025-01-15T12:00:00Z"
}
```

然后修改 `updateFeedUrl` 指向本地服务器。

---

## 方法 4: 测试 UI 状态变化

即使不触发真实更新，也可以测试前端 UI：

### 4.1 直接修改前端状态

在 `version-update.svelte` 中临时添加测试按钮：

```svelte
<!-- 开发测试用 -->
{#if import.meta.env.DEV}
	<div class="flex gap-2 mt-4">
		<Button
			size="xs"
			onclick={() => {
				checking = true;
			}}
		>
			Test Checking
		</Button>
		<Button
			size="xs"
			onclick={() => {
				downloading = true;
			}}
		>
			Test Downloading
		</Button>
		<Button
			size="xs"
			onclick={() => {
				updateDownloaded = true;
			}}
		>
			Test Downloaded
		</Button>
	</div>
{/if}
```

---

## 推荐的测试流程

### 阶段 1: UI 测试（最快）

1. 使用方法 4 测试按钮状态变化
2. 验证文案是否正确显示（中英文）
3. 验证按钮禁用/启用逻辑

### 阶段 2: 功能测试（中等）

1. 使用方法 1 添加模拟方法
2. 在开发者工具测试各种场景
3. 验证 dialog 弹出和交互

### 阶段 3: 集成测试（最完整）

1. 降低 package.json 版本号
2. 构建打包应用
3. 运行打包后的应用测试真实更新流程

---

## 常见问题

### Q: 为什么 dev 模式下不能测试？

A: 因为 Electron 的 `autoUpdater` 只在打包后的应用中工作，dev 模式下不支持。

### Q: 如何查看更新日志？

A: 在终端运行应用时会看到 console.log 输出，或者打开开发者工具查看。

### Q: macOS 提示 "代码签名无效"？

A: 需要使用 Apple Developer 证书对应用进行代码签名。

### Q: 更新服务器 URL 是什么？

A: 当前配置：`https://update.electronjs.org/302ai/302-AI-Studio-sv/${platform}-${arch}/${version}`

---

## 调试技巧

### 查看更新请求

在浏览器开发者工具 Network 标签中，可以看到更新检查的 HTTP 请求。

### 查看控制台日志

所有更新事件都有 console.log，包括：

- "Checking for updates..."
- "Update available"
- "Update not available"
- "Update downloaded"
- "Update error: ..."

### 手动触发事件

在 main process 中可以手动触发 autoUpdater 事件进行测试。
