import type { Plugin } from "@opencode-ai/plugin"
import ignore from "ignore"
import { isPathValid } from "ignore"
import fs from "fs"
import path from "path"

/**
 * Load ignore patterns from project root
 * Tries .aiignore, .ignore in order
 * @param projectRoot - Absolute path to project root
 * @returns Ignore instance or null if no ignore file exists
 */
function loadAiIgnore(projectRoot: string): ReturnType<typeof ignore> | null {
  const ignoreFiles = [".aiignore", ".ignore"]
  
  // Try each ignore file in order
  for (const filename of ignoreFiles) {
    const ignorePath = path.join(projectRoot, filename)
    if (fs.existsSync(ignorePath)) {
      const ig = ignore()
      const content = fs.readFileSync(ignorePath, "utf-8")
      ig.add(content)
      return ig
    }
  }
  
  // No ignore file found = allow all access (graceful degradation)
  return null
}

/**
 * Normalize path to format required by ignore library
 * @param targetPath - Path to normalize (absolute or relative)
 * @param projectRoot - Absolute path to project root
 * @param isDirectory - Whether the path represents a directory
 * @returns Normalized relative path
 */
function normalizePath(
  targetPath: string,
  projectRoot: string,
  isDirectory: boolean
): string {
  // 1. Convert to absolute first (if relative)
  const absolutePath = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(projectRoot, targetPath)
  
  // 2. Make relative to project root
  let relativePath = path.relative(projectRoot, absolutePath)
  
  // 3. Handle project root itself (relative returns empty string)
  if (relativePath === "") {
    relativePath = "."
  }
  
  // 4. Normalize separators (ignore handles Win32 automatically, but ensure forward slashes)
  relativePath = relativePath.replace(/\\/g, "/")
  
  // 5. Remove ./ prefix if present (ignore library requirement)
  if (relativePath.startsWith("./")) {
    relativePath = relativePath.slice(2)
  }
  
  // 6. Add trailing slash for directories (except for ".")
  if (isDirectory && relativePath !== "." && !relativePath.endsWith("/")) {
    relativePath += "/"
  }
  
  // 7. Validate path format
  if (!isPathValid(relativePath)) {
    throw new Error(`Invalid path format: ${relativePath}`)
  }
  
  return relativePath
}

/**
 * Check if a path should be blocked by .aiignore
 * @param targetPath - Path to check
 * @param projectRoot - Absolute path to project root
 * @param isDirectory - Whether the path represents a directory
 * @returns true if path is blocked, false otherwise
 */
function isPathBlocked(
  targetPath: string,
  projectRoot: string,
  isDirectory: boolean
): boolean {
  // Load .aiignore
  const ig = loadAiIgnore(projectRoot)
  
  // No .aiignore = allow all
  if (!ig) {
    return false
  }
  
  // Normalize path
  const normalizedPath = normalizePath(targetPath, projectRoot, isDirectory)
  
  // Check if ignored
  return ig.ignores(normalizedPath)
}

/**
 * Interface for path extraction result
 */
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
function extractPathFromTool(tool: string, args: any): PathInfo | null {
  // Native file I/O tools - FILES
  if (tool === "read") {
    return args.filePath ? { path: args.filePath, isDirectory: false } : null
  }
  if (tool === "write") {
    return args.filePath ? { path: args.filePath, isDirectory: false } : null
  }
  if (tool === "edit") {
    return args.filePath ? { path: args.filePath, isDirectory: false } : null
  }
  
  // Native search/list tools - DIRECTORIES
  if (tool === "glob") {
    return { path: args.path || ".", isDirectory: true }
  }
  if (tool === "grep") {
    return { path: args.path || ".", isDirectory: true }
  }
  if (tool === "list") {
    return { path: args.path || ".", isDirectory: true }
  }
  
  return null
}

export const OpenCodeIgnore: Plugin = async ({ project, client, $, directory, worktree }) => {
  const projectRoot = worktree || directory
  
  return {
    "tool.execute.before": async ({ tool }, { args }) => {
      // Extract path from tool arguments
      const pathInfo = extractPathFromTool(tool, args)
      
      // Skip tools that don't require path checking
      if (!pathInfo) {
        return
      }
      
      // Skip checking project root itself (.) - can't block entire project
      if (pathInfo.path === ".") {
        return
      }
      
      // Check if path is blocked
      if (isPathBlocked(pathInfo.path, projectRoot, pathInfo.isDirectory)) {
        throw new Error(`Access denied: ${pathInfo.path} blocked by ignore file. Do NOT try to read this. Access restricted.`)
      }
    }
  }
}
