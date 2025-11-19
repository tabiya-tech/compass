import { Font, StyleSheet } from "@react-pdf/renderer";
import { TabiyaBasicColors } from "src/theme/applicationTheme/applicationTheme";
import { COLORS } from "src/experiences/report/util";

// Function to check if running in Storybook
const isStorybook = () => {
  return process.env.STORYBOOK === "true";
};

// Function to return the font styles
const getFontStyles = () => ({
  general: {
    fontFamily: isStorybook() ? "Times-Roman" : "Inter",
  },
  regular: {
    fontFamily: isStorybook() ? "Times-Roman" : "Inter",
    fontWeight: "normal" as const,
  },
  bold: {
    fontFamily: isStorybook() ? "Times-Bold" : "Inter",
    fontWeight: "bold" as const,
  },
  italic: {
    fontFamily: isStorybook() ? "Times-Italic" : "Inter",
    fontStyle: "italic" as const,
  },
});

const fontStyles = getFontStyles();

Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/Inter-4.0/ttf/Inter-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Inter-4.0/ttf/Inter-Bold.ttf", fontWeight: "bold" },
    { src: "/fonts/Inter-4.0/ttf/Inter-Italic.ttf", fontStyle: "italic" },
  ],
});

const styles = StyleSheet.create({
  page: {
    ...fontStyles.general,
    display: "flex",
    flexDirection: "column",
    paddingBottom: 126,
    color: COLORS.textBlack,
  },
  title: {
    fontSize: 16,
    paddingBottom: 18,
    color: TabiyaBasicColors.DarkBlue,
    paddingHorizontal: 48,
    ...fontStyles.bold,
  },
  subtitle: {
    fontSize: 14,
    ...fontStyles.bold,
  },
  text: {
    fontSize: 12,
    wordBreak: "break-word",
  },
  experiencesTitle: {
    fontSize: 14,
    paddingHorizontal: 48,
    color: TabiyaBasicColors.DarkBlue,
    ...fontStyles.bold,
  },
  body: {
    display: "flex",
    flexDirection: "column",
  },
  rowView: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  column: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: 4,
    paddingHorizontal: 48,
  },
  bodyText: {
    fontSize: 11,
    wordBreak: "break-word",
    paddingHorizontal: 48,
  },
  experiencesContainer: {
    display: "flex",
    flexDirection: "column",
    paddingHorizontal: 48,
    paddingTop: 16,
  },
  categoryContainer: {
    display: "flex",
    flexDirection: "column",
    paddingBottom: 10,
  },
  categoryTitleContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryIcon: {
    height: 13,
    marginBottom: 2,
    marginRight: 8,
  },
  categoryTitle: {
    fontSize: 13,
    ...fontStyles.bold,
  },
  container: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  experienceTitle: {
    fontSize: 12,
    ...fontStyles.bold,
  },
  summary: {
    fontSize: 11,
    paddingBottom: 6,
    wordBreak: "break-word",
  },
  experienceInfo: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    fontSize: 10,
    paddingVertical: 6,
  },
  location: {
    paddingLeft: 4,
    ...fontStyles.italic,
  },
  contentColumn: {
    display: "flex",
    flexDirection: "column",
  },
  divider: {
    marginHorizontal: 48,
    borderBottomWidth: 1,
    border: 1,
    marginTop: 12,
    marginBottom: 16,
  },
  logoContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 18,
    paddingHorizontal: 48,
    paddingTop: 32,
    gap: 26,
  },
  image: {
    height: 20,
  },
  compassImage: {
    height: 20,
  },
  placeholderImage: {
    height: 30,
  },
  infoIcons: {
    width: 14,
    height: 12,
  },
  infoIcon: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
  },
  skillsTitle: {
    fontSize: 11,
    paddingBottom: 4,
    ...fontStyles.bold,
  },
  skillText: {
    fontSize: 10,
    color: "#211F1D",
  },
  skillsContainer: {
    display: "flex",
    flexDirection: "column",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 4,
  },
  skillDescriptionContainer: {
    display: "flex",
    flexDirection: "column",
    paddingHorizontal: 48,
  },
  skillDescriptionTitle: {
    fontSize: 16,
    paddingBottom: 18,
    color: TabiyaBasicColors.DarkBlue,
    ...fontStyles.bold,
  },
  info: {
    fontSize: 11,
    wordBreak: "break-word",
  },
  skillDivider: {
    borderBottomWidth: 1,
    border: 1,
    marginTop: 12,
    marginBottom: 20,
  },
  skillContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontSize: 11,
    ...fontStyles.bold,
  },
  description: {
    fontSize: 10,
    paddingBottom: 12,
  },
  footer: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    paddingBottom: 26,
    position: "absolute",
    gap: 16,
    bottom: 0,
  },
  disclaimerContainer: {
    display: "flex",
    flexDirection: "row",
    marginHorizontal: 48,
    padding: 8,
    border: 1,
  },
  disclaimerText: {
    display: "flex",
    flex: 1,
    flexWrap: "wrap",
    fontSize: 9,
    color: TabiyaBasicColors.GrayDark,
  },
  disclaimerTextBold: {
    fontSize: 9,
    color: COLORS.textBlack,
  },
  disclaimerIcon: {
    width: 12,
    height: 12,
  },
  pageNumber: {
    fontSize: 10,
    display: "flex",
    justifyContent: "center",
    textAlign: "center",
  },
});

export default styles;
