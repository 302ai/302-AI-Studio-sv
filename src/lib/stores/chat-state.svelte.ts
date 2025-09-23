import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { AttachmentFile, MCPServer, messageStatus } from "$lib/types/chat";
import type { Model } from "$lib/types/model";
import { nanoid } from "nanoid";
import { providerState } from "./provider-state.svelte";

export type { AttachmentFile, MCPServer } from "$lib/types/chat";
export type { Model } from "$lib/types/model";

export interface Thread {
	id: string;
}

// Updated ChatMessage interface using the standardized Model type
export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	status: messageStatus;
	model: Model;
	attachments?: AttachmentFile[];
	createAt: Date;
}

// Chat parameters interface
interface ChatParams {
	temperature: number | null;
	topP: number | null;
	frequencyPenalty: number | null;
	presencePenalty: number | null;
	maxTokens: number | null;
}

// UI state interface
interface ChatUIState {
	inputValue: string;
	attachments: AttachmentFile[];
	mcpServers: MCPServer[];
	isThinkingActive: boolean;
	isOnlineSearchActive: boolean;
	isMCPActive: boolean;
	selectedModel: Model | null;
	isPrivateChatActive: boolean;
}

export const persistedMessagesState = new PersistedState<ChatMessage[]>(
	"app-chat-messages" + window.tab.threadId,
	[],
);
export const persistedChatParamsState = new PersistedState<ChatParams>("app-chat-params", {
	temperature: null,
	topP: null,
	frequencyPenalty: null,
	presencePenalty: null,
	maxTokens: null,
});
export const persistedChatUIState = new PersistedState<ChatUIState>("app-chat-ui", {
	inputValue: "",
	attachments: [],
	mcpServers: [],
	isThinkingActive: false,
	isOnlineSearchActive: false,
	isMCPActive: false,
	selectedModel: null,
	isPrivateChatActive: false,
});

class ChatState {
	// Computed properties accessing persistent state
	get inputValue(): string {
		return persistedChatUIState.current.inputValue;
	}
	set inputValue(value: string) {
		persistedChatUIState.current.inputValue = value;
	}

	get attachments(): AttachmentFile[] {
		return persistedChatUIState.current.attachments;
	}
	set attachments(value: AttachmentFile[]) {
		persistedChatUIState.current.attachments = value;
	}

	get messages(): ChatMessage[] {
		return persistedMessagesState.current;
	}
	set messages(value: ChatMessage[]) {
		persistedMessagesState.current = value;
	}

	get mcpServers(): MCPServer[] {
		return persistedChatUIState.current.mcpServers;
	}
	set mcpServers(value: MCPServer[]) {
		persistedChatUIState.current.mcpServers = value;
	}

	get isThinkingActive(): boolean {
		return persistedChatUIState.current.isThinkingActive;
	}
	set isThinkingActive(value: boolean) {
		persistedChatUIState.current.isThinkingActive = value;
	}

	get isOnlineSearchActive(): boolean {
		return persistedChatUIState.current.isOnlineSearchActive;
	}
	set isOnlineSearchActive(value: boolean) {
		persistedChatUIState.current.isOnlineSearchActive = value;
	}

	get isMCPActive(): boolean {
		return persistedChatUIState.current.isMCPActive;
	}
	set isMCPActive(value: boolean) {
		persistedChatUIState.current.isMCPActive = value;
	}

	get selectedModel(): Model | null {
		return persistedChatUIState.current.selectedModel;
	}
	set selectedModel(value: Model | null) {
		persistedChatUIState.current.selectedModel = value;
	}

	get isPrivateChatActive(): boolean {
		return persistedChatUIState.current.isPrivateChatActive;
	}
	set isPrivateChatActive(value: boolean) {
		persistedChatUIState.current.isPrivateChatActive = value;
	}

	// Chat Parameters
	get temperature(): number | null {
		return persistedChatParamsState.current.temperature;
	}
	set temperature(value: number | null) {
		persistedChatParamsState.current.temperature = value;
	}

	get topP(): number | null {
		return persistedChatParamsState.current.topP;
	}
	set topP(value: number | null) {
		persistedChatParamsState.current.topP = value;
	}

	get frequencyPenalty(): number | null {
		return persistedChatParamsState.current.frequencyPenalty;
	}
	set frequencyPenalty(value: number | null) {
		persistedChatParamsState.current.frequencyPenalty = value;
	}

	get presencePenalty(): number | null {
		return persistedChatParamsState.current.presencePenalty;
	}
	set presencePenalty(value: number | null) {
		persistedChatParamsState.current.presencePenalty = value;
	}

	get maxTokens(): number | null {
		return persistedChatParamsState.current.maxTokens;
	}
	set maxTokens(value: number | null) {
		persistedChatParamsState.current.maxTokens = value;
	}

	// Get provider name by looking up the provider from the model's providerId
	providerType = $derived<string | null>(
		this.selectedModel
			? (providerState.getProvider(this.selectedModel.providerId)?.name ?? null)
			: null,
	);
	sendMessageEnabled = $derived<boolean>(
		(this.inputValue.trim() !== "" || this.attachments.length > 0) && !!this.selectedModel,
	);
	hasMessages = $derived(this.messages.length > 0);

	sendMessage = () => {
		if (this.sendMessageEnabled) {
			const currentModel = this.selectedModel!;
			const userMessage: ChatMessage = {
				id: nanoid(),
				role: "user",
				content: this.inputValue,
				createAt: new Date(),
				status: "success",
				attachments: this.attachments,
				model: currentModel,
			};

			this.messages = [...this.messages, userMessage];
			this.inputValue = "";
			this.attachments = [];
			setTimeout(() => {
				const typingMessage: ChatMessage = {
					id: nanoid(),
					role: "assistant",
					content: "",
					createAt: new Date(),
					status: "pending",
					model: currentModel,
				};

				this.messages = [...this.messages, typingMessage];

				setTimeout(() => {
					const assistantMessage: ChatMessage = {
						id: typingMessage.id,
						role: "assistant",
						content: `# 🤖 AI 助手回复示例

感谢您的提问！当前时间是 **${new Date().toLocaleString()}**

## 📝 问题解答

我来为您提供详细的解答和代码示例：

### 1. 代码实现建议

以下是一个 React 组件的完整示例：

\`\`\`jsx
import React, { useState, useEffect } from 'react';

const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData(userId)
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('获取用户数据失败:', error);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div>加载中...</div>;

  return (
    <div className="user-profile">
      <h2>{user?.name}</h2>
      <p>{user?.email}</p>
    </div>
  );
};

export default UserProfile;
\`\`\`

### 2. Python 数据处理示例

对于数据分析任务，我推荐使用以下方法：

\`\`\`python
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split

# 数据预处理
def preprocess_data(df):
    """
    数据预处理函数
    """
    # 处理缺失值
    df = df.fillna(df.mean())

    # 特征标准化
    from sklearn.preprocessing import StandardScaler
    scaler = StandardScaler()
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = scaler.fit_transform(df[numeric_cols])

    return df

# 示例用法
data = pd.read_csv('dataset.csv')
processed_data = preprocess_data(data)
print(f"处理后的数据形状: {processed_data.shape}")
\`\`\`

### 3. 配置文件示例

\`\`\`yaml
# config.yaml
database:
  host: localhost
  port: 5432
  name: myapp_db
  user: admin
  password: secure_password

api:
  base_url: "https://api.example.com"
  timeout: 30
  retry_attempts: 3

features:
  - user_authentication
  - file_upload
  - real_time_notifications
\`\`\`

## 📊 性能对比

| 方案 | 性能 | 复杂度 | 推荐指数 |
|------|------|--------|----------|
| 方案A | 🟢 高 | 🟡 中 | ⭐⭐⭐⭐⭐ |
| 方案B | 🟡 中 | 🟢 低 | ⭐⭐⭐ |
| 方案C | 🔴 低 | 🔴 高 | ⭐⭐ |

## 🔍 详细步骤

### 第一阶段：项目初始化
1. **创建项目目录**
   - 使用 \`create-react-app\` 或 \`vite\` 创建项目
   - 配置 ESLint 和 Prettier

2. **安装必要依赖**
   \`\`\`bash
   npm install axios react-router-dom @mui/material
   npm install -D @types/react typescript
   \`\`\`

3. **设置项目结构**
   \`\`\`text
   src/
   ├── components/
   │   ├── common/
   │   └── pages/
   ├── hooks/
   ├── services/
   └── utils/
   \`\`\`

### 第二阶段：核心功能开发

> 💡 **重要提示：** 在开发过程中，请确保遵循以下最佳实践：

- ✅ 使用 TypeScript 进行类型安全
- ✅ 实现适当的错误处理
- ✅ 编写单元测试
- ✅ 遵循 SOLID 原则

### 第三阶段：测试与部署

对于测试，我建议采用以下策略：

\`\`\`javascript
// __tests__/UserProfile.test.js
import { render, screen, waitFor } from '@testing-library/react';
import UserProfile from '../UserProfile';

describe('UserProfile Component', () => {
  test('显示用户信息', async () => {
    const mockUser = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    // Mock API 调用
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockUser)
    });

    render(<UserProfile userId="123" />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });
});
\`\`\`

## 🚨 常见问题与解决方案

### Q1: 为什么组件不更新？

**A:** 这通常是状态管理问题，检查以下几点：

- 确保使用 \`useState\` 或 \`useReducer\` 正确管理状态
- 验证依赖数组是否正确设置
- 检查是否存在闭包问题

### Q2: 性能优化建议

**A:** 以下是一些关键的优化技巧：

1. **使用 React.memo 防止不必要的重渲染**
2. **实现虚拟化处理大量数据**
3. **使用 Web Workers 处理计算密集型任务**

## 🔗 相关资源

- [React 官方文档](https://react.dev)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [最佳实践指南](https://example.com/best-practices)

## 📈 后续建议

> 基于当前的实现，我建议您考虑以下改进方向：
>
> 1. **添加国际化支持** - 使用 react-i18next
> 2. **实现主题切换** - 支持深色/浅色模式
> 3. **优化移动端体验** - 响应式设计

希望这些信息对您有帮助！如果您有任何其他问题，请随时告诉我。`,
						createAt: new Date(),
						status: "success",
						model: currentModel,
					};

					this.messages = this.messages.map((msg) =>
						msg.id === typingMessage.id ? assistantMessage : msg,
					);
				}, 1500);
			}, 500);
		}
	};

	clearMessages() {
		this.messages = [];
	}

	updateMessage(messageId: string, content: string) {
		this.messages = this.messages.map((msg) => (msg.id === messageId ? { ...msg, content } : msg));
	}

	addAttachment(attachment: AttachmentFile) {
		this.attachments = [...this.attachments, attachment];
	}

	addAttachments(attachments: AttachmentFile[]) {
		this.attachments = [...this.attachments, ...attachments];
	}

	removeAttachment(id: string) {
		this.attachments = this.attachments.filter((att) => att.id !== id);
	}

	handleThinkingActiveChange(active: boolean) {
		this.isThinkingActive = active;
	}

	handleOnlineSearchActiveChange(active: boolean) {
		this.isOnlineSearchActive = active;
	}

	handleMCPActiveChange(active: boolean) {
		this.isMCPActive = active;
	}

	handleSelectedModelChange(model: Model | null) {
		this.selectedModel = model;
	}

	handlePrivateChatActiveChange(active: boolean) {
		this.isPrivateChatActive = active;
	}

	handleTemperatureChange(value: number | null) {
		this.temperature = value;
	}

	handleTopPChange(value: number | null) {
		this.topP = value;
	}

	handleFrequencyPenaltyChange(value: number | null) {
		this.frequencyPenalty = value;
	}

	handlePresencePenaltyChange(value: number | null) {
		this.presencePenalty = value;
	}

	handleMaxTokensChange(value: number | null) {
		this.maxTokens = value;
	}
}

export const chatState = new ChatState();
