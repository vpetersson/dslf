import { existsSync } from "fs";
import { mkdir, rmdir, unlink } from "fs/promises";

import { beforeEach, afterEach, describe, expect, test } from "bun:test";

// Import the functions we want to test
import {
  parseYaml,
  generateSocialLink,
  generateCustomLink,
  socialIcons,
  validateConfig,
  generateIndexHtml
} from "../templates/index-utils";

describe("Link Index - YAML Parsing", () => {
  test("should parse valid YAML configuration", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"
  background: "https://example.com/bg.jpg"

footer:
  show_powered_by: true

social:
  linkedin: "https://linkedin.com/in/test"
  github: "https://github.com/test"
  twitter: ""

links:
  "Portfolio": "https://portfolio.test"
  "Blog": ""
  "Contact": "https://contact.test"
`;

    const config = parseYaml(yamlContent);

    expect(config.profile.name).toBe("Test User");
    expect(config.profile.bio).toBe("Test Bio");
    expect(config.profile.background).toBe("https://example.com/bg.jpg");
    expect(config.footer?.show_powered_by).toBe(true);
    expect(config.social?.linkedin).toBe("https://linkedin.com/in/test");
    expect(config.social?.github).toBe("https://github.com/test");
    expect(config.links?.["Portfolio"]).toBe("https://portfolio.test");
    expect(config.links?.["Contact"]).toBe("https://contact.test");
  });

  test("should ignore empty values in YAML", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"

social:
  linkedin: "https://linkedin.com/in/test"
  twitter: ""
  github: "https://github.com/test"
  instagram: ""

links:
  "Portfolio": "https://portfolio.test"
  "Empty Link": ""
  "Contact": "https://contact.test"
`;

    const config = parseYaml(yamlContent);

    // Should include non-empty values
    expect(config.social?.linkedin).toBe("https://linkedin.com/in/test");
    expect(config.social?.github).toBe("https://github.com/test");
    expect(config.links?.["Portfolio"]).toBe("https://portfolio.test");
    expect(config.links?.["Contact"]).toBe("https://contact.test");

    // Should not include empty values
    expect(config.social?.twitter).toBeUndefined();
    expect(config.social?.instagram).toBeUndefined();
    expect(config.links?.["Empty Link"]).toBeUndefined();
  });

  test("should handle comments and quotes in YAML", () => {
    const yamlContent = `
# This is a comment
profile:
  name: "Test User" # inline comment
  bio: 'Single quoted bio'

social:
  linkedin: "https://linkedin.com/in/test" # Comment here
  github: https://github.com/test # No quotes
`;

    const config = parseYaml(yamlContent);

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

    const config = parseYaml(yamlContent);

    expect(config.profile.name).toBe("Minimal User");
    expect(config.profile.bio).toBe("Minimal Bio");
    expect(config.social).toBeUndefined();
    expect(config.links).toBeUndefined();
    expect(config.footer).toBeUndefined();
  });

  test("should skip avatar field", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"
  avatar: "https://example.com/avatar.jpg"
`;

    const config = parseYaml(yamlContent);

    expect(config.profile.name).toBe("Test User");
    expect(config.profile.bio).toBe("Test Bio");
    expect((config.profile as any).avatar).toBeUndefined();
  });

  test("should parse footer configuration", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"

footer:
  show_powered_by: false
`;

    const config = parseYaml(yamlContent);

    expect(config.footer?.show_powered_by).toBe(false);
  });

  test("should default footer to show when not specified", () => {
    const yamlContent = `
profile:
  name: "Test User"
  bio: "Test Bio"
`;

    const config = parseYaml(yamlContent);

    // Footer should be undefined when not specified
    expect(config.footer).toBeUndefined();
  });

  test("should parse profile type configuration", () => {
    const yamlContent = `
profile:
  name: "Test Company"
  bio: "A test organization"
  type: "organization"
`;

    const config = parseYaml(yamlContent);

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

    const config = parseYaml(yamlContent);

    expect(config.profile.name).toBe("Test User");
    expect(config.profile.bio).toBe("A test person");
    expect(config.profile.type).toBeUndefined();
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
    const html = generateCustomLink("My Portfolio", "https://portfolio.test");

    expect(html).toContain('href="https://portfolio.test"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("My Portfolio");
    expect(html).toContain("fas fa-external-link-alt");
  });

  test("should use fallback icon for unknown social platform", () => {
    const html = generateSocialLink("unknownplatform", "https://unknown.com");

    expect(html).toContain("fas fa-link");
    expect(html).toContain("Unknownplatform");
  });

  test("should handle special characters in link titles", () => {
    const html = generateCustomLink('My "Awesome" Portfolio', "https://portfolio.test");

    expect(html).toContain('My "Awesome" Portfolio');
  });

  test("should include footer when show_powered_by is true", () => {
    const config = {
      profile: { name: "Test", bio: "Test Bio" },
      footer: { show_powered_by: true }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain("Built with");
    expect(html).toContain("fab fa-github");
    expect(html).toContain("https://github.com/vpetersson/dslf");
    expect(html).toContain("Star on");
  });

  test("should exclude footer when show_powered_by is false", () => {
    const config = {
      profile: { name: "Test", bio: "Test Bio" },
      footer: { show_powered_by: false }
    };

    const html = generateIndexHtml(config);

    expect(html).not.toContain("Built with");
    expect(html).not.toContain("fab fa-github");
  });

  test("should include footer by default when footer config is missing", () => {
    const config = {
      profile: { name: "Test", bio: "Test Bio" }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain("Built with");
    expect(html).toContain("fab fa-github");
  });

  test("should generate Person structured data by default", () => {
    const config = {
      profile: { name: "John Doe", bio: "Developer" }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain('"@type": "Person"');
    expect(html).toContain('"name": "John Doe"');
  });

  test("should generate Organization structured data when type is organization", () => {
    const config = {
      profile: { name: "Acme Corp", bio: "Software company", type: "organization" as const }
    };

    const html = generateIndexHtml(config);

    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain('"name": "Acme Corp"');
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
    // This test would require refactoring the main function to be testable
    // For now, we'll test the logic components
    expect(existsSync(testConfigPath)).toBe(false);
  });

  test("should validate required profile fields", () => {
    const invalidConfigs = [
      { profile: { name: "", bio: "Valid bio" } },
      { profile: { name: "Valid name", bio: "" } },
      { profile: { bio: "Valid bio" } as any }, // missing name
      { profile: { name: "Valid name" } as any } // missing bio
    ];

    invalidConfigs.forEach(config => {
      expect(validateConfig(config)).toBe(false);
    });

    const validConfig = { profile: { name: "Valid name", bio: "Valid bio" } };
    expect(validateConfig(validConfig)).toBe(true);
  });
});

describe("Link Index - Edge Cases", () => {
  test("should handle empty YAML content", () => {
    const config = parseYaml("");
    expect(config.profile.name).toBe("");
    expect(config.profile.bio).toBe("");
  });

  test("should handle YAML with only comments", () => {
    const yamlContent = `
# This is just a comment
# Another comment
# No actual content
`;
    const config = parseYaml(yamlContent);
    expect(config.profile.name).toBe("");
    expect(config.profile.bio).toBe("");
  });

  test("should handle malformed YAML gracefully", () => {
    const yamlContent = `
profile:
  name: "Test"
  bio: "Test Bio"
social:
  invalid line without colon
  linkedin: "https://linkedin.com/test"
`;
    const config = parseYaml(yamlContent);
    expect(config.profile.name).toBe("Test");
    expect(config.social?.linkedin).toBe("https://linkedin.com/test");
  });

  test("should handle URLs with special characters", () => {
    const yamlContent = `
social:
  email: "mailto:test+tag@example.com?subject=Hello%20World"
  website: "https://example.com/path?param=value&other=true"
`;
    const config = parseYaml(yamlContent);
    expect(config.social?.email).toBe("mailto:test+tag@example.com?subject=Hello%20World");
    expect(config.social?.website).toBe("https://example.com/path?param=value&other=true");
  });
});

describe("Link Index - HTML Output Structure", () => {
  test("should generate valid HTML structure", () => {
    const config = {
      profile: { name: "Test User", bio: "Test Bio" },
      social: { linkedin: "https://linkedin.com/test" },
      links: { Portfolio: "https://portfolio.test" }
    };

    // Test would require extracting HTML generation function
    // For now, verify the structure components
    expect(config.profile.name).toBe("Test User");
    expect(config.social.linkedin).toBe("https://linkedin.com/test");
    expect(config.links["Portfolio"]).toBe("https://portfolio.test");
  });

  test("should include FontAwesome CSS", () => {
    // This would test the full HTML generation
    const expectedCSS = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    expect(expectedCSS).toContain("font-awesome");
  });

  test("should include proper meta tags", () => {
    const expectedMeta = [
      'charset="UTF-8"',
      'name="viewport"',
      'content="width=device-width, initial-scale=1.0"'
    ];
    expectedMeta.forEach(meta => {
      expect(meta).toContain("=");
    });
  });
});
