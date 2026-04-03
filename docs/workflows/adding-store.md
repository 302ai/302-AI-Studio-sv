# Adding a Svelte Store

**Time**: 5-10 minutes | **Difficulty**: Easy

## Use Code Generator (Recommended)

```bash
pnpm gen:state <ClassName> [--persist] [--scoped]
```

Examples:

```bash
pnpm gen:state Notification                    # Basic state
pnpm gen:state UserPreferences --persist       # Persistent state
pnpm gen:state ChatInput --persist --scoped    # Scoped persistent state
```

## What Gets Generated

### Basic State

```typescript
class NotificationStateManager {
	notifications = $state<Notification[]>([]);
	unreadCount = $derived(this.notifications.filter((n) => !n.read).length);
}

export const notificationState = new NotificationStateManager();
```

### Persistent State

```typescript
const state = persistedState<UserPreferencesState>("user-preferences-state", defaults());

class UserPreferencesStateManager {
	get theme() {
		return state.value.theme;
	}
	set theme(v) {
		state.value = { ...state.value, theme: v };
	}
}

export const userPreferencesState = new UserPreferencesStateManager();
```

## When to Use Each Type

| Type       | Use When             | Example                          |
| ---------- | -------------------- | -------------------------------- |
| Basic      | Temporary UI state   | Modal open/close, loading states |
| Persistent | User preferences     | Theme, language, settings        |
| Scoped     | Per-tab/thread state | Chat input, scroll position      |

## Key Rules

- Use singleton pattern for global state
- Use `$state` for reactive properties
- Use `$derived` for computed values
- Use `$effect` for side effects
- Always export instance, not class

## See Also

- [State Management Architecture](../architecture/state-management.md)
- [Store Template](../patterns/store-template.md)
- [Decision: State Management](../decision-trees/state-management.md)
