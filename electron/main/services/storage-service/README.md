# Storage Service Migration System

本文档说明如何在存储服务中使用版本迁移功能。

## 概述

存储服务版本迁移系统允许你在软件版本升级时自动处理数据结构的变化，确保用户的持久化数据能够平滑地从旧版本迁移到新版本。

## 基础用法

### 1. 定义迁移函数

```typescript
import { createMigrate } from "./migration-utils";

const migrations = {
	0: (state) => {
		// 从版本 0 迁移到版本 1
		if (!state) {
			return {
				theme: "system",
				shouldUseDarkColors: false,
			};
		}

		// 如果旧版本使用 darkMode 字段，转换为新的结构
		if (state.darkMode !== undefined) {
			return {
				theme: state.darkMode ? "dark" : "light",
				shouldUseDarkColors: state.darkMode,
			};
		}

		return state;
	},
	1: (state) => {
		// 从版本 1 迁移到版本 2
		return {
			...state,
			newField: "defaultValue", // 添加新字段
		};
	},
};
```

### 2. 创建迁移配置

```typescript
import type { MigrationConfig } from "@shared/types";

const migrationConfig: MigrationConfig<YourStateType> = {
	version: 2, // 当前版本
	migrate: createMigrate(migrations, { debug: true }), // 启用调试模式
	debug: true,
};
```

### 3. 在存储服务中使用

```typescript
export class YourStorage extends StorageService<YourStateType> {
	constructor() {
		super(migrationConfig); // 传递迁移配置
		this.storage = prefixStorage(this.storage, "YourStorage");
	}

	async getState() {
		return this.getItemInternal("state");
	}

	async setState(state: YourStateType) {
		return this.setItemInternal("state", state);
	}
}
```

## 完整示例：ThemeStorage

```typescript
import { prefixStorage, ThemeState, type MigrationConfig } from "@shared/types";
import { StorageService } from ".";
import { createMigrate } from "./migration-utils";

// 定义迁移函数
const migrations = {
	0: (state: any) => {
		if (!state) {
			return {
				theme: "system" as const,
				shouldUseDarkColors: false,
			};
		}

		// 旧版本兼容：将 darkMode 转换为新的主题结构
		if (state.darkMode !== undefined) {
			return {
				theme: state.darkMode ? "dark" : "light",
				shouldUseDarkColors: state.darkMode,
			};
		}

		return state;
	},
};

// 创建迁移配置
const migrationConfig: MigrationConfig<ThemeState> = {
	version: 1,
	migrate: createMigrate(migrations, { debug: true }),
	debug: true,
};

// 实现存储服务
export class ThemeStorage extends StorageService<ThemeState> {
	constructor() {
		super(migrationConfig);
		this.storage = prefixStorage(this.storage, "ThemeStorage");
	}

	async getThemeState() {
		return this.getItemInternal("state");
	}

	async setThemeState(state: ThemeState) {
		return this.setItemInternal("state", state);
	}
}

export const themeStorage = new ThemeStorage();
```

## 特性

### 1. 自动版本管理

- 每个存储项自动添加 `_version` 字段
- 读取时自动检查版本并触发迁移

### 2. 增量迁移

- 支持从任意旧版本迁移到最新版本
- 按版本顺序依次执行迁移函数

### 3. 调试模式

- 详细的迁移日志
- 迁移错误追踪

### 4. 类型安全

- 完整的 TypeScript 类型支持
- 编译时类型检查

### 5. 错误处理

- 迁移失败时的优雅降级
- 保留原始数据，避免数据丢失

## 最佳实践

### 1. 版本号管理

- 从 0 开始编号迁移函数
- 每次数据结构变化时递增版本号
- 保留所有历史迁移函数

### 2. 迁移函数设计

- 每个迁移函数应该是纯函数
- 处理所有可能的输入状态（包括 null/undefined）
- 添加充分的错误处理

### 3. 测试

- 为每个迁移函数编写单元测试
- 测试从各个历史版本的迁移路径
- 测试边界情况（空数据、错误数据等）

### 4. 调试

- 在开发环境启用调试模式
- 在生产环境关闭调试以提升性能

## 迁移函数示例

### 添加新字段

```typescript
0: (state) => {
  return {
    ...state,
    newField: "defaultValue",
  };
}
```

### 重命名字段

```typescript
1: (state) => {
  const { oldField, ...rest } = state;
  return {
    ...rest,
    newField: oldField,
  };
}
```

### 数据结构重构

```typescript
2: (state) => {
  if (state.user && state.user.name) {
    const [firstName, lastName] = state.user.name.split(' ');
    return {
      ...state,
      user: {
        ...state.user,
        firstName,
        lastName,
      },
    };
  }
  return state;
}
```

### 处理空状态

```typescript
0: (state) => {
  if (!state) {
    return {
      // 返回默认状态
      defaultField: "defaultValue",
    };
  }
  return state;
}
```
