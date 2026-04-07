# Code Agent 模式重构计划 (Local / Remote / Cloud) - 模式匹配优化版

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 彻底重构 Code Agent 的状态 management 链路。使用 `ts-pattern` 替换复杂的 `if-else` 分支，确保 `local` (local), `remote` (remote sandbox) and `cloud` (cloud environment) 三种模式的逻辑解耦、清晰且易于扩展。

**Architecture:** 采用 `match(this.type)` 模式匹配处理所有类型相关的派生状态、执行流和配置获取。针对非沙箱模式（`local` 和 `cloud`），使用虚拟 ID 占位并直接传递模型 ID。所有注释均使用英文。

**Tech Stack:** Svelte 5 Runes, TypeScript, ts-pattern

---

### Task 1: Refactor `CodeAgentState` core logic using pattern matching

**Files:**
- Modify: `src/lib/stores/code-agent/code-agent-state.svelte.ts`

- [x] **Step 1: Rewrite `sandboxStatus` derived logic**

Use `ts-pattern` to explicitly determine sandbox/environment status based on `type`.

```typescript
// src/lib/stores/code-agent/code-agent-state.svelte.ts

sandboxStatus = $derived.by<CodeAgentSandboxStatus>(() => {
    return match(this.type)
        .with("local", () => "sandbox-created" as const)
        .with("cloud", () => (cloudEnvState.running ? "sandbox-created" : "waiting-for-sandbox") as const)
        .with("remote", () => (claudeCodeAgentState.sandboxId === "" ? "waiting-for-sandbox" : "sandbox-created") as const)
        .exhaustive();
});
```

- [x] **Step 2: Refactor `executeCodeAgentMode` logic**

Use pattern matching to dispatch execution flow.

```typescript
// src/lib/stores/code-agent/code-agent-state.svelte.ts

async executeCodeAgentMode(): Promise<{ isOK: boolean; sandboxInfo?: ClaudeCodeSandboxInfo }> {
    if (this.currentAgentId !== "claude-code" && this.currentAgentId !== "open-claw") {
        return { isOK: false };
    }

    return match(this.type)
        .with("local", () => claudeCodeAgentState.handleLocalModeExecute())
        .with("cloud", () => {
            if (!cloudEnvState.running) {
                logger.info("[CodeAgentState] executeCodeAgentMode: Cloud not running");
                // Future: add logic to prompt user to start cloud environment
            }
            return claudeCodeAgentState.handleLocalModeExecute();
        })
        .with("remote", () => claudeCodeAgentState.handleAgentModeExecute())
        .exhaustive();
}
```

- [x] **Step 3: Refactor `codeAgentCfgs` configuration generation**

Ensure `modelId` is passed for local/cloud, and `sandboxId` is passed for remote.

```typescript
// src/lib/stores/code-agent/code-agent-state.svelte.ts

get codeAgentCfgs(): CodeAgentCfgs {
    return match(this.currentAgentId)
        .with("claude-code", "open-claw", () => {
            return match(this.type)
                .with("local", () => ({
                    baseUrl: this.localBaseUrl,
                    model: claudeCodeAgentState.model,
                }))
                .with("cloud", () => {
                    logger.info("[CodeAgentState] codeAgentCfgs: cloud mode placeholder");
                    return {
                        baseUrl: claudeCodeAgentState.baseUrl,
                        model: claudeCodeAgentState.model,
                    };
                })
                .with("remote", () => ({
                    baseUrl: claudeCodeAgentState.baseUrl,
                    model: claudeCodeAgentState.sandboxId,
                }))
                .exhaustive();
        })
        .otherwise(() => ({ baseUrl: "", model: "" }));
}
```

---

### Task 2: Optimize `ClaudeCodeAgentState` internal logic

**Files:**
- Modify: `src/lib/stores/code-agent/claude-code-state.svelte.ts`

- [x] **Step 1: Optimize `handleActiveDeployment` (Isolate deployment logic)**

```typescript
// src/lib/stores/code-agent/claude-code-state.svelte.ts

private async handleActiveDeployment(message: ChatMessage): Promise<DeploySandboxResponse | null> {
    return await match(codeAgentState.type)
        .with("remote", async () => {
            // ... original deployment logic
        })
        .otherwise(() => null);
}
```

- [x] **Step 2: Optimize `listClaudeCodeSkills` parameters and logic**

Completely separate `cloud` logic from `local`.

```typescript
// src/lib/stores/code-agent/claude-code-state.svelte.ts

async listClaudeCodeSkills(isInit: boolean): Promise<ListSkillsResponse> {
    const listSkillsResponse = await listSkills(
        match({ type: codeAgentState.type, sessionId: selectedSessionId })
            .with({ type: "remote", sessionId: P.not("new") }, () => ({
                sandboxId: selectedSandboxId,
                sessionId: selectedSessionId,
            }))
            .with({ type: "cloud" }, () => {
                logger.info("[ClaudeCodeAgentState] listClaudeCodeSkills: cloud mode placeholder");
                return {};
            })
            .otherwise(() => ({})),
    );

    // ... Handle isInit with exhaustive match(codeAgentState.type)
}
```

---

### Task 3: Complete activation link and persistence adaptation

**Files:**
- Modify: `src/lib/stores/code-agent/code-agent-state.svelte.ts`

- [x] **Step 1: Refactor `handleConfirmEnabled` branch logic**

```typescript
// src/lib/stores/code-agent/code-agent-state.svelte.ts

handleConfirmEnabled(): void {
    // ... MCP filtering logic

    match(this.type)
        .with("local", () => {
            this.handleLocalEnabled(
                localClaudeCodeSandboxState.selectedSessionId,
                localClaudeCodeSandboxState.selectedWorkspacePath
            );
        })
        .with("cloud", () => {
            this.handleCloudEnabled("new", "new");
        })
        .with("remote", () => {
            this.handleEnabled();
        })
        .exhaustive();

    this.updateEnabled(true, false);
}
```

---

### Task 4: Link verification (Verification)

- [ ] **Step 1: State verification (State Sync)**
Disconnect cloud running status (`cloudEnvState.running = false`), confirm send button status correctly switches.
- [ ] **Step 2: Configuration verification (Config Accuracy)**
Confirm `codeAgentCfgs` returns correct `model` field meaning in all three modes.
- [ ] **Step 3: Persistence verification (Persistence)**
Refresh page, confirm `sandboxId` is the correct placeholder (`"cloud"` or `"local"`).
