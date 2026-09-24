import { MACRO_HARNESS_NAME } from './macroAgent';

/**
 * Shared copy for the agent surfaces. The workspace roster and the settings
 * pages describe the same two concepts, so the wording lives here once
 * instead of drifting per screen.
 */

/** What an agent is, shown above any list of agents. */
export const AGENTS_DESCRIPTION =
  'Agents let you customize your Macro AI experience by combining a unique name, specific instructions, default model, and runtime.';

/** What a runtime is, shown above any list of runtimes. */
export const RUNTIMES_DESCRIPTION = `Runtimes are the harnesses that power agents in Macro, whether our native, fast ${MACRO_HARNESS_NAME} harness or coding harnesses like Cursor or your own Claude Code.`;
