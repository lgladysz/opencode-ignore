import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  console.log("Plugin initialized!")
  return {
    // Type-safe hook implementations
    // see https://opencode.ai/docs/plugins/
  }
}
