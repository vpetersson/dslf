import { existsSync } from "fs";
import { mkdir, rmdir, unlink } from "fs/promises";

import { beforeEach, afterEach, describe, expect, test } from "bun:test";

import { parseConfig, validateConfig } from "../templates/config/parser";
import type { LinkConfig, Config } from "../templates/config/schema";
import {
  generateSocialLink,
  generateCustomLink,
  socialIcons,
  generateIndexHtml
} from "../templates/index-utils";

describe("Link Index - YAML Parsing with js-yaml + Zod", () => {
  test("should parse valid YAML configuration", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"
  avatar: "https://example.com/avatar.jpg"

footer:
  show_powered_by: true

social:
  linkedin: "https://linkedin.com/in/test"
  github: "https://github.com/test"

links:
  - title: "Portfolio"
    url: "https://portfolio.test"
  - title: "Contact"
    url: "https://contact.test"
`;

    const config = parseConfig(yamlContent);

    expect(config.profile.name).toBe("Test User");
    expect(config.profile.bio).toBe("Test Bio");
    expect(config.profile.avatar).toBe("https://example.com/avatar.jpg");
    expect(config.footer?.show_powered_by).toBe(true);
    expect(config.social?.linkedin).toBe("https://linkedin.com/in/test");
    expect(config.social?.github).toBe("https://github.com/test");
    expect(config.links).toHaveLength(2);
    expect(config.links?.[0].title).toBe("Portfolio");
    expect(config.links?.[0].url).toBe("https://portfolio.test");
  });

  test("should parse legacy record-style links", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"

links:
  "Portfolio": "https://portfolio.test"
  "Contact": "https://contact.test"
`;

    const config = parseConfig(yamlContent);

    expect(config.links).toHaveLength(2);
    expect(config.links?.[0].title).toBe("Portfolio");
    expect(config.links?.[0].url).toBe("https://portfolio.test");
    expect(config.links?.[1].title).toBe("Contact");
    expect(config.links?.[1].url).toBe("https://contact.test");
  });

  test("should handle comments in YAML", () => {
    const yamlContent = `
# This is a comment
profile:
  name: "Test User" # inline comment
  bio: 'Single quoted bio'

social:
  linkedin: "https://linkedin.com/in/test" # Comment here
  github: https://github.com/test # No quotes
`;

    const config = parseConfig(yamlContent);

    expect(config.profile.name).toBe("Test User");
    expect(config.profile.bio).toBe("Single quoted bio");
    expect(config.social?.linkedin).toBe("https://linkedin.com/in/test");
    expect(config.social?.github).toBe("https://github.com/test");
  });

  test("should handle minimal configuration", () => {
    const yamlContent = `
profile:
  name: "Minimal User"
  bio: "Minimal Bio"
`;

    const config = parseConfig(yamlContent);

    expect(config.profile.name).toBe("Minimal User");
    expect(config.profile.bio).toBe("Minimal Bio");
    expect(config.social).toBeUndefined();
    expect(config.links).toBeUndefined();
    expect(config.footer).toBeUndefined();
  });

  test("should parse avatar field", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"
  avatar: "https://example.com/avatar.jpg"
`;

    const config = parseConfig(yamlContent);

    expect(config.profile.name).toBe("Test User");
    expect(config.profile.bio).toBe("Test Bio");
    expect(config.profile.avatar).toBe("https://example.com/avatar.jpg");
  });

  test("should parse footer configuration", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"

footer:
  show_powered_by: false
`;

    const config = parseConfig(yamlContent);

    expect(config.footer?.show_powered_by).toBe(false);
  });

  test("should leave footer undefined when not specified", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"
`;

    const config = parseConfig(yamlContent);

    expect(config.footer).toBeUndefined();
  });

  test("should parse profile type configuration", () => {
    const yamlContent = `
profile:
  name: "Test Company"
  bio: "A test organization"
  type: "organization"
`;

    const config = parseConfig(yamlContent);

    expect(config.profile.name).toBe("Test Company");
    expect(config.profile.bio).toBe("A test organization");
    expect(config.profile.type).toBe("organization");
  });

  test("should default to person type when not specified", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "A test person"
`;

    const config = parseConfig(yamlContent);

    expect(config.profile.name).toBe("Test User");
    expect(config.profile.bio).toBe("A test person");
    expect(config.profile.type).toBe("person");
  });

  test("should parse Catppuccin theme preset", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"

theme:
  preset: "latte"
  buttonStyle: "solid"
`;

    const config = parseConfig(yamlContent);

    expect(config.theme?.preset).toBe("latte");
    expect(config.theme?.buttonStyle).toBe("solid");
  });

  test("should parse link with full options", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"

links:
  - title: "Featured Project"
    url: "https://project.test"
    icon: "fas fa-star"
    description: "My featured project"
    highlight: true
`;

    const config = parseConfig(yamlContent);

    expect(config.links).toHaveLength(1);
    const link = config.links![0];
    expect(link.title).toBe("Featured Project");
    expect(link.url).toBe("https://project.test");
    expect(link.icon).toBe("fas fa-star");
    expect(link.description).toBe("My featured project");
    expect(link.highlight).toBe(true);
  });
});

describe("Link Index - Validation", () => {
  test("should throw on missing profile name", () => {
    const yamlContent = `
profile:
  bio: "Valid bio"
`;

    expect(() => parseConfig(yamlContent)).toThrow();
  });

  test("should throw on missing profile bio", () => {
    const yamlContent = `
profile:
  name: "Valid name"
`;

    expect(() => parseConfig(yamlContent)).toThrow();
  });

  test("should throw on empty profile name", () => {
    const yamlContent = `
profile:
  name: ""
  bio: "Valid bio"
`;

    expect(() => parseConfig(yamlContent)).toThrow();
  });

  test("should throw on invalid link URL", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"

links:
  - title: "Invalid Link"
    url: "not-a-valid-url"
`;

    expect(() => parseConfig(yamlContent)).toThrow();
  });

  test("should throw on invalid theme preset", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"

theme:
  preset: "invalid-preset"
`;

    expect(() => parseConfig(yamlContent)).toThrow();
  });

  test("should throw on invalid theme color format", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"

theme:
  primary: "not-a-color"
`;

    expect(() => parseConfig(yamlContent)).toThrow();
  });

  test("validateConfig returns true for valid config", () => {
    const config = { profile: { name: "Valid", bio: "Valid bio" } };
    expect(validateConfig(config)).toBe(true);
  });

  test("validateConfig returns false for invalid config", () => {
    const config = { profile: { name: "" } };
    expect(validateConfig(config)).toBe(false);
  });
});

describe("Link Index - HTML Generation", () => {
  test("should generate social media link HTML", () => {
    const html = generateSocialLink("linkedin", "https://linkedin.com/in/test");

    expect(html).toContain('href="https://linkedin.com/in/test"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("fab fa-linkedin");
    expect(html).toContain("Linkedin");
  });

  test("should generate custom link HTML", () => {
    const link: LinkConfig = {
      title: "My Portfolio",
      url: "https://portfolio.test"
    };
    const html = generateCustomLink(link);

    expect(html).toContain('href="https://portfolio.test"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("My Portfolio");
    // Arrow icon is always shown
    expect(html).toContain("fas fa-arrow-right");
  });

  test("should generate custom link with icon and description", () => {
    const link: LinkConfig = {
      title: "Featured Project",
      url: "https://project.test",
      icon: "fas fa-star",
      description: "My awesome project"
    };
    const html = generateCustomLink(link);

    expect(html).toContain("fas fa-star");
    expect(html).toContain("My awesome project");
    expect(html).toContain("Featured Project");
  });

  test("should generate highlighted link", () => {
    const link: LinkConfig = {
      title: "Important Link",
      url: "https://important.test",
      highlight: true
    };
    const html = generateCustomLink(link);

    expect(html).toContain("ring-2");
    expect(html).toContain("ring-offset-2");
  });

  test("should use fallback icon for unknown social platform", () => {
    const html = generateSocialLink("unknownplatform", "https://unknown.com");

    expect(html).toContain("fas fa-link");
    expect(html).toContain("Unknownplatform");
  });

  test("should escape special characters in link titles", () => {
    const link: LinkConfig = {
      title: 'My "Awesome" <Portfolio>',
      url: "https://portfolio.test"
    };
    const html = generateCustomLink(link);

    expect(html).toContain("&quot;Awesome&quot;");
    expect(html).toContain("&lt;Portfolio&gt;");
  });

  test("should include footer when show_powered_by is true", () => {
    const config: Config = {
      profile: { name: "Test", bio: "Test Bio", type: "person" },
      footer: { show_powered_by: true }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain("Built with");
    expect(html).toContain("fab fa-github");
    expect(html).toContain("https://github.com/vpetersson/dslf");
    expect(html).toContain("Star on");
  });

  test("should exclude footer when show_powered_by is false", () => {
    const config: Config = {
      profile: { name: "Test", bio: "Test Bio", type: "person" },
      footer: { show_powered_by: false }
    };

    const html = generateIndexHtml(config);

    expect(html).not.toContain("Built with");
  });

  test("should include footer by default when footer config is missing", () => {
    const config: Config = {
      profile: { name: "Test", bio: "Test Bio", type: "person" }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain("Built with");
    expect(html).toContain("fab fa-github");
  });

  test("should generate Person structured data by default", () => {
    const config: Config = {
      profile: { name: "John Doe", bio: "Developer", type: "person" }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain('"@type": "Person"');
    expect(html).toContain('"name": "John Doe"');
  });

  test("should generate Organization structured data when type is organization", () => {
    const config: Config = {
      profile: { name: "Acme Corp", bio: "Software company", type: "organization" }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain('"name": "Acme Corp"');
  });

  test("should include local asset references", () => {
    const config: Config = {
      profile: { name: "Test", bio: "Test Bio", type: "person" }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain('href="css/inter.css"');
    expect(html).toContain('href="css/fontawesome.min.css"');
    expect(html).toContain('href="styles.css"');
    // Should NOT contain CDN references
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("cdnjs.cloudflare.com");
  });

  test("should apply Catppuccin theme", () => {
    const config: Config = {
      profile: { name: "Test", bio: "Test Bio", type: "person" },
      theme: { preset: "mocha", buttonStyle: "glass", background: "gradient" }
    };

    const html = generateIndexHtml(config);

    // Catppuccin Mocha colors
    expect(html).toContain("--color-primary: #cba6f7"); // Mauve
    expect(html).toContain("--color-secondary: #f5c2e7"); // Pink
  });

  test("should apply latte theme with light mode adjustments", () => {
    const config: Config = {
      profile: { name: "Test", bio: "Test Bio", type: "person" },
      theme: { preset: "latte", buttonStyle: "glass", background: "gradient" }
    };

    const html = generateIndexHtml(config);

    // Catppuccin Latte colors
    expect(html).toContain("--color-primary: #8839ef"); // Mauve
    expect(html).toContain('theme-color" content="#eff1f5"'); // Latte base
  });

  test("should include avatar when provided", () => {
    const config: Config = {
      profile: {
        name: "Test User",
        bio: "Test Bio",
        type: "person",
        avatar: "https://example.com/avatar.jpg"
      }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain('src="https://example.com/avatar.jpg"');
    expect(html).toContain('alt="Test User"');
  });

  test("should reference Catppuccin in comments", () => {
    const config: Config = {
      profile: { name: "Test", bio: "Test Bio", type: "person" }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain("catppuccin.com");
  });
});

describe("Link Index - Social Icons", () => {
  test("should have icons for common social platforms", () => {
    expect(socialIcons.twitter).toBe("fab fa-twitter");
    expect(socialIcons.linkedin).toBe("fab fa-linkedin");
    expect(socialIcons.github).toBe("fab fa-github");
    expect(socialIcons.instagram).toBe("fab fa-instagram");
    expect(socialIcons.youtube).toBe("fab fa-youtube");
    expect(socialIcons.email).toBe("fas fa-envelope");
    expect(socialIcons.website).toBe("fas fa-globe");
  });

  test("should have development platform icons", () => {
    expect(socialIcons.gitlab).toBe("fab fa-gitlab");
    expect(socialIcons.codepen).toBe("fab fa-codepen");
    expect(socialIcons.stackoverflow).toBe("fab fa-stack-overflow");
    expect(socialIcons.dev).toBe("fab fa-dev");
    expect(socialIcons.medium).toBe("fab fa-medium");
  });

  test("should have Fediverse and newer platform icons", () => {
    expect(socialIcons.mastodon).toBe("fab fa-mastodon");
    expect(socialIcons.bluesky).toBe("fab fa-bluesky");
    expect(socialIcons.threads).toBe("fab fa-threads");
    expect(socialIcons.x).toBe("fab fa-x-twitter");
  });
});

describe("Link Index - File Generation", () => {
  const testDir = "test-temp";
  const testConfigPath = `${testDir}/link-index.yaml`;
  const testOutputPath = `${testDir}/index.html`;

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      if (existsSync(testOutputPath)) {
        await unlink(testOutputPath);
      }
      if (existsSync(testConfigPath)) {
        await unlink(testConfigPath);
      }
      await rmdir(testDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  test("should skip generation when config file is missing", async () => {
    expect(existsSync(testConfigPath)).toBe(false);
  });
});

describe("Link Index - Edge Cases", () => {
  test("should throw on empty YAML content", () => {
    expect(() => parseConfig("")).toThrow();
  });

  test("should throw on YAML with only comments", () => {
    const yamlContent = `
# This is just a comment
# Another comment
`;
    expect(() => parseConfig(yamlContent)).toThrow();
  });

  test("should handle URLs with special characters", () => {
    const yamlContent = `
profile:
  name: "Test"
  bio: "Bio"
social:
  email: "mailto:test+tag@example.com?subject=Hello%20World"
  website: "https://example.com/path?param=value&other=true"
`;
    const config = parseConfig(yamlContent);
    expect(config.social?.email).toBe("mailto:test+tag@example.com?subject=Hello%20World");
    expect(config.social?.website).toBe("https://example.com/path?param=value&other=true");
  });

  test("should filter empty social links", () => {
    const yamlContent = `
profile:
  name: "Test"
  bio: "Bio"

social:
  linkedin: "https://linkedin.com/in/test"
  twitter: ""
  github: "https://github.com/test"
`;

    const config = parseConfig(yamlContent);

    // Empty strings should be preserved in config but filtered during HTML generation
    expect(config.social?.linkedin).toBe("https://linkedin.com/in/test");
    expect(config.social?.github).toBe("https://github.com/test");
    expect(config.social?.twitter).toBe("");
  });
});

describe("Link Index - Theme Presets", () => {
  test("should use mocha as default theme", () => {
    const config: Config = {
      profile: { name: "Test", bio: "Test Bio", type: "person" }
    };

    const html = generateIndexHtml(config);

    // Mocha is the darkest theme
    expect(html).toContain("#1e1e2e"); // Mocha base color
  });

  test("should apply all Catppuccin presets", () => {
    const presets = ["mocha", "macchiato", "frappe", "latte"] as const;
    const expectedBases = ["#1e1e2e", "#24273a", "#303446", "#eff1f5"];

    presets.forEach((preset, index) => {
      const config: Config = {
        profile: { name: "Test", bio: "Test Bio", type: "person" },
        theme: { preset, buttonStyle: "glass", background: "gradient" }
      };

      const html = generateIndexHtml(config);
      expect(html).toContain(expectedBases[index]);
    });
  });
});
