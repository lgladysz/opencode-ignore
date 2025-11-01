#!/usr/bin/env bun
// Basic test to verify plugin works
import { OpenCodeIgnore } from "./index"

const plugin = await OpenCodeIgnore({
  project: {} as any,
  client: {} as any,
  $: {} as any,
  directory: process.cwd(),
  worktree: process.cwd(),
})

const hook = plugin["tool.execute.before"]
if (!hook) {
  console.error("❌ Hook not registered")
  process.exit(1)
}

console.log("✓ Plugin loaded successfully")
console.log("✓ Hook registered: tool.execute.before")

// Quick smoke test
try {
  await hook(
    { tool: "read", sessionID: "test", callID: "test" },
    { args: { filePath: "index.ts" } }
  )
  console.log("✓ Allows access to index.ts")
} catch (e) {
  console.error("❌ Unexpected block:", e)
  process.exit(1)
}

try {
  await hook(
    { tool: "read", sessionID: "test", callID: "test" },
    { args: { filePath: "secrets.json" } }
  )
  console.error("❌ Should block secrets.json")
  process.exit(1)
} catch (e) {
  console.log("✓ Blocks access to secrets.json")
}

console.log("\n✓ All smoke tests passed")
