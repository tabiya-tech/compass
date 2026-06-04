import { parseYamlFrontmatter } from "src/utils/parseYamlFrontmatter";

import faqEnGbMd from "!!raw-loader!./documents/faq.en-GB.md";
import faqEnUsMd from "!!raw-loader!./documents/faq.en-US.md";
import faqEsEsMd from "!!raw-loader!./documents/faq.es-ES.md";
import faqEsArMd from "!!raw-loader!./documents/faq.es-AR.md";
import faqNyZmMd from "!!raw-loader!./documents/faq.ny-ZM.md";
import faqSwKeMd from "!!raw-loader!./documents/faq.sw-KE.md";
import faqPtMzMd from "!!raw-loader!./documents/faq.pt-MZ.md";

/** Section number for the troubleshooting checklist in all FAQ locale documents. */
export const CHECKLIST_SECTION_NUMBER = 10;

const FAQ_BY_LOCALE: Record<string, string> = {
  "en-GB": faqEnGbMd,
  "en-US": faqEnUsMd,
  "es-ES": faqEsEsMd,
  "es-AR": faqEsArMd,
  "ny-ZM": faqNyZmMd,
  "sw-KE": faqSwKeMd,
  "pt-MZ": faqPtMzMd,
};

export interface FaqQuestion {
  id: string;
  question: string;
  answerMarkdown: string;
}

export type FaqSectionKind = "qa" | "static" | "checklist";

export interface FaqSection {
  id: string;
  number: number;
  title: string;
  items: FaqQuestion[];
  staticMarkdown?: string;
  isStatic: boolean;
  kind: FaqSectionKind;
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

export const parseSections = (markdown: string): FaqSection[] => {
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
      const kind: FaqSectionKind = number === CHECKLIST_SECTION_NUMBER ? "checklist" : "static";
      return {
        id,
        number,
        title,
        items: [],
        staticMarkdown: body,
        isStatic: true,
        kind,
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
      kind: "qa",
    };
  });
};

export const getFaqDocument = (locale?: string): FaqDocument => {
  const markdown = (locale && FAQ_BY_LOCALE[locale]) ?? faqEnGbMd;
  const { data, content } = parseYamlFrontmatter(markdown);
  return {
    title: data.title,
    sections: parseSections(content.trim()),
  };
};
