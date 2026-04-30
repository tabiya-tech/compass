import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { FaqSection } from "src/faq/faqDocumentLoader";
import { alpha } from "@mui/material/styles";

const uniqueId = "ad5f1b32-7c08-4d1a-9b4e-8f6c2e0d3a45";

export const DATA_TEST_ID = {
  FAQ_TOC_CONTAINER: `faq-toc-container-${uniqueId}`,
  FAQ_TOC_LINK: `faq-toc-link-${uniqueId}`,
  FAQ_TOC_LINK_ACTIVE: `faq-toc-link-active-${uniqueId}`,
};

export interface FaqTableOfContentsProps {
  sections: FaqSection[];
  activeSectionId?: string | null;
  onLinkClick?: (sectionId: string) => void;
}

const FaqTableOfContents: React.FC<FaqTableOfContentsProps> = ({ sections, activeSectionId, onLinkClick }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box
      component="aside"
      aria-label={t("faq.tocLabel")}
      data-testid={DATA_TEST_ID.FAQ_TOC_CONTAINER}
      sx={{
        position: { md: "sticky" },
        top: { md: 24 },
        fontSize: "0.875rem",
        alignSelf: "start",
      }}
    >
      <Box
        sx={{
          fontFamily: theme.typography.h4.fontFamily,
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: theme.palette.text.secondary,
          marginBottom: "14px",
          paddingBottom: "12px",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {t("faq.tocLabel")}
      </Box>
      <Box component="ol" sx={{ listStyle: "none", margin: 0, padding: 0 }}>
        {sections.map((section) => {
          const isActive = section.id === activeSectionId;
          const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
            // The app uses a HashRouter, so an anchor's default `#section-id` navigation
            // would be interpreted as a route change (and 404). Handle the scroll manually.
            event.preventDefault();
            onLinkClick?.(section.id);
            const target = document.getElementById(section.id);
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          };
          return (
            <Box component="li" key={section.id} sx={{ margin: "1px 0" }}>
              <Box
                component="a"
                href={`#${section.id}`}
                data-testid={isActive ? DATA_TEST_ID.FAQ_TOC_LINK_ACTIVE : DATA_TEST_ID.FAQ_TOC_LINK}
                aria-current={isActive ? "true" : undefined}
                onClick={handleClick}
                sx={{
                  display: "block",
                  padding: "8px 12px",
                  margin: "0 -12px",
                  color: isActive ? theme.palette.common.black : theme.palette.text.secondary,
                  fontWeight: 400,
                  lineHeight: 1.4,
                  borderRadius: "8px",
                  textDecoration: "none",
                  cursor: "pointer",
                  backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                  transition: "color 120ms ease, background-color 120ms ease",
                  "&:hover": {
                    color: theme.palette.common.black,
                    backgroundColor: alpha(theme.palette.primary.main, 0.12),
                  },
                  "&:focus-visible": {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: "2px",
                    color: theme.palette.common.black,
                    backgroundColor: alpha(theme.palette.primary.main, 0.12),
                  },
                }}
              >
                {section.title}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default FaqTableOfContents;
