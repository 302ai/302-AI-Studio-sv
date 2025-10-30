<h1 align="center">
<img src='./docs/imgs/icon.svg' width='30'>
<span>
    302 AI Studio
</span>
</h1>

<p align="center">
<em>302 AI Studio 是一款支持多种大模型（LLM）服务商的桌面客户端，适用于 Windows、Mac 和 Linux。</em>
</p>

<p align="center"><a href="https://302.ai/" target="blank"><img src="https://file.302.ai/gpt/imgs/github/20250102/72a57c4263944b73bf521830878ae39a.png" /></a></p >

<p align="center"><a href="README_zh.md">中文</a> | <a href="README.md">English</a> | <a href="README_ja.md">日本語</a></p>

![](docs/imgs/桌面客户端-cn.png) 

## 🖼️ 界面截图

主页聊天欢迎界面，提供消息输入框、工具栏、模型选择与常用AI工具快捷入口           
<img src="./docs/imgs/302_AI_Studio_screenshot_01.png" >                   
 
多标签聊天界面，左侧会话列表，右侧聊天界面
<img src="./docs/imgs/302_AI_Studio_screenshot_02.png" >              

在客户端内可一键快速打开AI应用，无需跳转至官网
<img src="./docs/imgs/302_AI_Studio_screenshot_03.png" >          

独立窗口形式的设置页面，包含通用与、偏好、MCP等常用配置
<img src="./docs/imgs/302_AI_Studio_screenshot_04.png" >
<img src="./docs/imgs/302_AI_Studio_screenshot_05.png" >

## 🌟 主要特点

### 多模型与多服务商支持
- 🤖 支持 OpenAI、Anthropic、Google 等多主流 AI 提供商
- 🔄 灵活的模型切换与配置
- 🎛️ 高级对话参数控制（温度、top-p、token 限制等）
- 📊 MCP（Model Context Protocol）服务器集成

### 文档与数据处理
- 🖼️ 上传图片让 AI 帮你分析内容、生成描述
- 📄 支持多种文件格式处理
- 💻 代码高亮显示
- 📊 Mermaid 图表可视化
- 📝 完整的 Markdown 渲染支持

### 优质使用体验
- 🖥️ Windows、Mac、Linux 多平台支持
- 🌙 可自定义的明暗主题系统，实时预览
- 📝 完整的 Markdown 渲染
- 📱 响应式设计，完美适配各种屏幕尺寸
- 🎨 基于 Shadcn-Svelte 的现代化组件库

### 高效工作流
- 🗂️ 同时进行多个对话线程，思路清晰不混乱
- ⚡ 支持实时流式响应
- ⌨️ 完整的快捷键系统
- 🔄 热更新（HMR）支持，开发体验流畅

### 多语言支持
- **中文**
- **English**
- **日本語**

## 🛠️ 技术架构

### 🏗️ 核心技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **界面层** | SvelteKit 5 + TypeScript | 现代组件开发，类型安全，响应式状态管理 |
| **样式层** | TailwindCSS 4.x + 自定义主题系统 | 原子化 CSS + 流畅动画 |
| **桌面端** | Electron 38 | 跨平台桌面应用框架 |
| **状态管理** | Svelte 5 Runes | 响应式状态管理（`$state`, `$derived`） |
| **UI 组件库** | Shadcn-Svelte (bits-ui) | 现代化、可访问的组件库 |
| **国际化** | Inlang Paraglide-js | 多语言支持 |
| **AI 集成** | AI SDK | 统一的 AI 提供商接口 |
| **构建工具** | Vite + Electron Forge | 快速构建 + 热重载 |
| **类型系统** | TypeScript | 严格的类型检查 |
| **代码质量** | ESLint + Prettier + Vitest + Playwright | 代码规范 + 单元测试 + E2E 测试 |

## 🚀 快速开始

### 📋 系统要求

- **操作系统**: Windows 10+ / macOS 10.14+ / Linux (Ubuntu 18.04+)
- **Node.js**: 18.x 或更高版本
- **包管理器**: pnpm 10.18.3+（必需）
- **内存**: 4GB RAM（推荐 8GB+）
- **存储**: 500MB 可用空间
- **网络**: 稳定的互联网连接（访问 AI 服务商 API）

### ⚡ 安装与启动

```bash
# 1️⃣ 克隆项目
git clone https://github.com/302ai/302-AI-Studio-sv.git
cd 302-AI-Studio-sv

# 2️⃣ 安装依赖
pnpm install

# 3️⃣ 启动开发服务器 🎉
pnpm dev
```

> [!WARNING]
> 此项目必须使用 `pnpm` 作为包管理器。项目包含对 SvelteKit 的必要补丁，其他包管理器可能无法正常工作。

## 📦 构建与部署

### 🔧 开发命令

```bash
# 启动开发服务器（支持热重载）
pnpm dev

# 类型检查
pnpm check

# 代码规范检查
pnpm lint

# 自动修复代码问题
pnpm lint:fix

# 格式化代码
pnpm format

# 检查代码格式
pnpm format:check

# 完整质量检查
pnpm quality

# 自动修复所有问题
pnpm quality:fix
```

### 🧪 测试

```bash
# 运行单元测试
pnpm test:unit

# 运行 E2E 测试
pnpm test:e2e

# 运行所有测试
pnpm test
```

### 🚀 生产构建

```bash
# 构建 SvelteKit 应用
pnpm build

# 打包 Electron 应用（输出在 /out 目录）
pnpm package

# 创建可分发安装包
pnpm make

# 发布到配置的目标
pnpm publish
```

### 📱 跨平台支持

| 平台 | 架构 | 状态 |
|------|------|------|
| Windows | x64 / ARM64 | ✅ 完全支持 |
| macOS | x64 / Apple Silicon | ✅ 完全支持 |
| Linux | x64 / ARM64 | ✅ 完全支持 |

## 🛠️ 开发指南

### 📁 项目结构

```
📦 302-AI-Studio-sv
├── 📂 src/                          # 渲染进程源代码
│   ├── 📂 lib/                       # 共享库
│   │   ├── 📂 components/            # UI 组件
│   │   │   ├── ui/                   # Shadcn-Svelte 基础组件（40+）
│   │   │   └── buss/                 # 业务组件
│   │   │       ├── chat/             # 聊天界面
│   │   │       ├── model-*/          # 模型选择与配置
│   │   │       ├── provider-*/       # AI 提供商管理
│   │   │       ├── theme-*/          # 主题系统
│   │   │       └── settings/         # 应用设置
│   │   ├── 📂 stores/                # 状态管理（Svelte 5 Runes）
│   │   ├── 📂 types/                 # TypeScript 类型定义
│   │   ├── 📂 api/                   # API 集成层
│   │   ├── 📂 utils/                 # 工具函数
│   │   ├── 📂 theme/                 # 主题系统
│   │   ├── 📂 datas/                 # 静态数据
│   │   └── 📂 hooks/                 # Svelte Hooks
│   ├── 📂 routes/                    # 路由
│   │   ├── (with-sidebar)/           # 主应用布局
│   │   │   └── chat/                 # 聊天界面路由
│   │   ├── (settings-page)/          # 设置页面布局
│   │   │   └── settings/             # 设置路由组
│   │   └── shell/                     # Shell 窗口路由
│   ├── 📂 shared/                    # 跨进程共享代码
│   │   ├── storage/                  # 持久化存储
│   │   └── types/                    # 共享类型
│   ├── 📂 messages/                  # 国际化消息文件
│   └── 📄 app.html                   # HTML 模板
├── 📂 electron/                      # Electron 主进程
│   ├── main/                         # 主进程代码
│   │   ├── services/                 # IPC 服务
│   │   ├── generated/                # 自动生成的 IPC 绑定
│   │   └── constants/                # Electron 常量
│   └── preload/                      # Preload 脚本
├── 📂 vite-plugins/                  # 自定义 Vite 插件
│   └── ipc-service-generator/        # IPC 服务生成器
├── 📂 scripts/                       # 构建脚本
├── 📂 docs/                          # 文档
├── 📂 e2e/                           # Playwright E2E 测试
└── 📄 package.json                   # 项目配置
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！无论是报告 bug、提出新功能建议，还是提交代码改进。

### 💡 贡献方式

1. **代码贡献**：提交 PR 来改进代码
2. **修复 Bug**：提交你发现的问题修复
3. **功能建议**：有好想法？我们很乐意听取你的建议
4. **编写文档**：帮助我们完善文档和使用指南
5. **推广应用**：宣传 302 AI Studio

### 📋 贡献步骤

```bash
# 1. Fork 项目
# 2. 创建功能分支
git checkout -b feature/amazing-feature

# 3. 提交更改（遵循 Conventional Commits）
git commit -m 'feat: add amazing feature'

# 4. 推送到分支
git push origin feature/amazing-feature

# 5. 创建 Pull Request
```


## 💬 联系我们

<div align="center">

[![官网](https://img.shields.io/badge/官网-302.ai-blue.svg)](https://302.ai)
[![GitHub](https://img.shields.io/badge/GitHub-302--AI--Studio-black.svg)](https://github.com/302ai/302-AI-Studio-sv)
[![邮件](https://img.shields.io/badge/邮件-support@302.ai-red.svg)](mailto:support@302.ai)

**遇到问题？** 请在 [GitHub Issues](https://github.com/302ai/302-AI-Studio-sv/issues) 中反馈

**功能建议？** 我们在 [GitHub Discussions](https://github.com/302ai/302-AI-Studio-sv/discussions) 等你

</div>

## 📄 许可证

本项目基于 [AGPL-3.0](LICENSE) 开源，你可以自由使用、修改和分发。

## ✨ 302.AI 介绍

[302.AI](https://302.ai) 是一个按需付费的 AI 应用平台，为用户解决 AI 用于实践的最后一公里问题。

1. 🧠 集合了最新最全的 AI 能力和品牌，包括但不限于语言模型、图像模型、声音模型、视频模型
2. 🚀 在基础模型上进行深度应用开发，我们开发真正的 AI 产品，而不是简单的对话机器人
3. 💰 零月费，所有功能按需付费，全面开放，做到真正的门槛低，上限高
4. 🛠️ 功能强大的管理后台，面向团队和中小企业，一人管理，多人使用
5. 🔗 所有 AI 能力均提供 API 接入，所有工具开源可自行定制（进行中）
6. 💡 强大的开发团队，每周推出 2-3 个新应用，产品每日更新。有兴趣加入的开发者也欢迎联系我们

