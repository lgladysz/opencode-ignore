import type { Plugin } from "@opencode-ai/plugin"
import ignore from "ignore"
import { isPathValid } from "ignore"
import fs from "fs"
import path from "path"

/**
 * Load .aiignore patterns from project root
 * @param projectRoot - Absolute path to project root
 * @returns Ignore instance or null if .aiignore doesn't exist
 */
function loadAiIgnore(projectRoot: string): ReturnType<typeof ignore> | null {
  const aiignorePath = path.join(projectRoot, ".aiignore")
  
  // Missing .aiignore = allow all access (graceful degradation)
  if (!fs.existsSync(aiignorePath)) {
    return null
  }
  
  // Load and parse patterns
  const ig = ignore()
  const content = fs.readFileSync(aiignorePath, "utf-8")
  ig.add(content)
  
  return ig
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
  
  // 3. Normalize separators (ignore handles Win32 automatically, but ensure forward slashes)
  relativePath = relativePath.replace(/\\/g, "/")
  
  // 4. Remove ./ prefix if present (ignore library requirement)
  if (relativePath.startsWith("./")) {
    relativePath = relativePath.slice(2)
  }
  
  // 5. Add trailing slash for directories
  if (isDirectory && !relativePath.endsWith("/")) {
    relativePath += "/"
  }
  
  // 6. Validate path format
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

export const OpenCodeIgnore: Plugin = async ({ project, client, $, directory, worktree }) => {
  const projectRoot = worktree || directory
  
  return {
    // Phase 3: Native tools protection will be implemented here
  }
}
