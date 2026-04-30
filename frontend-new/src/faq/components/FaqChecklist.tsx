import React, { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import { Square } from "lucide-react";
import HighlightedMarkdown, { HighlightText } from "src/faq/components/HighlightedMarkdown";

const uniqueId = "c2f9d8a1-7e4b-4c6d-9b3a-5f1e0d8c2a76";

export const DATA_TEST_ID = {
  FAQ_CHECKLIST_CONTAINER: `faq-checklist-container-${uniqueId}`,
  FAQ_CHECKLIST_INTRO: `faq-checklist-intro-${uniqueId}`,
  FAQ_CHECKLIST_CARD: `faq-checklist-card-${uniqueId}`,
  FAQ_CHECKLIST_ITEM: `faq-checklist-item-${uniqueId}`,
};

export interface FaqChecklistProps {
  markdown: string;
  query?: string;
}

interface ParsedChecklist {
  introMarkdown: string;
  items: string[];
}

const parseChecklist = (markdown: string): ParsedChecklist => {
  const lines = markdown.split("\n");
  const introLines: string[] = [];
  const items: string[] = [];
  let inList = false;
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length > 0) {
      items.push(buffer.join(" ").trim());
      buffer = [];
    }
  };

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushBuffer();
      inList = true;
      buffer.push(bulletMatch[1]);
      continue;
    }
    if (inList && line.trim() !== "") {
      // continuation of previous bullet item
      buffer.push(line.trim());
      continue;
    }
    if (inList && line.trim() === "") {
      flushBuffer();
      continue;
    }
    if (!inList) {
      introLines.push(line);
    }
  }
  flushBuffer();

  return {
    introMarkdown: introLines.join("\n").trim(),
    items,
  };
};

const FaqChecklist: React.FC<FaqChecklistProps> = ({ markdown, query = "" }) => {
  const theme = useTheme();
  const { introMarkdown, items } = useMemo(() => parseChecklist(markdown), [markdown]);

  return (
    <Box data-testid={DATA_TEST_ID.FAQ_CHECKLIST_CONTAINER}>
      {introMarkdown && (
        <Box
          data-testid={DATA_TEST_ID.FAQ_CHECKLIST_INTRO}
          sx={{
            color: theme.palette.text.secondary,
            fontSize: "0.9375rem",
            marginBottom: "12px",
            "& p": {
              margin: 0,
              color: theme.palette.text.secondary,
              fontSize: "0.9375rem",
            },
          }}
        >
          <HighlightedMarkdown content={introMarkdown} query={query} />
        </Box>
      )}
      <Box
        data-testid={DATA_TEST_ID.FAQ_CHECKLIST_CARD}
        sx={{
          backgroundColor: theme.palette.common.white,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: "12px",
          padding: "8px 24px",
          boxShadow: `0 1px 3px ${theme.palette.grey[200]}`,
        }}
      >
        <Box component="ul" sx={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item, index) => (
            <Box
              key={`checklist-item-${index}`}
              component="li"
              data-testid={DATA_TEST_ID.FAQ_CHECKLIST_ITEM}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                padding: "12px 0",
                color: theme.palette.common.black,
                fontSize: "0.9375rem",
                lineHeight: 1.5,
                borderBottom: `1px solid ${theme.palette.grey[100]}`,
                "&:last-of-type": { borderBottom: "none" },
              }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  marginTop: "1px",
                  color: theme.palette.text.secondary,
                  opacity: 0.6,
                }}
              >
                <Square size={16} strokeWidth={1.5} />
              </Box>
              <Box component="span" sx={{ flex: 1 }}>
                <HighlightText
                  text={item}
                  query={query}
                  markBg={theme.palette.brandAccent.main}
                  markColor={theme.palette.common.black}
                />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default FaqChecklist;
