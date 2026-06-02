import { createTheme, PaletteOptions, ThemeOptions, SimplePaletteColorOptions } from "@mui/material/styles";
import {
  supportsDynamicViewportUnits,
  CSSClampFnCalculatorPx,
  CSSClampFnCalculatorRem,
  ScreenSize,
} from "src/utils/cssClampFnCalculator/CSSClampFnCalculator";
import Color from "colorjs.io";

export enum ThemeMode {
  LIGHT = "light",
  DARK = "dark",
}

/**
 * Adds a contrast color to the color object based on the given color using a contrast threshold from the palette
 * @param color
 * @param contrastColor
 */
const augmentedThemeColor = (color: string, contrastColor?: string) => {
  // @ts-expect-error - we don't want to define a full palette here, just the contrastThreshold
  const _temp_palette = createTheme({
    palette: {
      contrastThreshold: 4.5, //WCAG 2.0 (AA) ensure color-contrast is at least 4.5:1
    },
  }).palette;

  return _temp_palette.augmentColor({
    color: {
      main: color,
      contrastText: contrastColor,
    },
  });
};

/**
 * Creates a grey scale palette between a primary text and linen.
 */
const createGreyScale = () => {
  const startColor = new Color("#1A1208"); // black
  const greyAnchor = new Color("#F9F6F0"); // linen
  const lightColor = new Color("white");

  const mixColor = (color: Color, mix: number) => {
    return color.mix(greyAnchor, mix, { space: "lab" }).to("srgb").toString({ format: "hex" });
  };
  //TODO: discuss and add accent colors (A series)
  return {
    900: mixColor(startColor, 0 / 8),
    800: mixColor(startColor, 1 / 8),
    700: mixColor(startColor, 2 / 8),
    600: mixColor(startColor, 3 / 8),
    500: mixColor(startColor, 4 / 8),
    400: mixColor(startColor, 5 / 8),
    300: mixColor(startColor, 6 / 8),
    200: mixColor(startColor, 7 / 8),
    100: "#F2F1F0", // cloud
    50: mixColor(lightColor, 0.5),
  };
};

export const TabiyaBasicColors = {
  DarkBlue: "#002147",
  LightBlue: "#265EA7",
  Yellow: "#EEFF41",
  Green: "#00FF91",
  LightGreen: "#E4F8E2",
  DarkGreen: "#1E7166",
  DarkRed: "#B71C1C",
  Gray: "#F3F1EE",
  GrayDark: "#41403D",
};

export const TabiyaIconStyles = {
  fontSizeSmall: {
    fontSize: "1rem",
  },
  fontSizeMedium: {
    fontSize: "1.5rem",
  },
  fontSizeLarge: {
    fontSize: "2.5rem",
  },
  root: {
    fontSize: "1.5rem",
  },
};

const lightPalette: PaletteOptions = {
  contrastThreshold: 4.5, // WCAG 2.0 (AA) ensure color-contrast is at least 4.5:1
  primary: {
    main: "rgb(var(--brand-primary))",
    light: "rgb(var(--brand-primary-light))",
    dark: "rgb(var(--brand-primary-dark))",
    contrastText: "rgb(var(--brand-primary-contrast-text))",
  },
  secondary: {
    main: "rgb(var(--brand-secondary))",
    light: "rgb(var(--brand-secondary-light))",
    dark: "rgb(var(--brand-secondary-dark))",
    contrastText: "rgb(var(--brand-secondary-contrast-text))",
  },
  tertiary: {
    main: "rgb(var(--brand-tertiary))",
    light: "rgb(var(--brand-tertiary-light))",
    dark: "rgb(var(--brand-tertiary-dark))",
    contrastText: "rgb(var(--brand-tertiary-contrast-text))",
  },
  accent: {
    main: "rgb(var(--brand-accent))",
    light: "rgb(var(--brand-accent-light))",
    dark: "rgb(var(--brand-accent-dark))",
    contrastText: "rgb(var(--brand-accent-contrast-text))",
  },
  tabiyaYellow: augmentedThemeColor(TabiyaBasicColors.Yellow),
  tabiyaBlue: augmentedThemeColor(TabiyaBasicColors.DarkBlue),
  tabiyaGreen: augmentedThemeColor(TabiyaBasicColors.DarkGreen),
  tabiyaRed: augmentedThemeColor(TabiyaBasicColors.DarkRed),
  pageBackground: {
    main: "rgb(var(--page-background))",
    light: "rgb(var(--page-background-light))",
    dark: "rgb(var(--page-background-dark))",
    contrastText: "rgb(var(--page-background-contrast-text))",
  },
  error: {
    ...augmentedThemeColor("#FF5449"),
    dark: "#690005",
    light: "#FFEDEA",
  },
  warning: {
    ...augmentedThemeColor("#FDAB40", TabiyaBasicColors.GrayDark),
    dark: "#B84204",
    light: "#FFF3E0",
  },
  info: {
    ...augmentedThemeColor("#4FC3F7"),
    dark: "#003662",
    light: "#CAF5FF",
  },
  success: {
    ...augmentedThemeColor("#6BF0AE"),
    dark: "#1D6023",
    light: "#E8F5E9",
  },
  grey: createGreyScale(),
  text: {
    primary: "rgb(var(--text-primary))",
    secondary: "rgb(var(--text-secondary))",
    textAccent: "rgb(var(--text-accent))",
    textWhite: "#FFFFFF",
    textBlack: "rgb(var(--text-primary))",
    disabled: "rgb(var(--text-secondary))",
  },
  common: {
    white: "#FFFFFF",
    black: "rgb(var(--text-primary))",
  },
  background: {
    default: "rgb(var(--page-background))",
    paper: "#FFFFFF",
  },
  divider: "#E1DFDD",
};

const darkPalette: PaletteOptions = {
  // Add Some dark theme palette options,
  // currently using the light theme palette
  ...lightPalette,
};

export const TabiyaBaseSizes = {
  // All sizes are in px
  spacing: 8,
  rounding: 8,
  font: 16,
};
export const applicationTheme = (theme: ThemeMode) => {
  const screenSizePx: ScreenSize = {
    minWidth: 800,
    maxWidth: 1200,
    minHeight: 500,
    maxHeight: 800,
  };
  const screenSizeRem: ScreenSize = {
    minWidth: screenSizePx.minWidth / TabiyaBaseSizes.font,
    maxWidth: screenSizePx.maxWidth / TabiyaBaseSizes.font,
    minHeight: screenSizePx.minHeight / TabiyaBaseSizes.font,
    maxHeight: screenSizePx.maxHeight / TabiyaBaseSizes.font,
  };

  const useDynamicViewport = supportsDynamicViewportUnits();
  const clampPx = (minValue: number, maxValue: number, size: ScreenSize) =>
    CSSClampFnCalculatorPx(minValue, maxValue, size, useDynamicViewport);
  const clampRem = (minValue: number, maxValue: number, size: ScreenSize) =>
    CSSClampFnCalculatorRem(minValue, maxValue, size, useDynamicViewport);

  // cache the clamp functions to avoid recalculating them
  const spacingClampFn = clampPx(TabiyaBaseSizes.spacing / 4, TabiyaBaseSizes.spacing, screenSizePx);
  const roundingClampFn = clampPx(TabiyaBaseSizes.rounding / 4, TabiyaBaseSizes.rounding, screenSizePx);

  const activePalette: PaletteOptions = theme === ThemeMode.LIGHT ? lightPalette : darkPalette;
  const activeTheme: ThemeOptions = {
    cssVariables: true,
    palette: activePalette,
    spacing: (factor: number) => `calc(${spacingClampFn} * ${factor})`,
    fixedSpacing: (factor: number) => `${factor * TabiyaBaseSizes.spacing}px`,
    responsiveBorderRounding: (factor: number | "50%") => {
      if (factor === "50%") {
        // percentage makes no sense to be responsive
        return factor;
      }
      return `calc(${roundingClampFn} * ${factor})`;
    },
    rounding: (factor: number | "50%") => {
      if (factor === "50%") {
        // percentage makes no sense to multiply with factor
        return factor;
      }
      return `${factor * TabiyaBaseSizes.rounding}px`;
    },
    tabiyaSpacing: {
      none: 0,
      xxs: 0.25,
      xs: 0.5,
      sm: 1,
      md: 2,
      lg: 3,
      xl: 4,
    },
    shape: {
      borderRadius: 8,
    },
    tabiyaRounding: {
      none: 0,
      xxs: 0.25,
      xs: 0.5,
      sm: 1,
      md: 2,
      lg: 3,
      xl: 4,
      full: "50%",
    },
    typography: {
      htmlFontSize: TabiyaBaseSizes.font, // Set the base font size
      fontFamily: '"Plus Jakarta Sans", sans-serif', // Set the desired font family
      fontSize: TabiyaBaseSizes.font, // Set the base font size
      fontWeightLight: 300,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      h1: {
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontWeight: "800",
        fontSize: clampRem(1.875, 3, screenSizeRem),
        letterSpacing: "-0.02em",
        color: activePalette.text!!.primary,
      },
      h2: {
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontWeight: "700",
        fontSize: clampRem(1.5, 2.25, screenSizeRem),
        letterSpacing: "-0.02em",
        color: activePalette.text!!.primary,
      },
      h3: {
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontWeight: "700",
        fontSize: clampRem(1.25, 1.875, screenSizeRem),
        letterSpacing: "-0.01em",
        color: activePalette.text!!.primary,
      },
      h4: {
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontWeight: "600",
        fontSize: clampRem(1.25, 1.5, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      h5: {
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontWeight: "600",
        fontSize: clampRem(1.125, 1.25, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      h6: {
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontWeight: "600",
        fontSize: clampRem(1, 1.125, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      subtitle1: {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontWeight: "600",
        fontSize: clampRem(1.125, 1.25, screenSizeRem),
        color: activePalette.text!!.textAccent,
      },
      subtitle2: {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontWeight: "600",
        fontSize: clampRem(1, 1.125, screenSizeRem),
        color: activePalette.text!!.textAccent,
      },
      body1: {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontWeight: "400",
        fontSize: clampRem(1, 1.125, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      body2: {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontWeight: "400",
        fontSize: clampRem(0.875, 1, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      button: {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontWeight: "500",
        fontSize: clampRem(0.875, 1, screenSizeRem),
        color: activePalette.text!!.primary,
        textTransform: "none",
      },
      caption: {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontWeight: "400",
        fontSize: clampRem(0.75, 0.875, screenSizeRem),
        color: activePalette.text!!.secondary,
      },
      overline: {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontWeight: "600",
        fontSize: clampRem(0.75, 0.875, screenSizeRem),
        textTransform: "uppercase",
        color: activePalette.text!!.secondary,
      },
      progressBarText: {
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontWeight: "700",
        fontSize: clampRem(0.75, 0.875, screenSizeRem),
        color: activePalette.text!!.primary,
      },
    },
    components: {
      MuiDialogTitle: {
        defaultProps: {
          variant: "h2",
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: ({ theme }) => ({
            fontSize: theme.typography.caption.fontSize,
            marginBottom: 8,
          }),
          asterisk: {
            color: (activePalette.error as SimplePaletteColorOptions).main, // unclear why typescript complaints about this and we need to cast
          },
        },
      },
      MuiInput: {
        styleOverrides: {
          input: {
            "::placeholder": {
              color: activePalette.text!!.secondary,
            },
          },
        },
      },
      MuiTableHead: {
        defaultProps: {
          style: {
            background: (activePalette.pageBackground as SimplePaletteColorOptions)!!.main,
          },
        },
      },
      MuiSvgIcon: {
        styleOverrides: {
          ...TabiyaIconStyles,
        },
      },
      MuiIcon: {
        styleOverrides: {
          ...TabiyaIconStyles,
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontSize: clampRem(0.75, 1, screenSizeRem),
          },
          colorSecondary: {
            textTransform: "none",
            justifyContent: "flex-start",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "15.625rem",
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            fontSize: clampRem(0.75, 0.875, screenSizeRem), // Adjust text size
            padding: "0",

            "& .Mui-disabled": {
              opacity: 0.5,
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            fontSize: clampRem(0.75, 0.875, screenSizeRem), // Adjust text size
            padding: "0",
          },
          input: {
            fontSize: clampRem(0.875, 1, screenSizeRem), // Adjust input text size
            padding: "0",
            fontWeight: 500,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: activePalette.common!!.white,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: activePalette.divider,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: activePalette.text!!.textAccent,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: activePalette.text!!.textAccent,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: clampRem(0.75, 0.875, screenSizeRem), // Adjust label text size
            padding: "0",
            color: activePalette.text!.secondary,
            opacity: 0.7,
            "&.Mui-focused": {
              color: activePalette.text!.primary,
            },
          },
        },
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            "& .MuiInputLabel-root": {
              color: activePalette.text!.secondary,
              opacity: 0.7,
            },
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.grey[200],
          }),
        },
      },
    },
  };
  return createTheme(activeTheme);
};

export default applicationTheme;
