export interface FrontmatterData {
  [key: string]: string;
}

export interface ParsedFrontmatter {
  data: FrontmatterData & { title: string; description: string; sector?: string; icon?: string };
  content: string;
}

/**
 * Simple YAML frontmatter parser that works in the browser.
 * Parses frontmatter delimited by --- at the start of markdown files.
 */
export const parseYamlFrontmatter = (content: string): ParsedFrontmatter => {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      data: { title: "Untitled", description: "" },
      content: content,
    };
  }

  const yamlContent = match[1];
  const markdownContent = match[2];

  // Simple YAML key-value parser for frontmatter
  const data: Record<string, string> = {};
  const lines = yamlContent.split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      data[key] = value;
    }
  }

  return {
    data: {
      ...data,
      title: data.title || "Untitled",
      description: data.description || "",
      sector: data.sector,
      icon: data.icon,
    },
    content: markdownContent,
  };
};
