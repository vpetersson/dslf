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
      min-height: 100dvh;
    }
    /* Fluid typography */
    h1 { font-size: clamp(1.75rem, 4vw, 2.5rem); }
    h2 { font-size: clamp(1.25rem, 3vw, 1.875rem); }
    .text-muted { color: var(--color-text-muted); }
    /* Enhanced focus states */
    :focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    .social-link, .custom-link {
      ${buttonStyles[resolved.buttonStyle]}
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .social-link:hover, .custom-link:hover {
      background: ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.15)"};
      border-color: var(--color-primary);
      box-shadow: 0 8px 25px ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(0, 0, 0, 0.3)"};
    }
    /* Active (pressed) states */
    .custom-link:active { transform: scale(0.98); }
    .social-link:active { transform: scale(0.95); }
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
    /* Avatar hover enhancement */
    .avatar-img {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .avatar-img:hover {
      transform: scale(1.05);
      box-shadow: 0 0 20px ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(203, 166, 247, 0.3)"};
    }
    /* Skip link for accessibility */
    .skip-link {
      position: absolute;
      left: 1rem;
      top: -100%;
      z-index: 50;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 500;
      background: var(--color-primary);
      color: ${isLight ? "#ffffff" : resolved.background};
      transition: top 0.2s ease-in-out;
    }
    .skip-link:focus { top: 1rem; }
  `;
}
