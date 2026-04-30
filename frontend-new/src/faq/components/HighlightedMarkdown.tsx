import React, { Fragment, useMemo } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box, useTheme } from "@mui/material";

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface HighlightTextProps {
  text: string;
  query: string;
  markBg: string;
  markColor: string;
}

const HighlightText: React.FC<HighlightTextProps> = ({ text, query, markBg, markColor }) => {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  const lowered = query.toLowerCase();
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lowered && part.length > 0 ? (
          <Box
            key={`hl-${i}`}
            component="mark"
            sx={{
              backgroundColor: markBg,
              color: markColor,
              padding: "1px 3px",
              borderRadius: "3px",
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {part}
          </Box>
        ) : (
          <Fragment key={`pt-${i}`}>{part}</Fragment>
        )
      )}
    </>
  );
};

const highlightChildren = (
  children: React.ReactNode,
  query: string,
  markBg: string,
  markColor: string
): React.ReactNode => {
  if (!query) return children;
  return React.Children.map(children, (child, i) => {
    if (typeof child === "string") {
      return <HighlightText key={`s-${i}`} text={child} query={query} markBg={markBg} markColor={markColor} />;
    }
    return child;
  });
};

export interface HighlightedMarkdownProps {
  content: string;
  query?: string;
}

const HighlightedMarkdown: React.FC<HighlightedMarkdownProps> = ({ content, query = "" }) => {
  const theme = useTheme();
  const markBg = theme.palette.brandAccent.main;
  const markColor = theme.palette.common.black;
  const linkColor = theme.palette.primary.main;
  const linkHover = theme.palette.primary.dark;
  const bulletColor = theme.palette.primary.main;
  const textColor = theme.palette.common.black;
  const dividerColor = theme.palette.divider;

  const components: Components = useMemo(
    () => ({
      p: ({ children }) => (
        <Box
          component="p"
          sx={{
            margin: "0 0 12px",
            color: textColor,
            fontSize: "0.9375rem",
            lineHeight: 1.7,
          }}
        >
          {highlightChildren(children, query, markBg, markColor)}
        </Box>
      ),
      strong: ({ children }) => (
        <Box component="strong" sx={{ fontWeight: 600, color: textColor }}>
          {highlightChildren(children, query, markBg, markColor)}
        </Box>
      ),
      em: ({ children }) => <em>{highlightChildren(children, query, markBg, markColor)}</em>,
      a: ({ children, href }) => (
        <Box
          component="a"
          href={href}
          sx={{
            color: linkColor,
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            "&:hover": { color: linkHover, textDecorationThickness: "2px" },
          }}
        >
          {highlightChildren(children, query, markBg, markColor)}
        </Box>
      ),
      ul: ({ children }) => (
        <Box
          component="ul"
          sx={{
            margin: "0 0 12px 0",
            paddingLeft: "20px",
            listStyle: "disc",
            "& > li::marker": { color: bulletColor, fontSize: "0.7em" },
          }}
        >
          {children}
        </Box>
      ),
      ol: ({ children }) => (
        <Box
          component="ol"
          sx={{
            margin: "0 0 12px 0",
            paddingLeft: "24px",
            listStyle: "decimal",
            "& > li::marker": { color: bulletColor, fontWeight: 600 },
          }}
        >
          {children}
        </Box>
      ),
      li: ({ children }) => (
        <Box
          component="li"
          sx={{
            marginBottom: "6px",
            paddingLeft: "4px",
            color: textColor,
            fontSize: "0.9375rem",
            lineHeight: 1.7,
          }}
        >
          {highlightChildren(children, query, markBg, markColor)}
        </Box>
      ),
      h4: ({ children }) => (
        <Box
          component="h4"
          sx={{
            fontFamily: theme.typography.h4.fontFamily,
            fontSize: "1rem",
            fontWeight: 600,
            color: textColor,
            margin: "14px 0 6px",
          }}
        >
          {highlightChildren(children, query, markBg, markColor)}
        </Box>
      ),
      hr: () => (
        <Box component="hr" sx={{ border: "none", borderTop: `1px solid ${dividerColor}`, margin: "16px 0" }} />
      ),
    }),
    [query, markBg, markColor, linkColor, linkHover, bulletColor, textColor, dividerColor, theme]
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
};

export default HighlightedMarkdown;
export { HighlightText };
