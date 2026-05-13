import { Document, DocumentMetadata } from "./types";
import { parseYamlFrontmatter } from "./parseYamlFrontmatter";

// Import markdown files directly with raw-loader
// eslint-disable-next-line import/no-webpack-loader-syntax
import miningPathwayMd from "!!raw-loader!./documents/mining.md";

// eslint-disable-next-line import/no-webpack-loader-syntax
import energyPathwayMd from "!!raw-loader!./documents/energy.md";

// eslint-disable-next-line import/no-webpack-loader-syntax
import hospitalityPathwayMd from "!!raw-loader!./documents/hospitality.md";

// eslint-disable-next-line import/no-webpack-loader-syntax
import agriculturePathwayMd from "!!raw-loader!./documents/agriculture.md";

// eslint-disable-next-line import/no-webpack-loader-syntax
import waterPathwayMd from "!!raw-loader!./documents/water.md";

// eslint-disable-next-line import/no-webpack-loader-syntax
import healthPathwayMd from "!!raw-loader!./documents/health.md";

// Document registry - add new documents here
const documentRegistry: Record<string, string> = {
  "mining-pathway": miningPathwayMd,
  "energy-pathway": energyPathwayMd,
  "hospitality-pathway": hospitalityPathwayMd,
  "agriculture-pathway": agriculturePathwayMd,
  "water-pathway": waterPathwayMd,
  "health-pathway": healthPathwayMd,
};

// Parse frontmatter from markdown content
const parseFrontmatter = (content: string, id: string): Document => {
  const { data, content: markdownContent } = parseYamlFrontmatter(content);
  return {
    id,
    title: data.title,
    description: data.description,
    sector: data.sector,
    icon: data.icon,
    content: markdownContent,
  };
};

// Get all document metadata (for listing)
export const getAllDocuments = (): DocumentMetadata[] => {
  return Object.entries(documentRegistry).map(([id, content]) => {
    const parsed = parseFrontmatter(content, id);
    return {
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      sector: parsed.sector,
      icon: parsed.icon,
    };
  });
};

// Get a specific document by id
export const getDocumentById = (id: string): Document | null => {
  const content = documentRegistry[id];
  if (!content) {
    return null;
  }
  return parseFrontmatter(content, id);
};

// Check if a document exists
export const documentExists = (id: string): boolean => {
  return id in documentRegistry;
};
