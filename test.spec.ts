import { test, expect, describe, beforeAll } from "bun:test"
import { OpenCodeIgnore } from "./index"
import path from "path"

// Helper to create plugin instance
async function createPlugin(projectRoot = process.cwd()) {
  return await OpenCodeIgnore({
    project: {} as any,
    client: {} as any,
    $: {} as any,
    directory: projectRoot,
    worktree: projectRoot,
  })
}

// Helper to call hook
async function callHook(hook: any, tool: string, args: any) {
  return await hook(
    { tool, sessionID: "test", callID: "test" },
    { args }
  )
}

describe("OpenCodeIgnore Plugin", () => {
  test("plugin loads and registers hook", async () => {
    const plugin = await createPlugin()
    expect(plugin["tool.execute.before"]).toBeDefined()
    expect(typeof plugin["tool.execute.before"]).toBe("function")
  })

  test("graceful degradation - missing .aiignore allows all", async () => {
    const tempDir = "/tmp/test-no-aiignore-" + Date.now()
    const plugin = await createPlugin(tempDir)
    const hook = plugin["tool.execute.before"]!
    
    // Should not throw even though .aiignore doesn't exist
    await expect(callHook(hook, "read", { filePath: "secrets.json" })).resolves.toBeUndefined()
  })

  test("project root (.) is always allowed", async () => {
    const plugin = await createPlugin()
    const hook = plugin["tool.execute.before"]!
    
    // All directory operations on root should be allowed
    await expect(callHook(hook, "list", { path: "." })).resolves.toBeUndefined()
    await expect(callHook(hook, "glob", { path: "." })).resolves.toBeUndefined()
    await expect(callHook(hook, "grep", { path: "." })).resolves.toBeUndefined()
  })
})

describe("File I/O Tools Protection", () => {
  let plugin: any
  let hook: any

  beforeAll(async () => {
    plugin = await createPlugin()
    hook = plugin["tool.execute.before"]
  })

  describe("read tool", () => {
    test("allows access to allowed files", async () => {
      await expect(callHook(hook, "read", { filePath: "index.ts" })).resolves.toBeUndefined()
      await expect(callHook(hook, "read", { filePath: "README.md" })).resolves.toBeUndefined()
    })

    test("blocks secrets.json", async () => {
      await expect(callHook(hook, "read", { filePath: "secrets.json" }))
        .rejects.toThrow(/Access denied.*secrets\.json.*blocked by \.aiignore/)
    })

    test("blocks credentials.json", async () => {
      await expect(callHook(hook, "read", { filePath: "credentials.json" }))
        .rejects.toThrow(/Access denied.*credentials\.json/)
    })

    test("blocks .env files", async () => {
      await expect(callHook(hook, "read", { filePath: ".env" }))
        .rejects.toThrow(/Access denied.*\.env/)
      await expect(callHook(hook, "read", { filePath: ".env.local" }))
        .rejects.toThrow(/Access denied.*\.env\.local/)
      await expect(callHook(hook, "read", { filePath: "production.env" }))
        .rejects.toThrow(/Access denied.*production\.env/)
    })

    test("blocks certificate files", async () => {
      await expect(callHook(hook, "read", { filePath: "server.crt" }))
        .rejects.toThrow(/Access denied.*server\.crt/)
      await expect(callHook(hook, "read", { filePath: "ca.pem" }))
        .rejects.toThrow(/Access denied.*ca\.pem/)
      await expect(callHook(hook, "read", { filePath: "private.key" }))
        .rejects.toThrow(/Access denied.*private\.key/)
    })

    test("blocks id_rsa", async () => {
      await expect(callHook(hook, "read", { filePath: "id_rsa" }))
        .rejects.toThrow(/Access denied.*id_rsa/)
    })
  })

  describe("write tool", () => {
    test("allows writing to allowed files", async () => {
      await expect(callHook(hook, "write", { filePath: "output.txt" })).resolves.toBeUndefined()
    })

    test("blocks writing to secrets.json", async () => {
      await expect(callHook(hook, "write", { filePath: "secrets.json" }))
        .rejects.toThrow(/Access denied.*secrets\.json/)
    })
  })

  describe("edit tool", () => {
    test("allows editing allowed files", async () => {
      await expect(callHook(hook, "edit", { filePath: "index.ts" })).resolves.toBeUndefined()
    })

    test("blocks editing secrets.json", async () => {
      await expect(callHook(hook, "edit", { filePath: "secrets.json" }))
        .rejects.toThrow(/Access denied.*secrets\.json/)
    })
  })
})

describe("Search/List Tools Protection", () => {
  let plugin: any
  let hook: any

  beforeAll(async () => {
    plugin = await createPlugin()
    hook = plugin["tool.execute.before"]
  })

  describe("glob tool", () => {
    test("allows glob on project root", async () => {
      await expect(callHook(hook, "glob", { path: "." })).resolves.toBeUndefined()
    })

    test("allows glob on allowed directories", async () => {
      await expect(callHook(hook, "glob", { path: "src" })).resolves.toBeUndefined()
    })

    test("blocks glob on to/ignore (relative path)", async () => {
      await expect(callHook(hook, "glob", { path: "to/ignore" }))
        .rejects.toThrow(/Access denied.*to\/ignore/)
    })

    test("defaults to . when path not provided", async () => {
      await expect(callHook(hook, "glob", {})).resolves.toBeUndefined()
    })
  })

  describe("grep tool", () => {
    test("allows grep on project root", async () => {
      await expect(callHook(hook, "grep", { path: "." })).resolves.toBeUndefined()
    })

    test("allows grep on allowed directories", async () => {
      await expect(callHook(hook, "grep", { path: "src" })).resolves.toBeUndefined()
    })

    test("allows grep on bamboo-specs directory (pattern only blocks files inside)", async () => {
      // Pattern **/bamboo-specs/** blocks files inside, not the directory itself
      await expect(callHook(hook, "grep", { path: "foo/bamboo-specs" }))
        .resolves.toBeUndefined()
    })

    test("defaults to . when path not provided", async () => {
      await expect(callHook(hook, "grep", {})).resolves.toBeUndefined()
    })
  })

  describe("list tool", () => {
    test("allows list on project root", async () => {
      await expect(callHook(hook, "list", { path: "." })).resolves.toBeUndefined()
    })

    test("allows list on allowed directories", async () => {
      await expect(callHook(hook, "list", { path: "src" })).resolves.toBeUndefined()
    })

    test("blocks list on /to/ignore", async () => {
      await expect(callHook(hook, "list", { path: "to/ignore" }))
        .rejects.toThrow(/Access denied.*to\/ignore/)
    })

    test("defaults to . when path not provided", async () => {
      await expect(callHook(hook, "list", {})).resolves.toBeUndefined()
    })
  })
})

describe("Pattern Types", () => {
  let plugin: any
  let hook: any

  beforeAll(async () => {
    plugin = await createPlugin()
    hook = plugin["tool.execute.before"]
  })

  describe("absolute patterns", () => {
    test("blocks /to/ignore files", async () => {
      await expect(callHook(hook, "read", { filePath: "to/ignore/file.txt" }))
        .rejects.toThrow(/Access denied/)
    })

    test("blocks /somedir/toignore/** files", async () => {
      await expect(callHook(hook, "read", { filePath: "somedir/toignore/nested/file.txt" }))
        .rejects.toThrow(/Access denied/)
    })
  })

  describe("glob patterns", () => {
    test("blocks **/bamboo-specs/** files", async () => {
      await expect(callHook(hook, "read", { filePath: "foo/bamboo-specs/plan.yml" }))
        .rejects.toThrow(/Access denied/)
      await expect(callHook(hook, "read", { filePath: "bar/baz/bamboo-specs/config.xml" }))
        .rejects.toThrow(/Access denied/)
    })

    test("allows bamboo-specs directory itself (only blocks files inside)", async () => {
      // Note: Pattern **/bamboo-specs/** blocks files inside, not the dir itself
      await expect(callHook(hook, "list", { path: "bamboo-specs" })).resolves.toBeUndefined()
    })

    test("blocks **/keycloak-realm-config/templates/** files", async () => {
      await expect(callHook(hook, "read", { filePath: "keycloak-realm-config/templates/realm.json" }))
        .rejects.toThrow(/Access denied/)
    })
  })

  describe("wildcard patterns", () => {
    test("blocks *-realm.json files", async () => {
      await expect(callHook(hook, "read", { filePath: "dev-realm.json" }))
        .rejects.toThrow(/Access denied/)
      await expect(callHook(hook, "read", { filePath: "prod-realm.json" }))
        .rejects.toThrow(/Access denied/)
    })

    test("blocks some*.properties files", async () => {
      await expect(callHook(hook, "read", { filePath: "some.properties" }))
        .rejects.toThrow(/Access denied/)
      await expect(callHook(hook, "read", { filePath: "something.properties" }))
        .rejects.toThrow(/Access denied/)
    })

    test("allows other .properties files", async () => {
      await expect(callHook(hook, "read", { filePath: "application.properties" })).resolves.toBeUndefined()
    })
  })

  describe("negation patterns", () => {
    test("allows *.local.json despite blocking patterns", async () => {
      await expect(callHook(hook, "read", { filePath: "config.local.json" })).resolves.toBeUndefined()
      await expect(callHook(hook, "read", { filePath: "settings.local.jsonc" })).resolves.toBeUndefined()
    })

    test("allows *.local.md files", async () => {
      await expect(callHook(hook, "read", { filePath: "notes.local.md" })).resolves.toBeUndefined()
    })

    test("allows /.local/ directory", async () => {
      await expect(callHook(hook, "list", { path: ".local" })).resolves.toBeUndefined()
      await expect(callHook(hook, "read", { filePath: ".local/impl.md" })).resolves.toBeUndefined()
    })

    test("blocks /somedir/toignore/** but allows file-to-not-ignore.md", async () => {
      await expect(callHook(hook, "read", { filePath: "somedir/toignore/file-to-not-ignore.md" }))
        .resolves.toBeUndefined()
      await expect(callHook(hook, "read", { filePath: "somedir/toignore/other-file.txt" }))
        .rejects.toThrow(/Access denied/)
    })

    test("allows **/target/** due to negation", async () => {
      await expect(callHook(hook, "read", { filePath: "target/output.jar" })).resolves.toBeUndefined()
      await expect(callHook(hook, "list", { path: "target" })).resolves.toBeUndefined()
    })
  })
})

describe("Path Normalization", () => {
  let plugin: any
  let hook: any

  beforeAll(async () => {
    plugin = await createPlugin()
    hook = plugin["tool.execute.before"]
  })

  describe("absolute paths", () => {
    test("handles absolute paths correctly", async () => {
      const absolutePath = path.join(process.cwd(), "secrets.json")
      await expect(callHook(hook, "read", { filePath: absolutePath }))
        .rejects.toThrow(/Access denied/)
    })

    test("allows absolute path to allowed file", async () => {
      const absolutePath = path.join(process.cwd(), "index.ts")
      await expect(callHook(hook, "read", { filePath: absolutePath })).resolves.toBeUndefined()
    })
  })

  describe("./ prefix handling", () => {
    test("handles ./ prefix correctly", async () => {
      await expect(callHook(hook, "read", { filePath: "./secrets.json" }))
        .rejects.toThrow(/Access denied/)
      await expect(callHook(hook, "read", { filePath: "./index.ts" })).resolves.toBeUndefined()
    })
  })

  describe("nested directories", () => {
    test("handles deeply nested paths", async () => {
      await expect(callHook(hook, "read", { filePath: "foo/bar/baz/bamboo-specs/plan.yml" }))
        .rejects.toThrow(/Access denied/)
      await expect(callHook(hook, "read", { filePath: "deep/nested/path/allowed.txt" }))
        .resolves.toBeUndefined()
    })
  })

  describe("directory vs file matching", () => {
    test("directories get trailing slash for matching", async () => {
      // bamboo-specs/ as directory should be allowed (only files inside blocked)
      await expect(callHook(hook, "list", { path: "bamboo-specs" })).resolves.toBeUndefined()
      
      // Files inside bamboo-specs/ should be blocked
      await expect(callHook(hook, "read", { filePath: "bamboo-specs/file.txt" }))
        .rejects.toThrow(/Access denied/)
    })

    test(".local/ directory is allowed", async () => {
      await expect(callHook(hook, "list", { path: ".local" })).resolves.toBeUndefined()
      await expect(callHook(hook, "grep", { path: ".local" })).resolves.toBeUndefined()
    })
  })
})

describe("Edge Cases", () => {
  let plugin: any
  let hook: any

  beforeAll(async () => {
    plugin = await createPlugin()
    hook = plugin["tool.execute.before"]
  })

  test("handles undefined path gracefully", async () => {
    // Tools like glob/grep default to "." when no path provided
    await expect(callHook(hook, "glob", {})).resolves.toBeUndefined()
    await expect(callHook(hook, "grep", {})).resolves.toBeUndefined()
  })

  test("handles null/missing filePath for file tools", async () => {
    // Should not throw, just skip (no path to check)
    await expect(callHook(hook, "read", {})).resolves.toBeUndefined()
  })

  test("handles empty string path", async () => {
    // Empty string should be treated as current dir
    await expect(callHook(hook, "list", { path: "" })).resolves.toBeUndefined()
  })

  test("ignores unsupported tools", async () => {
    // Tool that's not in extractPathFromTool should be skipped
    await expect(callHook(hook, "unknown_tool", { somePath: "secrets.json" }))
      .resolves.toBeUndefined()
  })

  test("error message includes blocked path", async () => {
    try {
      await callHook(hook, "read", { filePath: "secrets.json" })
      expect(false).toBe(true) // Should not reach here
    } catch (e: any) {
      expect(e.message).toContain("secrets.json")
      expect(e.message).toContain(".aiignore")
      expect(e.message).toContain("Access denied")
    }
  })
})

describe("Real-world Scenarios", () => {
  let plugin: any
  let hook: any

  beforeAll(async () => {
    plugin = await createPlugin()
    hook = plugin["tool.execute.before"]
  })

  test("allows normal development workflow", async () => {
    // Reading source files
    await expect(callHook(hook, "read", { filePath: "index.ts" })).resolves.toBeUndefined()
    await expect(callHook(hook, "read", { filePath: "README.md" })).resolves.toBeUndefined()
    
    // Writing output
    await expect(callHook(hook, "write", { filePath: "output.txt" })).resolves.toBeUndefined()
    
    // Searching codebase
    await expect(callHook(hook, "grep", { path: "src" })).resolves.toBeUndefined()
    await expect(callHook(hook, "glob", { path: "." })).resolves.toBeUndefined()
  })

  test("blocks sensitive files consistently", async () => {
    const sensitiveFiles = [
      "secrets.json",
      "credentials.json",
      ".env",
      ".env.production",
      "server.crt",
      "private.key",
      "id_rsa"
    ]

    for (const file of sensitiveFiles) {
      await expect(callHook(hook, "read", { filePath: file }))
        .rejects.toThrow(/Access denied/)
    }
  })

  test("handles complex project structure", async () => {
    // Should allow src directory
    await expect(callHook(hook, "list", { path: "src" })).resolves.toBeUndefined()
    
    // But block bamboo-specs inside any directory
    await expect(callHook(hook, "read", { filePath: "src/bamboo-specs/plan.yml" }))
      .rejects.toThrow(/Access denied/)
  })
})
