/**
 * Theme presets based on Catppuccin color palette
 * @see https://catppuccin.com/
 *
 * Catppuccin is a community-driven pastel theme with 4 flavors:
 * - Latte: Light theme
 * - Frappé: Medium-dark theme
 * - Macchiato: Darker theme
 * - Mocha: Darkest theme
 */

export interface ThemePreset {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  overlay: string;
}

// Catppuccin Mocha (darkest) - Default
const mocha: ThemePreset = {
  primary: "#cba6f7", // Mauve
  secondary: "#f5c2e7", // Pink
  background: "#1e1e2e", // Base
  surface: "#313244", // Surface0
  text: "#cdd6f4", // Text
  textMuted: "#a6adc8", // Subtext0
  overlay: "#45475a" // Surface1
};

// Catppuccin Macchiato
const macchiato: ThemePreset = {
  primary: "#c6a0f6", // Mauve
  secondary: "#f5bde6", // Pink
  background: "#24273a", // Base
  surface: "#363a4f", // Surface0
  text: "#cad3f5", // Text
  textMuted: "#a5adcb", // Subtext0
  overlay: "#494d64" // Surface1
};

// Catppuccin Frappé
const frappe: ThemePreset = {
  primary: "#ca9ee6", // Mauve
  secondary: "#f4b8e4", // Pink
  background: "#303446", // Base
  surface: "#414559", // Surface0
  text: "#c6d0f5", // Text
  textMuted: "#a5adce", // Subtext0
  overlay: "#51576d" // Surface1
};

// Catppuccin Latte (light theme)
const latte: ThemePreset = {
  primary: "#8839ef", // Mauve
  secondary: "#ea76cb", // Pink
  background: "#eff1f5", // Base
  surface: "#ccd0da", // Surface0
  text: "#4c4f69", // Text
  textMuted: "#6c6f85", // Subtext0
  overlay: "#bcc0cc" // Surface1
};

export const themePresets: Record<string, ThemePreset> = {
  mocha,
  macchiato,
  frappe,
  latte
};

export const defaultTheme = themePresets.mocha;
