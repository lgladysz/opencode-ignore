import type {Plugin} from "@opencode-ai/plugin"
import ignore from "ignore"
import {isPathValid} from "ignore"
import {join, isAbsolute, relative} from "path"

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
 *
 * The ignore library requires specific path format:
 * - Must be relative to project root (no absolute paths)
 * - No "./" prefix (must be clean like "src/file.ts")
 * - Use forward slashes (Win32 backslashes converted)
 * - Directories need trailing "/" for proper matching
 *
 * @param targetPath - Path to normalize (absolute or relative)
 * @param projectRoot - Absolute path to project root
 * @param isDirectory - Whether the path represents a directory
 * @returns Normalized relative path ready for ignore library
 * @throws Error if resulting path format is invalid
 */
function normalizePath(targetPath: string, projectRoot: string, isDirectory: boolean): string {
  // Step 1: Convert to absolute if needed (handles relative paths)
  const absolutePath = isAbsolute(targetPath) ? targetPath : join(projectRoot, targetPath)
  
  // Step 2: Make relative to project root
  const relativePath = relative(projectRoot, absolutePath)
  
  // Step 3: Handle empty path (project root itself)
  const resolvedPath = relativePath === "" ? "." : relativePath
  
  // Step 4: Normalize separators (Win32 backslashes → forward slashes)
  const normalizedPath = resolvedPath.replace(/\\/g, "/")
  
  // Step 5: Remove "./" prefix (critical - ignore library requirement)
  const withoutPrefixPath = normalizedPath.startsWith("./") ? normalizedPath.slice(2) : normalizedPath
  
  // Step 6: Add trailing "/" for directories (except project root)
  // This ensures directory patterns match correctly (e.g., "src/" vs "src")
  const withSlashPath = isDirectory && withoutPrefixPath !== "." && !withoutPrefixPath.endsWith("/")
    ? withoutPrefixPath + "/"
    : withoutPrefixPath
  
  // Step 7: Validate path format using ignore library validator
  if (!isPathValid(withSlashPath)) {
    throw new Error(`Invalid path format: ${withSlashPath}`)
  }
  
  return withSlashPath
}

/**
 * Check if a path should be blocked by .ignore patterns
 *
 * @param targetPath - Path to check (absolute or relative)
 * @param projectRoot - Absolute path to project root
 * @param isDirectory - Whether the path represents a directory
 * @returns true if path matches ignore patterns (should be blocked), false otherwise
 */
async function isPathBlocked(targetPath: string, projectRoot: string, isDirectory: boolean): Promise<boolean> {
  // Load .ignore file (returns null if missing - graceful degradation)
  const ignoreLib = await loadIgnore(projectRoot)
  if (!ignoreLib) return false // No .ignore file = allow all access
  
  // Normalize path to format required by ignore library
  const normalizedPath = normalizePath(targetPath, projectRoot, isDirectory)
  
  // Check if path matches any ignore pattern
  return ignoreLib.ignores(normalizedPath)
}

/**
 * Filter glob tool results to remove blocked files
 * 
 * @param result - Original glob result object
 * @param ignoreLib - Ignore instance with loaded patterns
 * @param projectRoot - Absolute path to project root
 * @returns Filtered result with blocked files removed
 */
function filterGlobResults(
  result: any,
  ignoreLib: ReturnType<typeof ignore>,
  projectRoot: string
): any {
  if (!result?.files || !Array.isArray(result.files)) return result
  
  const filteredFiles = result.files.filter((filePath: string) => {
    try {
      const normalized = normalizePath(filePath, projectRoot, false)
      return !ignoreLib.ignores(normalized)
    } catch {
      // If normalization fails, filter out the file (safer approach)
      return false
    }
  })
  
  return { ...result, files: filteredFiles }
}

/**
 * Filter grep tool results to remove matches from blocked files
 * 
 * @param result - Original grep result object
 * @param ignoreLib - Ignore instance with loaded patterns
 * @param projectRoot - Absolute path to project root
 * @returns Filtered result with matches from blocked files removed
 */
function filterGrepResults(
  result: any,
  ignoreLib: ReturnType<typeof ignore>,
  projectRoot: string
): any {
  if (!result?.matches || !Array.isArray(result.matches)) return result
  
  const filteredMatches = result.matches.filter((match: any) => {
    if (!match?.file) return true  // Keep matches without file info
    
    try {
      const normalized = normalizePath(match.file, projectRoot, false)
      return !ignoreLib.ignores(normalized)
    } catch {
      // If normalization fails, filter out the match (safer approach)
      return false
    }
  })
  
  return { ...result, matches: filteredMatches }
}

/**
 * Filter tool results to remove paths blocked by .ignore patterns
 * Used in post-execution hook to prevent glob/grep from exposing sensitive files
 *
 * @param tool - Tool name (glob or grep)
 * @param result - Original tool result
 * @param projectRoot - Absolute path to project root
 * @returns Filtered result with blocked paths removed
 */
async function filterResults(
  tool: string,
  result: any,
  projectRoot: string
): Promise<any> {
  // Only filter glob and grep tools
  if (tool !== "glob" && tool !== "grep") return result
  
  // Load ignore patterns
  const ignoreLib = await loadIgnore(projectRoot)
  if (!ignoreLib) return result  // No filtering if no .ignore
  
  // Filter based on tool type
  if (tool === "glob") {
    return filterGlobResults(result, ignoreLib, projectRoot)
  }
  
  if (tool === "grep") {
    return filterGrepResults(result, ignoreLib, projectRoot)
  }
  
  return result
}

interface PathInfo {
  path: string
  isDirectory: boolean
}

/**
 * Extract path and type from tool arguments
 *
 * Maps OpenCode native tools to their path arguments and determines
 * if they operate on files or directories. This is critical for
 * proper ignore pattern matching (directories need trailing slash).
 *
 * Supported tools:
 * - File operations: read, write, edit (args.filePath)
 * - Search operations: glob, grep (args.path, defaults to ".")
 * - List operations: list (args.path, defaults to ".")
 *
 * @param tool - Tool name
 * @param args - Tool arguments object
 * @returns PathInfo with path and directory flag, or null if tool unsupported
 */
function extractPathFromTool(tool: string, args: Record<string, unknown>): PathInfo | null {
  // File operations - operate on individual files
  if (tool === "read") return args.filePath ? {path: args.filePath as string, isDirectory: false} : null
  if (tool === "write") return args.filePath ? {path: args.filePath as string, isDirectory: false} : null
  if (tool === "edit") return args.filePath ? {path: args.filePath as string, isDirectory: false} : null
  
  // Directory operations - search/list within directories
  // Default to "." (project root) if path not specified
  if (tool === "glob") return {path: (args.path as string) || ".", isDirectory: true}
  if (tool === "grep") return {path: (args.path as string) || ".", isDirectory: true}
  if (tool === "list") return {path: (args.path as string) || ".", isDirectory: true}
  
  // Unknown tool - no path checking needed
  return null
}

/**
 * OpenCode plugin to restrict AI access using .ignore patterns
 *
 * Intercepts native OpenCode tools (read, write, edit, glob, grep, list)
 * and blocks access to paths matching patterns in .ignore file.
 *
 * Features:
 * - Gitignore-style patterns via ignore library
 * - Graceful degradation if .ignore missing
 * - Project root (.) always accessible
 *
 * @example
 * // .ignore file
 * /secrets/**
 * *.key
 * !config.local.json
 *
 * @param context - OpenCode plugin context
 * @param context.directory - Project directory path
 * @param context.worktree - Git worktree path (preferred over directory)
 * @returns Plugin hooks object
 */
export const OpenCodeIgnore: Plugin = async ({project, client, $, directory, worktree}) => {
  // Prefer worktree (git root) over directory for multi-worktree repos
  const projectRoot = worktree || directory
  
  return {
    /**
     * Hook that runs before any tool execution
     * Checks if tool's target path is blocked by .ignore patterns
     */
    "tool.execute.before": async ({tool}, {args}) => {
      const pathInfo = extractPathFromTool(tool, args)
      
      // Skip tools that don't operate on paths
      if (!pathInfo) return
      
      // Always allow project root to prevent blocking entire project
      if (pathInfo.path === ".") return
      
      // Check if path matches any ignore pattern
      if (await isPathBlocked(pathInfo.path, projectRoot, pathInfo.isDirectory)) {
        throw new Error(`Access denied: ${pathInfo.path} blocked by ignore file. Do NOT try to read this. Access restricted.`)
      }
    },
    
    /**
     * Hook that runs after tool execution
     * Filters glob/grep results to remove blocked files
     */
    "tool.execute.after": async ({tool}, context) => {
      // Only process glob and grep tools
      if (tool !== "glob" && tool !== "grep") return context.output
      
      // Filter results to remove blocked files
      return await filterResults(tool, context.output, projectRoot)
    }
  }
}
