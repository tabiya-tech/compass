import React, { useState } from "react";
import { Box, useTheme } from "@mui/material";
import { ChevronDown } from "lucide-react";
import HighlightedMarkdown, { HighlightText } from "src/faq/components/HighlightedMarkdown";
import type { FaqQuestion } from "src/faq/faqDocumentLoader";

const uniqueId = "8c1a7e4d-f3b2-4a91-b6d8-2f0e9c5b4a17";

export const DATA_TEST_ID = {
  FAQ_ACCORDION_ITEM: `faq-accordion-item-${uniqueId}`,
  FAQ_ACCORDION_SUMMARY: `faq-accordion-summary-${uniqueId}`,
  FAQ_ACCORDION_BODY: `faq-accordion-body-${uniqueId}`,
};

export interface FaqAccordionItemProps {
  item: FaqQuestion;
  query: string;
  forceOpen: boolean;
}

const FaqAccordionItem: React.FC<FaqAccordionItemProps> = ({ item, query, forceOpen }) => {
  const theme = useTheme();
  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const isOpen = forceOpen || isOpenLocal;

  return (
    <Box
      data-testid={DATA_TEST_ID.FAQ_ACCORDION_ITEM}
      sx={{
        borderBottom: `1px solid ${theme.palette.divider}`,
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <Box
        component="button"
        type="button"
        data-testid={DATA_TEST_ID.FAQ_ACCORDION_SUMMARY}
        onClick={() => setIsOpenLocal((prev) => !prev)}
        aria-expanded={isOpen}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: "18px 4px 18px 0",
          cursor: "pointer",
          color: isOpen ? theme.palette.primary.main : theme.palette.common.black,
          fontFamily: theme.typography.body1.fontFamily,
          fontWeight: 500,
          fontSize: "1rem",
          lineHeight: 1.45,
          transition: "color 120ms ease",
          "&:hover": { color: theme.palette.primary.main },
          "&:focus-visible": {
            color: theme.palette.primary.main,
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: "2px",
            borderRadius: "2px",
          },
        }}
      >
        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
          <HighlightText
            text={item.question}
            query={query}
            markBg={theme.palette.brandAccent.main}
            markColor={theme.palette.common.black}
          />
        </Box>
        <Box
          component="span"
          aria-hidden
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: isOpen ? theme.palette.primary.main : theme.palette.text.secondary,
            transition: "transform 200ms ease, color 120ms ease",
            transform: isOpen ? "rotate(-180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        >
          <ChevronDown size={18} strokeWidth={1.75} />
        </Box>
      </Box>
      {isOpen && (
        <Box
          data-testid={DATA_TEST_ID.FAQ_ACCORDION_BODY}
          sx={{
            padding: "0 0 22px",
            color: theme.palette.common.black,
          }}
        >
          <HighlightedMarkdown content={item.answerMarkdown} query={query} />
        </Box>
      )}
    </Box>
  );
};

export default FaqAccordionItem;
