# Debug Provider Plugin

A built-in test plugin that demonstrates and validates the message hook system functionality in 302-AI-Studio.

## Purpose

This plugin is designed for:

- **Testing hook functionality** - Validates that all message hooks are working correctly
- **Debugging message flow** - Provides detailed logging of message lifecycle
- **Development reference** - Serves as an example for plugin developers

## Features

### Implemented Hooks

1. **onBeforeSendMessage**
   - Logs message details before sending
   - Can add a configurable prefix to user messages
   - Example: `[DEBUG] Your message here`

2. **onAfterSendMessage**
   - Logs response statistics
   - Records token usage and message counts
   - Saves statistics to plugin storage

3. **onStreamChunk**
   - Logs each streaming chunk (in verbose mode)
   - Demonstrates chunk-level processing

4. **onError**
   - Intercepts and logs errors
   - Provides intelligent retry suggestions:
     - Rate limit errors: Retry after 30 seconds
     - Network errors: Immediate retry
   - Saves error details to plugin storage

## Configuration

Access plugin settings via: **Settings → Plugins → Debug Provider → Settings**

### Available Options

| Option      | Type    | Default   | Description                                      |
| ----------- | ------- | --------- | ------------------------------------------------ |
| `enabled`   | boolean | `false`   | Enable/disable debug hooks                       |
| `logLevel`  | string  | `verbose` | Logging verbosity: `silent`, `normal`, `verbose` |
| `addPrefix` | boolean | `true`    | Add prefix to user messages                      |
| `prefix`    | string  | `[DEBUG]` | Prefix text to add                               |

## Usage

### 1. Enable the Plugin

```typescript
// In the Plugins settings page
1. Navigate to Settings → Plugins
2. Find "Debug Provider" in the list
3. Click "Settings"
4. Enable "Enable Debug Mode"
5. Configure other options as needed
6. Click "Save Changes"
```

### 2. Monitor Console Output

The plugin will log detailed information to the console:

```
[DebugPlugin] 🔧 Debug Provider Plugin initialized
[DebugPlugin] 📤 onBeforeSendMessage hook triggered
[DebugPlugin] ✏️ Added prefix to message: [DEBUG] Hello!
[DebugPlugin] 📥 onAfterSendMessage hook triggered
[DebugPlugin] 📊 Message statistics: { totalMessages: 2, promptTokens: 10, completionTokens: 50, totalTokens: 60 }
```

### 3. Test Different Scenarios

**Test message modification:**

```typescript
// Send a message with the plugin enabled
// Expected: Message will have [DEBUG] prefix
User: "Hello"
Actual sent: "[DEBUG] Hello"
```

**Test error handling:**

```typescript
// Trigger a rate limit error
// Expected: Plugin suggests 30s retry delay
[DebugPlugin] ❌ onError hook triggered
[DebugPlugin] 🔄 Rate limit detected, suggesting retry in 30s
```

**Test statistics logging:**

```typescript
// After each message, check stored stats
// Stats are saved to plugin private storage
{
  timestamp: "2025-10-27T...",
  totalMessages: 4,
  promptTokens: 120,
  completionTokens: 380,
  totalTokens: 500
}
```

## Log Levels

### Silent

- No console output
- Errors still saved to storage

### Normal (Default)

- Key events logged:
  - Plugin initialization
  - Hook triggers
  - Message statistics
  - Error summaries

### Verbose

- All normal logs plus:
  - Detailed context objects
  - Stream chunk information
  - Configuration details
  - Storage operations

## Storage

The plugin uses the Plugin Storage API to persist data:

**Stored Data:**

- `lastMessageStats` - Statistics from the last message
- `lastError` - Details of the last error encountered

**Access stored data:**

```typescript
// Via plugin API
const stats = await api.storage.getData("lastMessageStats");
console.log(stats);
```

## Development Notes

### Code Structure

```
debug-plugin/
├── plugin.json          # Plugin metadata and configuration schema
├── main/
│   └── index.ts         # Main plugin implementation
└── README.md            # This file
```

### Key Implementation Details

1. **Configuration Loading**
   - Config is loaded in `initialize()`
   - Saved config overrides defaults
   - All hooks check `config.enabled` first

2. **Logging Strategy**
   - Dual logging: console + Plugin API logger
   - Level-based filtering
   - Structured data logging

3. **Error Handling**
   - Graceful fallback on errors
   - Never blocks main functionality
   - Errors logged but don't stop execution

4. **Hook Return Values**
   - `onBeforeSendMessage`: Returns modified or original context
   - `onAfterSendMessage`: No return value (void)
   - `onError`: Returns ErrorHandleResult with retry suggestions

## Testing Checklist

- [ ] Plugin loads without errors
- [ ] Settings dialog works correctly
- [ ] Enable/disable toggle functions
- [ ] Message prefix is added when enabled
- [ ] Statistics are logged after messages
- [ ] Error hook intercepts errors
- [ ] Retry logic works for rate limits
- [ ] Storage operations succeed
- [ ] Log levels filter correctly
- [ ] Plugin can be disabled without issues

## Troubleshooting

**Plugin not showing up:**

- Check that plugin is in `plugins/builtin/debug-plugin/`
- Verify `plugin.json` is valid
- Restart the application

**Hooks not firing:**

- Ensure plugin is enabled in settings
- Check `enabled` config option is `true`
- Verify console for initialization logs

**Configuration not saving:**

- Check browser console for storage errors
- Verify plugin has storage permissions
- Try reloading the plugin

## Example Output

```console
[DebugPlugin] 🔧 Debug Provider Plugin initialized
[DebugPlugin] Configuration: { enabled: true, logLevel: 'verbose', addPrefix: true, prefix: '[DEBUG]' }

[DebugPlugin] 📤 onBeforeSendMessage hook triggered
[DebugPlugin] Original context: {
  messagesCount: 2,
  model: 'gpt-4',
  provider: 'OpenAI',
  parameters: { temperature: 0.7, topP: 1, maxTokens: 2000 }
}
[DebugPlugin] ✏️ Added prefix to message: [DEBUG] What is the weather today?

[DebugPlugin] 🌊 Stream chunk: { type: 'text', hasText: true, hasToolCall: false }
[DebugPlugin] 🌊 Stream chunk: { type: 'text', hasText: true, hasToolCall: false }
[DebugPlugin] 🌊 Stream chunk: { type: 'done', hasText: false, hasToolCall: false }

[DebugPlugin] 📥 onAfterSendMessage hook triggered
[DebugPlugin] Response details: {
  model: 'gpt-4',
  finishReason: 'stop',
  usage: { promptTokens: 45, completionTokens: 120, totalTokens: 165 }
}
[DebugPlugin] 📊 Message statistics: {
  totalMessages: 4,
  promptTokens: 45,
  completionTokens: 120,
  totalTokens: 165
}
```

## Related Documentation

- [Plugin Development Guide](../../../docs/plugin-development-guide.md)
- [Plugin System Implementation](../../../docs/plugin-system-implementation-summary.md)
- [Plugin API Reference](../../../src/lib/plugin-system/types.ts)
