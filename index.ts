import type { Plugin } from "@opencode-ai/plugin"
import ignore from "ignore"
import { isPathValid } from "ignore"
import { join, isAbsolute, relative } from "path"

/**
 * Load ignore patterns from project root
 * Uses .ignore file
 * @param projectRoot - Absolute path to project root
 * @returns Ignore instance or null if no ignore file exists
 */
async function loadIgnore(projectRoot: string): Promise<ReturnType<typeof ignore> | null> {
  const ignorePath = join(projectRoot, ".ignore")
  const file = Bun.file(ignorePath)
  if (await file.exists()) {
    const ignoreLib = ignore()
    ignoreLib.add(await file.text())
    return ignoreLib
  }
  
  return null
}

/**
 * Normalize path to format required by ignore library
 * @param targetPath - Path to normalize (absolute or relative)
 * @param projectRoot - Absolute path to project root
 * @param isDirectory - Whether the path represents a directory
 * @returns Normalized relative path
 */
function normalizePath(targetPath: string, projectRoot: string, isDirectory: boolean): string {
  const absolutePath = isAbsolute(targetPath) ? targetPath : join(projectRoot, targetPath)
  const relativePath = relative(projectRoot, absolutePath)
  const resolvedPath = relativePath === "" ? "." : relativePath
  const normalizedPath = resolvedPath.replace(/\\/g, "/")
  const withoutPrefixPath = normalizedPath.startsWith("./") ? normalizedPath.slice(2) : normalizedPath
  const withSlashPath = isDirectory && withoutPrefixPath !== "." && !withoutPrefixPath.endsWith("/")
    ? withoutPrefixPath + "/"
    : withoutPrefixPath
  
  if (!isPathValid(withSlashPath)) {
    throw new Error(`Invalid path format: ${withSlashPath}`)
  }
  
  return withSlashPath
}

/**
 * Check if a path should be blocked by .ignore
 * @param targetPath - Path to check
 * @param projectRoot - Absolute path to project root
 * @param isDirectory - Whether the path represents a directory
 * @returns true if path is blocked, false otherwise
 */
async function isPathBlocked(targetPath: string, projectRoot: string, isDirectory: boolean): Promise<boolean> {
  const ignoreLib = await loadIgnore(projectRoot)
  if (!ignoreLib) return false
  
  const normalizedPath = normalizePath(targetPath, projectRoot, isDirectory)
  return ignoreLib.ignores(normalizedPath)
}

interface PathInfo {
  path: string
  isDirectory: boolean
}

/**
 * Extract path and type from tool arguments
 * @param tool - Tool name
 * @param args - Tool arguments
 * @returns PathInfo or null if tool doesn't require path checking
 */
function extractPathFromTool(tool: string, args: Record<string, unknown>): PathInfo | null {
  if (tool === "read") return args.filePath ? { path: args.filePath as string, isDirectory: false } : null
  if (tool === "write") return args.filePath ? { path: args.filePath as string, isDirectory: false } : null
  if (tool === "edit") return args.filePath ? { path: args.filePath as string, isDirectory: false } : null
  if (tool === "glob") return { path: (args.path as string) || ".", isDirectory: true }
  if (tool === "grep") return { path: (args.path as string) || ".", isDirectory: true }
  if (tool === "list") return { path: (args.path as string) || ".", isDirectory: true }
  
  return null
}

export const OpenCodeIgnore: Plugin = async ({ project, client, $, directory, worktree }) => {
  const projectRoot = worktree || directory
  
  return {
    "tool.execute.before": async ({ tool }, { args }) => {
      const pathInfo = extractPathFromTool(tool, args)
      if (!pathInfo) return
      if (pathInfo.path === ".") return
      
      if (await isPathBlocked(pathInfo.path, projectRoot, pathInfo.isDirectory)) {
        throw new Error(`Access denied: ${pathInfo.path} blocked by ignore file. Do NOT try to read this. Access restricted.`)
      }
    }
  }
}
