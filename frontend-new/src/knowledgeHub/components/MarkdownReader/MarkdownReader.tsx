import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box, styled } from "@mui/material";

const uniqueId = "a7b2c4d6-e8f0-1234-5678-9abcdef01234";

export const DATA_TEST_ID = {
  MARKDOWN_READER: `markdown-reader-${uniqueId}`,
  MARKDOWN_CONTENT: `markdown-content-${uniqueId}`,
};

const MarkdownContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "headingEmphasis",
})<{ headingEmphasis?: boolean }>(({ theme, headingEmphasis }) => {
  const headingScale = headingEmphasis
    ? {
        h1: theme.typography.h1,
        h2: theme.typography.h2,
        h3: theme.typography.h3,
      }
    : {
        h1: theme.typography.h4,
        h2: theme.typography.h5,
        h3: theme.typography.h6,
      };

  return {
    "& h1": {
      ...headingScale.h1,
      marginTop: theme.fixedSpacing(theme.tabiyaSpacing.lg),
      marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
      color: theme.palette.text.primary,
    },
    "& h2": {
      ...headingScale.h2,
      marginTop: theme.fixedSpacing(theme.tabiyaSpacing.lg),
      marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.sm),
      color: theme.palette.text.primary,
    },
    "& h3": {
      ...headingScale.h3,
      marginTop: theme.fixedSpacing(theme.tabiyaSpacing.md),
      marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.sm),
      color: theme.palette.text.primary,
    },
    "& p": {
      ...theme.typography.body1,
      marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
      color: theme.palette.text.primary,
      lineHeight: 1.7,
    },
    "& ul, & ol": {
      marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
      paddingLeft: theme.fixedSpacing(theme.tabiyaSpacing.lg),
    },
    "& li": {
      ...theme.typography.body1,
      marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.xs),
      color: theme.palette.text.primary,
    },
    "& blockquote": {
      borderLeft: `4px solid ${theme.palette.tabiyaYellow.main}`,
      margin: `${theme.fixedSpacing(theme.tabiyaSpacing.md)} 0`,
      padding: `${theme.fixedSpacing(theme.tabiyaSpacing.sm)} ${theme.fixedSpacing(theme.tabiyaSpacing.md)}`,
      backgroundColor: theme.palette.tabiyaYellow.light,
      borderRadius: `0 ${theme.fixedSpacing(theme.tabiyaRounding.sm)} ${theme.fixedSpacing(theme.tabiyaRounding.sm)} 0`,
    },
    "& code": {
      backgroundColor: theme.palette.grey[100],
      padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xxs)} ${theme.fixedSpacing(theme.tabiyaSpacing.xs)}`,
      borderRadius: theme.fixedSpacing(theme.tabiyaRounding.xs),
      fontFamily: "monospace",
      fontSize: "0.9em",
    },
    "& strong code": {
      color: theme.palette.primary.main,
    },
    "& pre": {
      backgroundColor: theme.palette.grey[100],
      padding: theme.fixedSpacing(theme.tabiyaSpacing.md),
      borderRadius: theme.fixedSpacing(theme.tabiyaRounding.sm),
      overflow: "auto",
      marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
      "& code": {
        backgroundColor: "transparent",
        padding: 0,
      },
    },
    "& table": {
      width: "100%",
      borderCollapse: "collapse",
      marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
    },
    "& th, & td": {
      border: `1px solid ${theme.palette.divider}`,
      padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
      textAlign: "left",
    },
    "& th": {
      backgroundColor: theme.palette.grey[100],
      fontWeight: 600,
    },
    "& a": {
      color: theme.palette.primary.main,
      textDecoration: "underline",
      "&:hover": {
        color: theme.palette.primary.dark,
      },
    },
    "& hr": {
      border: "none",
      borderTop: `1px solid ${theme.palette.divider}`,
      margin: `${theme.fixedSpacing(theme.tabiyaSpacing.lg)} 0`,
    },
    "& strong": {
      fontWeight: 600,
    },
  };
});

export interface MarkdownReaderProps {
  content: string;
  headingEmphasis?: boolean;
}

const MarkdownReader: React.FC<MarkdownReaderProps> = ({ content, headingEmphasis = false }) => {
  return (
    <MarkdownContainer headingEmphasis={headingEmphasis} data-testid={DATA_TEST_ID.MARKDOWN_READER}>
      <Box data-testid={DATA_TEST_ID.MARKDOWN_CONTENT}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </Box>
    </MarkdownContainer>
  );
};

export default MarkdownReader;
