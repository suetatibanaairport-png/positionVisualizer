/**
 * Configuration loader for LeverApp
 * Searches for config.json in multiple locations and loads it
 */

import fs from 'fs';
import path from 'path';

/**
 * Load configuration from config.json
 * Search paths (in order):
 * 1. ./config.json (current directory)
 * 2. ../config.json (parent directory)
 * 3. ../../config.json (grandparent directory)
 * 4. [execPath]/config.json (relative to executable in pkg/Bun builds)
 * 5. [execPath]/../config.json
 * 6. [execPath]/../../config.json
 *
 * @returns {Object} Configuration object, or {} if not found
 */
export function loadConfig() {
  const searchPaths = [
    path.join(process.cwd(), 'config.json'),
    path.join(process.cwd(), '..', 'config.json'),
    path.join(process.cwd(), '..', '..', 'config.json'),
  ];

  // For compiled binaries (pkg/Bun), also search relative to executable
  if (process.execPath) {
    const execDir = path.dirname(process.execPath);
    searchPaths.push(
      path.join(execDir, 'config.json'),
      path.join(execDir, '..', 'config.json'),
      path.join(execDir, '..', '..', 'config.json')
    );
  }

  for (const configPath of searchPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        console.log(`[Config] Loaded from: ${configPath}`);
        return config;
      } catch (error) {
        console.error(`[Config] Failed to parse ${configPath}: ${error.message}`);
      }
    }
  }

  console.log('[Config] No config.json found, using defaults');
  return {};
}
