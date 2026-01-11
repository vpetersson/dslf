import { z } from "zod";

/**
 * Catppuccin theme presets
 * @see https://catppuccin.com/
 */
export const ThemePresets = ["mocha", "macchiato", "frappe", "latte"] as const;

// Theme configuration schema
export const ThemeSchema = z
  .object({
    preset: z.enum(ThemePresets).optional(),
    primary: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #8b5cf6)")
      .optional(),
    secondary: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #ec4899)")
      .optional(),
    background: z.enum(["gradient", "solid", "image"]).default("gradient"),
    backgroundValue: z.string().optional(),
    buttonStyle: z.enum(["glass", "solid", "outline"]).default("glass")
  })
  .optional();

// Profile configuration schema
export const ProfileSchema = z.object({
  name: z.string().min(1, "Profile name is required"),
  bio: z.string().min(1, "Profile bio is required"),
  avatar: z.string().url("Avatar must be a valid URL").optional(),
  type: z.enum(["person", "organization"]).default("person")
});

// Enhanced link schema (supports both simple and detailed format)
export const LinkSchema = z.object({
  title: z.string(),
  url: z.string().url("Link URL must be valid"),
  icon: z.string().optional(),
  description: z.string().optional(),
  highlight: z.boolean().optional()
});

// Footer configuration schema
export const FooterSchema = z
  .object({
    show_powered_by: z.boolean().default(true)
  })
  .optional();

// SEO configuration schema
export const SeoSchema = z
  .object({
    site_url: z
      .string()
      .url("Site URL must be a valid URL (e.g., https://example.com)")
      .optional()
  })
  .optional();

// Main configuration schema
// Note: Zod v4 requires both key and value schemas for z.record()
export const ConfigSchema = z.object({
  profile: ProfileSchema,
  theme: ThemeSchema,
  seo: SeoSchema,
  social: z.record(z.string(), z.string()).optional(),
  // Support both array of LinkSchema and simple Record<string, string>
  links: z
    .union([z.array(LinkSchema), z.record(z.string(), z.string())])
    .optional()
    .transform(links => {
      if (!links) {
        return undefined;
      }
      // If it's already an array, return as-is
      if (Array.isArray(links)) {
        return links;
      }
      // Convert Record<string, string> to array format
      return Object.entries(links)
        .filter(([_, url]) => url?.trim())
        .map(([title, url]) => ({ title, url }));
    }),
  footer: FooterSchema
});

// Infer TypeScript types from schemas
export type ThemeConfig = z.infer<typeof ThemeSchema>;
export type ProfileConfig = z.infer<typeof ProfileSchema>;
export type LinkConfig = z.infer<typeof LinkSchema>;
export type FooterConfig = z.infer<typeof FooterSchema>;
export type SeoConfig = z.infer<typeof SeoSchema>;
export type Config = z.infer<typeof ConfigSchema>;
