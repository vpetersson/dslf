/**
 * Theme generator using Catppuccin color palette
 * @see https://catppuccin.com/
 */

import type { ThemeConfig } from "../config/schema";

import { defaultTheme, themePresets, type ThemePreset } from "./presets";

export interface ResolvedTheme extends ThemePreset {
  buttonStyle: "glass" | "solid" | "outline";
  backgroundValue?: string;
}

/**
 * Resolve theme configuration to actual CSS values
 */
export function resolveTheme(theme?: ThemeConfig): ResolvedTheme {
  const preset = theme?.preset ? themePresets[theme.preset] : null;
  const base = preset ?? defaultTheme;

  return {
    ...base,
    primary: theme?.primary ?? base.primary,
    secondary: theme?.secondary ?? base.secondary,
    buttonStyle: theme?.buttonStyle ?? "glass",
    backgroundValue: theme?.backgroundValue
  };
}

/**
 * Generate CSS custom properties from Catppuccin theme
 */
export function generateThemeCSS(theme?: ThemeConfig): string {
  const resolved = resolveTheme(theme);

  // Determine if this is a light theme (latte)
  const isLight = theme?.preset === "latte";

  const buttonStyles = {
    glass: `
      background: ${isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.1)"};
      backdrop-filter: blur(8px);
      border: 1px solid ${resolved.overlay};
    `,
    solid: `
      background: var(--color-primary);
      border: none;
      color: ${isLight ? "#ffffff" : resolved.background};
    `,
    outline: `
      background: transparent;
      border: 2px solid var(--color-primary);
    `
  };

  // Handle custom background image
  let backgroundCSS = `background: ${resolved.background};`;
  if (resolved.backgroundValue) {
    if (theme?.background === "image") {
      backgroundCSS = `
        background: url('${resolved.backgroundValue}');
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
      `;
    } else {
      backgroundCSS = `background: ${resolved.backgroundValue};`;
    }
  }

  return `
    :root {
      --color-primary: ${resolved.primary};
      --color-secondary: ${resolved.secondary};
      --color-surface: ${resolved.surface};
      --color-overlay: ${resolved.overlay};
      --color-text: ${resolved.text};
      --color-text-muted: ${resolved.textMuted};
    }
    body {
      ${backgroundCSS}
      color: var(--color-text);
      font-family: 'Inter', sans-serif;
    }
    .text-muted { color: var(--color-text-muted); }
    .social-link, .custom-link {
      ${buttonStyles[resolved.buttonStyle]}
    }
    .social-link:hover, .custom-link:hover {
      background: ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.15)"};
      border-color: var(--color-primary);
      box-shadow: 0 8px 25px ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(0, 0, 0, 0.3)"};
    }
    .glass-effect {
      background: var(--color-surface);
      border: 1px solid var(--color-overlay);
    }
    .gradient-text {
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  `;
}
