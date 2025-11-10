# Beta 版本发布指南

本文档说明如何使用新的 beta 和稳定版本分发系统。

## 概述

应用现在支持两个更新渠道：

- **稳定版 (Stable)**: 正式发布的稳定版本
- **测试版 (Beta)**: 预发布的测试版本，用于早期测试和反馈

## 用户功能

### 切换更新渠道

用户可以在设置中切换更新渠道：

1. 打开应用设置
2. 导航到"通用设置" > "版本更新"
3. 在"更新渠道"下拉菜单中选择：
   - **稳定版**: 仅接收稳定版本更新
   - **测试版**: 接收 beta 预发布版本更新
4. 切换渠道后，如果启用了自动更新，应用会立即检查新渠道的更新

## 发布流程

### 发布稳定版

1. 更新 `package.json` 中的版本号（例如：`25.45.5`）
2. 创建并推送稳定版本标签：
   ```bash
   git tag v25.45.5
   git push origin v25.45.5
   ```
3. GitHub Actions 会自动构建并发布到 `stable` 渠道

### 发布 Beta 版

1. 更新 `package.json` 中的版本号，添加 `-beta` 后缀（例如：`25.46.0-beta`）
2. 创建并推送 beta 版本标签：
   ```bash
   git tag v25.46.0-beta
   git push origin v25.46.0-beta
   ```
   或者使用带构建号的标签：
   ```bash
   git tag v25.46.0-beta.1
   git push origin v25.46.0-beta.1
   ```
3. GitHub Actions 会自动构建并发布到 `beta` 渠道，标记为预发布版本

## 版本号规范

### 稳定版本号格式

- `v25.45.5` - 主版本.次版本.修订版本
- 不包含任何后缀

### Beta 版本号格式

- `v25.46.0-beta` - 基础 beta 版本
- `v25.46.0-beta.1` - 带构建号的 beta 版本
- `v25.46.0-beta.2` - 后续 beta 构建

## 更新机制

### 更新 URL 构建

应用会根据用户选择的渠道和当前版本自动构建更新 URL：

- **稳定版用户**:

  ```
  https://update.electronjs.org/302ai/302-AI-Studio-sv/{platform}-{arch}/25.45.5
  ```

- **Beta 版用户**:
  ```
  https://update.electronjs.org/302ai/302-AI-Studio-sv/{platform}-{arch}/25.46.0-beta
  ```

### 渠道切换行为

- 当用户从稳定版切换到测试版时，应用会立即检查是否有新的 beta 版本
- 当用户从测试版切换到稳定版时，应用会检查最新的稳定版本
- 如果启用了自动更新，渠道切换后会自动触发更新检查（延迟 500ms）

## GitHub Actions 工作流

### 触发条件

`release.yml` 工作流会在以下标签推送时触发：

- `v*.*.*` - 稳定版本
- `v*.*.*-beta` - Beta 版本
- `v*.*.*-beta.*` - 带构建号的 Beta 版本

### 发布配置

- **稳定版**: 创建预发布状态的 GitHub Release，标题为版本号
- **Beta 版**: 创建预发布状态的 GitHub Release，标题包含 "(Beta)" 标记

## 本地测试

### 测试 Beta 版本构建

1. 更新 `package.json` 版本号为 beta 版本：

   ```json
   {
   	"version": "25.46.0-beta"
   }
   ```

2. 构建应用：

   ```bash
   pnpm run build
   pnpm run make
   ```

3. 检查构建产物：
   - macOS: `out/make/*.dmg`
   - Windows: `out/make/squirrel.windows/**/*`
   - Linux: `out/make/deb/**/*`, `out/make/rpm/**/*`

### 测试更新渠道切换

1. 启动应用
2. 打开设置 > 通用设置 > 版本更新
3. 切换更新渠道并观察控制台日志
4. 日志应显示：`Update feed URL set to: ... (channel: beta)` 或 `(channel: stable)`

## 注意事项

1. **版本号一致性**: 确保 `package.json` 中的版本号与 git 标签一致
2. **Beta 后缀**: Beta 版本必须在 `package.json` 和 git 标签中都包含 `-beta` 后缀
3. **向下兼容**: 用户可以随时从 beta 渠道切换回 stable 渠道
4. **预发布标记**: 所有版本（包括稳定版）在 GitHub Release 中都标记为 prerelease
5. **自动更新**: 默认情况下，新用户使用稳定版渠道

## 示例发布时间线

```
v25.45.5 (stable) ─┐
                   │
                   ├─→ v25.46.0-beta    (开发测试)
                   │   v25.46.0-beta.1  (修复 bug)
                   │   v25.46.0-beta.2  (最终测试)
                   │
                   └─→ v25.46.0 (stable) (正式发布)
```

## 故障排查

### 更新检查失败

- 检查更新 URL 是否正确构建
- 查看控制台日志中的错误信息
- 确认 GitHub Release 已成功创建

### 渠道切换不生效

- 确认已调用 `setUpdateChannel` IPC 方法
- 检查存储中的 `updateChannel` 值
- 重启应用以确保配置生效

### Beta 版本未显示

- 确认已切换到 beta 渠道
- 检查 GitHub Release 是否包含 beta 标签
- 验证版本号格式正确（包含 `-beta` 后缀）
