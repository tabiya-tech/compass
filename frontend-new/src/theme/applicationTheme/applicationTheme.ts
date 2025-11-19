import { createTheme, PaletteOptions, ThemeOptions, SimplePaletteColorOptions } from "@mui/material/styles/";
import {
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

const mixHexColors = (base: string, blend: string, ratio: number) =>
  new Color(base).mix(new Color(blend), ratio, { space: "lab" }).to("srgb").toString({ format: "hex" });

const lightenHex = (hex: string, ratio: number) => mixHexColors(hex, "#ffffff", ratio);
const darkenHex = (hex: string, ratio: number) => mixHexColors(hex, "#000000", ratio);

/**
 * Creates a grey scale palette between the DarkBlue and Gray colors
 */
const createGreyScale = () => {
  const startColor = new Color(TabiyaBasicColors.DarkBlue);
  const greyAnchor = new Color(TabiyaBasicColors.Gray);
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
    100: TabiyaBasicColors.Gray, // The greyAnchor color is [100]
    50: mixColor(lightColor, 0.5),
  };
};

export const TabiyaBasicColors = {
  DarkBlue: "#204E9A", // Pantone 2945 C
  LightBlue: "#29AEB3", // Pantone 306 C
  PanelBlue: "#0F4C94",
  PageBackground: "#FFFFFF",
  TextDefault: "#222222",
  Yellow: "#EEFF41",
  Green: "#00FF91",
  LightGreen: "#E4F8E2",
  DarkGreen: "#1E7166",
  Gray: "#F3F1EE",
  GrayDark: "#41403D",
};

const panelLight = lightenHex(TabiyaBasicColors.PanelBlue, 0.25);
const panelDark = darkenHex(TabiyaBasicColors.PanelBlue, 0.2);
const primarySolid = TabiyaBasicColors.DarkBlue;
const accentSolid = TabiyaBasicColors.LightBlue;

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
  primary: augmentedThemeColor(TabiyaBasicColors.DarkBlue),
  secondary: augmentedThemeColor(TabiyaBasicColors.LightBlue),
  tabiyaYellow: augmentedThemeColor(TabiyaBasicColors.Yellow),
  tabiyaBlue: augmentedThemeColor(TabiyaBasicColors.DarkBlue),
  containerBackground: {
    light: panelLight,
    dark: panelDark,
    main: TabiyaBasicColors.PanelBlue,
    contrastText: "#FFFFFF",
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
    primary: TabiyaBasicColors.TextDefault,
    secondary: TabiyaBasicColors.GrayDark,
    textAccent: TabiyaBasicColors.LightBlue,
    textWhite: "#FFFFFF",
    textBlack: "#000000",
    disabled: "#94A3B8",
  },
  background: {
    default: TabiyaBasicColors.PageBackground,
    paper: "#FFFFFF",
  },
  common: {
    white: "#ffffff",
    black: "#000000",
  },
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

  // cache the clamp functions to avoid recalculating them
  const spacingClampFn = CSSClampFnCalculatorPx(TabiyaBaseSizes.spacing / 4, TabiyaBaseSizes.spacing, screenSizePx);
  const roundingClampFn = CSSClampFnCalculatorPx(TabiyaBaseSizes.rounding / 4, TabiyaBaseSizes.rounding, screenSizePx);

  const activePalette: PaletteOptions = theme === ThemeMode.LIGHT ? lightPalette : darkPalette;
  const drawerPaperColor = (activePalette.background?.paper as string) ?? TabiyaBasicColors.PageBackground;
  const drawerTextColor = (activePalette.text?.primary as string) ?? TabiyaBasicColors.TextDefault;
  const activeTheme: ThemeOptions = {
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
      fontFamily: "Inter, sans-serif", // Set the desired font family
      fontSize: TabiyaBaseSizes.font, // Set the base font size
      fontWeightLight: 300,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      h1: {
        fontFamily: "IBM Plex Mono",
        fontWeight: "700",
        fontSize: CSSClampFnCalculatorRem(1.45, 2.125, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      h2: {
        fontFamily: "IBM Plex Mono",
        fontWeight: "700",
        fontSize: CSSClampFnCalculatorRem(1.40, 1.975, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      h3: {
        fontFamily: "IBM Plex Mono",
        fontWeight: "700",
        fontSize: CSSClampFnCalculatorRem(1.35, 1.825, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      h4: {
        fontFamily: "IBM Plex Mono",
        fontWeight: "700",
        fontSize: CSSClampFnCalculatorRem(1.30, 1.675, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      h5: {
        fontFamily: "IBM Plex Mono",
        fontWeight: "700",
        fontSize: CSSClampFnCalculatorRem(1.25, 1.525, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      h6: {
        fontFamily: "IBM Plex Mono",
        fontWeight: "700",
        fontSize: CSSClampFnCalculatorRem(1.20, 1.375, screenSizeRem),
        color: activePalette.text!!.primary,
      },
      subtitle1: {
        fontFamily: "Inter",
        fontWeight: "500",
        fontSize: CSSClampFnCalculatorRem(1, 1.125, screenSizeRem),

        color: activePalette.text!!.textAccent,
      },
      subtitle2: {
        fontFamily: "Inter",
        fontWeight: "500",
        fontSize: CSSClampFnCalculatorRem(0.75, 1, screenSizeRem),
        color: activePalette.text!!.textAccent,
      },
      body1: {
        fontFamily: "Inter",
        fontWeight: "400",
        fontSize: CSSClampFnCalculatorRem(0.875, 1, screenSizeRem),
        color: activePalette.text!!.secondary,
      },
      body2: {
        fontFamily: "Inter",
        fontWeight: "400",
        fontSize: CSSClampFnCalculatorRem(0.75, 1, screenSizeRem),
        color: activePalette.text!!.secondary,
      },
      button: {
        fontFamily: "Inter",
        fontWeight: "500",
        fontSize: CSSClampFnCalculatorRem(1, 1.125, screenSizeRem),
        color: activePalette.text!!.primary,
        textTransform: "none",
      },
      caption: {
        fontFamily: "Inter",
        fontWeight: "400",
        fontSize: CSSClampFnCalculatorRem(0.75, 0.875, screenSizeRem),
      },
      overline: {
        fontFamily: "Inter",
        fontWeight: "400",
        fontSize: CSSClampFnCalculatorRem(0.75, 0.875, screenSizeRem),
      },
      progressBarText: {
        fontFamily: "IBM Plex Mono",
        fontWeight: "700",
        fontSize: CSSClampFnCalculatorRem(0.75, 0.875, screenSizeRem),
        color: activePalette.text!!.primary,
      }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ":root": {
            "--color-primary": TabiyaBasicColors.DarkBlue,
            "--color-accent": TabiyaBasicColors.LightBlue,
            "--bg-panel": TabiyaBasicColors.PanelBlue,
            "--page-bg": TabiyaBasicColors.PageBackground,
            "--text-default": TabiyaBasicColors.TextDefault,
          },
          body: {
            backgroundColor: TabiyaBasicColors.PageBackground,
            color: TabiyaBasicColors.TextDefault,
          },
          "#root": {
            backgroundColor: TabiyaBasicColors.PageBackground,
          },
          ".sidebar": {
            backgroundColor: "var(--bg-panel)",
            color: "#FFFFFF",
          },
          ".btn-primary": {
            backgroundColor: "var(--color-primary)",
            color: "#FFFFFF",
            border: "none",
          },
          ".badge-accent": {
            backgroundColor: "var(--color-accent)",
            color: "#FFFFFF",
            borderRadius: "100px",
            padding: "0.5rem 1rem",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          },
          ".card": {
            borderLeft: "4px solid var(--color-primary)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: drawerPaperColor,
            color: drawerTextColor,
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            transition: "none",
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
            "&:focus-visible": {
              boxShadow: "none",
            },
          },
          containedPrimary: {
            backgroundColor: primarySolid,
            color: "#FFFFFF",
            border: "none",
            boxShadow: "none",
            transition: "none",
            "&:hover": {
              backgroundColor: primarySolid,
              boxShadow: "none",
              filter: "none",
            },
            "&:active": {
              backgroundColor: primarySolid,
              boxShadow: "none",
            },
            "&:focus-visible": {
              backgroundColor: primarySolid,
              boxShadow: "none",
            },
            "&.Mui-disabled": {
              color: "#FFFFFF",
              backgroundColor: "rgba(32, 78, 154, 0.35)",
            },
          },
          containedSecondary: {
            backgroundColor: accentSolid,
            color: "#FFFFFF",
            border: "none",
            "&:hover": {
              backgroundColor: accentSolid,
              boxShadow: "none",
            },
            "&:active": {
              backgroundColor: accentSolid,
              boxShadow: "none",
            },
            "&:focus-visible": {
              backgroundColor: accentSolid,
              boxShadow: "none",
            },
            "&.Mui-disabled": {
              color: "#FFFFFF",
              backgroundColor: "rgba(41, 174, 179, 0.35)",
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderLeft: "4px solid var(--color-primary)",
          },
        },
      },
      MuiDialogTitle: {
        defaultProps: {
          variant: "h2",
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root:({theme}) => ({
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
            background: (activePalette.containerBackground as SimplePaletteColorOptions)!!.main,
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
            fontSize: CSSClampFnCalculatorRem(0.75, 1, screenSizeRem),
            borderRadius: "100px",
            fontWeight: 500,
          },
          colorSecondary: {
            textTransform: "none",
            justifyContent: "flex-start",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "15.625rem",
            backgroundColor: "var(--color-accent)",
            color: "#FFFFFF",
            borderRadius: "100px",
            paddingInline: "1rem",
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            fontSize: CSSClampFnCalculatorRem(0.75, 0.875, screenSizeRem), // Adjust text size
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
            fontSize: CSSClampFnCalculatorRem(0.75, 0.875, screenSizeRem), // Adjust text size
            padding: "0",
          },
          input: {
            fontSize: CSSClampFnCalculatorRem(0.75, 0.875, screenSizeRem), // Adjust input text size
            padding: "0",
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: CSSClampFnCalculatorRem(0.75, 0.875, screenSizeRem), // Adjust label text size
            padding: "0",
            color: activePalette.text!.secondary,
            opacity: 0.7,
            '&.Mui-focused': {
              color: activePalette.text!.textBlack,
            }
          },
        },
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            '& .MuiInputLabel-root': {
              color: activePalette.text!.secondary,
              opacity: 0.7,
            },
          },
        },
      },
    },
  };
  return createTheme(activeTheme);
};

export default applicationTheme;
