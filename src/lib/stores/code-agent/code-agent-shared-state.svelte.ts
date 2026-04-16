/**
 * Shared state between code-agent-state and code-agent-taskboard-state
 * to avoid circular dependencies.
 *
 * This module contains state that needs to be accessed by both modules
 * without creating a circular import.
 */

class CodeAgentSharedState {
	/**
	 * Whether the taskboard is currently running.
	 * Updated by code-agent-taskboard-state, read by code-agent-state.
	 */
	taskboardIsRunning = $state(false);
}

export const codeAgentSharedState = new CodeAgentSharedState();
