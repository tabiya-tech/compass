import { parseYamlFrontmatter } from "src/knowledgeHub/parseYamlFrontmatter";

// eslint-disable-next-line import/no-webpack-loader-syntax
import privacyPolicyMd from "!!raw-loader!./documents/privacy-policy.md";

// eslint-disable-next-line import/no-webpack-loader-syntax
import termsOfUseMd from "!!raw-loader!./documents/terms-of-use.md";

export type LegalDocumentVariant = "privacy" | "terms";

const documentRegistry: Record<LegalDocumentVariant, string> = {
  privacy: privacyPolicyMd,
  terms: termsOfUseMd,
};

export interface LegalDocument {
  title: string;
  markdown: string;
}

export const getLegalDocument = (variant: LegalDocumentVariant): LegalDocument => {
  const raw = documentRegistry[variant];
  const { data, content } = parseYamlFrontmatter(raw);
  return {
    title: data.title,
    markdown: content.trimStart(),
  };
};
