// Named import, not default: js-yaml 5 dropped the default export, and this is
// the form that works on both 4 and 5.
import { load as loadYaml } from "js-yaml";

import { ConfigSchema, type Config } from "./schema";

/**
 * Parse and validate YAML configuration
 * @param yamlContent - Raw YAML string
 * @returns Validated configuration object
 * @throws Error with detailed validation messages
 */
export function parseConfig(yamlContent: string): Config {
  // Parse YAML to object
  let raw: unknown;
  try {
    raw = loadYaml(yamlContent);
  } catch (error) {
    const yamlError = error as Error;
    throw new Error(`YAML parsing error: ${yamlError.message}`);
  }

  // Validate with Zod schema
  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.errors
      .map(e => {
        const path = e.path.length > 0 ? e.path.join(".") : "root";
        return `  - ${path}: ${e.message}`;
      })
      .join("\n");
    throw new Error(`Invalid configuration:\n${errors}`);
  }

  return result.data;
}

/**
 * Validate that a config object is valid (for testing)
 * @param config - Configuration object to validate
 * @returns true if valid, false otherwise
 */
export function validateConfig(config: unknown): config is Config {
  return ConfigSchema.safeParse(config).success;
}
