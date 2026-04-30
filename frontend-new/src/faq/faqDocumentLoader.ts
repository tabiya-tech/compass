import { parseYamlFrontmatter } from "src/knowledgeHub/parseYamlFrontmatter";

// eslint-disable-next-line import/no-webpack-loader-syntax
import faqMd from "!!raw-loader!./documents/faq.md";

export interface FaqQuestion {
  id: string;
  question: string;
  answerMarkdown: string;
}

export interface FaqSection {
  id: string;
  number: number;
  title: string;
  items: FaqQuestion[];
  staticMarkdown?: string;
  isStatic: boolean;
}

export interface FaqDocument {
  title: string;
  sections: FaqSection[];
}

const slugify = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "section";

const parseSections = (markdown: string): FaqSection[] => {
  const sectionBlocks = markdown
    .split(/\n(?=## )/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("## "));

  return sectionBlocks.map((block, index) => {
    const headingEnd = block.indexOf("\n");
    const headingLine = headingEnd === -1 ? block : block.slice(0, headingEnd);
    const body = headingEnd === -1 ? "" : block.slice(headingEnd + 1).trim();

    const headingText = headingLine.replace(/^##\s+/, "").trim();
    const numberedMatch = headingText.match(/^(\d+)\.\s*(.+)$/);
    const number = numberedMatch ? parseInt(numberedMatch[1], 10) : index + 1;
    const title = numberedMatch ? numberedMatch[2].trim() : headingText;

    const itemBlocks = body
      .split(/\n(?=### )/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith("### "));

    const id = slugify(title);

    if (itemBlocks.length === 0) {
      return {
        id,
        number,
        title,
        items: [],
        staticMarkdown: body,
        isStatic: true,
      };
    }

    const items: FaqQuestion[] = itemBlocks.map((itemBlock) => {
      const itemHeadingEnd = itemBlock.indexOf("\n");
      const itemHeading = itemHeadingEnd === -1 ? itemBlock : itemBlock.slice(0, itemHeadingEnd);
      const itemBody = itemHeadingEnd === -1 ? "" : itemBlock.slice(itemHeadingEnd + 1).trim();
      const question = itemHeading.replace(/^###\s+/, "").trim();
      return {
        id: `${id}--${slugify(question)}`,
        question,
        answerMarkdown: itemBody,
      };
    });

    return {
      id,
      number,
      title,
      items,
      isStatic: false,
    };
  });
};

export const getFaqDocument = (): FaqDocument => {
  const { data, content } = parseYamlFrontmatter(faqMd);
  return {
    title: data.title,
    sections: parseSections(content.trim()),
  };
};
