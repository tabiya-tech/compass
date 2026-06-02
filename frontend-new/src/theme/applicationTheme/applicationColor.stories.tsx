import type { Meta, StoryObj } from "@storybook/react";
import { Box, Typography, useTheme } from "@mui/material";
import { Palette, PaletteColor, Theme } from "@mui/material/styles";

const meta: Meta = {
  title: "Style/Colors",
  component: Box,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj;

const groupedColorCategories = [
  ["primary", "secondary", "tertiary", "accent"],
  ["error", "warning", "info", "success"],
  ["tabiyaYellow", "tabiyaBlue"],
  ["pageBackground"],
] as const;
const colorCategories = groupedColorCategories.flat();
type ColorCategory = (typeof colorCategories)[number];

const semanticColorNames: Partial<Record<ColorCategory, string>> = {
  primary: "rust",
  secondary: "emerald",
  tertiary: "amber",
  accent: "teal",
  pageBackground: "linen/surface context",
};

// Resolves CSS variable colors to their computed values
const resolveCssColor = (value: string): string => {
  if (globalThis.window === undefined || !value.includes("var(")) return value;

  const match = /var\((--[^)]+)\)/.exec(value);
  if (!match) return value;

  const raw = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();

  return raw?.includes(" ") ? `rgb(${raw})` : raw || value;
};

const PaletteElements = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: theme.tabiyaSpacing.lg,
      }}
    >
      <Typography variant="h1"> Basic Colors</Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: theme.tabiyaSpacing.md,
          paddingLeft: theme.tabiyaSpacing.lg,
        }}
      >
        {groupedColorCategories.map((categories) => (
          <Box
            key={categories.join("_")}
            sx={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "start",
              gap: theme.tabiyaSpacing.lg,
            }}
          >
            {categories.map((category) => (
              <Box
                key={category}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: theme.tabiyaSpacing.lg,
                }}
              >
                <Typography alignSelf="flex-start" variant="body1" fontWeight="bold">
                  {category} {semanticColorNames[category] && `- ${semanticColorNames[category]}`}
                </Typography>
                <Box>
                  <ColorBox theme={theme} category={category} variant={"main"} />
                  <ColorBox theme={theme} category={category} variant={"light"} />
                  <ColorBox theme={theme} category={category} variant={"dark"} />
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      <Box>
        <Typography variant="h2">GreyScale</Typography>
        <Box sx={{ padding: theme.tabiyaSpacing.lg, gap: theme.tabiyaSpacing.md }}>
          {Object.entries(theme.palette.grey).map(([shade, color]) => (
            <ColorBox key={shade} shade={shade as keyof Palette["grey"]} theme={theme} color={color} />
          ))}
        </Box>
      </Box>
      <Box>
        <Typography variant="h2">Text Colors</Typography>
        <Box sx={{ padding: theme.tabiyaSpacing.lg, gap: theme.tabiyaSpacing.md }}>
          {Object.entries(theme.palette.text).map(([variant, color]) => {
            const resolved = resolveCssColor(color);
            const needsDarkBg = variant === "white" || variant === "accent";
            const boxBg = needsDarkBg ? theme.palette.common.black : theme.palette.common.white;

            return (
              <ColorBox theme={theme} color={boxBg} key={variant}>
                <Typography component="p" sx={{ color, fontWeight: "bold" }}>
                  {variant} : {resolved}
                </Typography>
              </ColorBox>
            );
          })}
        </Box>
      </Box>
      <Box>
        <Typography variant="h2">Common Colors</Typography>
        <Box sx={{ padding: theme.tabiyaSpacing.lg, gap: theme.tabiyaSpacing.md }}>
          {Object.entries(theme.palette.common).map(([variant, color]) => (
            <ColorBox
              theme={theme}
              color={variant === "white" ? theme.palette.common.black : theme.palette.common.white}
              key={variant}
            >
              <Typography component="p" sx={{ color, fontWeight: "bold" }}>
                {variant} : {color}
              </Typography>
            </ColorBox>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

interface ColorBoxProps {
  theme: Theme;
  category?: ColorCategory;
  variant?: keyof PaletteColor;
  color?: string;
  shade?: keyof Palette["grey"];
  children?: any;
}

const ColorBox = (props: ColorBoxProps) => {
  let backgroundColor: string;
  let textColor: string;
  let label: React.ReactNode;

  if (props.color) {
    backgroundColor = props.color;
    textColor = props.theme.palette.common.white;
    label = props.children ?? props.color;
  } else if (props.category && props.variant) {
    const paletteColor = props.theme.palette[props.category];

    backgroundColor = paletteColor[props.variant];
    textColor = paletteColor.contrastText;
    label = props.variant;
  } else if (props.shade) {
    backgroundColor = props.theme.palette.grey[props.shade];
    textColor = props.theme.palette.getContrastText(backgroundColor);
    label = props.shade;
  } else {
    throw new Error("Invalid props provided to ColorBox");
  }

  return (
    <Box
      sx={{
        height: "2.5rem",
        width: "20rem",
        backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "start",
        padding: props.theme.tabiyaSpacing.md,
      }}
    >
      <Typography fontWeight="bold" sx={{ color: textColor }}>
        {label}
      </Typography>
    </Box>
  );
};

export const PaletteStyles: Story = {
  args: {
    children: <PaletteElements />,
  },
};
