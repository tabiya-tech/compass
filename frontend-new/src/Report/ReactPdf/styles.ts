import { Font, StyleSheet } from "@react-pdf/renderer";
import { TabiyaBasicColors } from "src/theme/applicationTheme/applicationTheme";
import { COLORS } from "src/Report/util";

// Function to check if running in Storybook
const isStorybook = () => {
  return process.env.STORYBOOK === "true";
};

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
    ...(isStorybook() ? {} : { fontFamily: "Inter" }),
    display: "flex",
    flexDirection: "column",
    paddingBottom: 100,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    paddingBottom: 18,
    color: TabiyaBasicColors.DarkBlue,
    paddingHorizontal: 48,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "bold",
  },
  text: {
    fontSize: 12,
    wordBreak: "break-word",
  },
  boldText: {
    fontWeight: "bold",
    fontSize: 12,
  },
  experiencesTitle: {
    fontSize: 13,
    fontWeight: "bold",
    paddingHorizontal: 48,
    color: TabiyaBasicColors.DarkBlue,
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
    paddingBottom: 18,
  },
  bodyText: {
    fontSize: 11,
    wordBreak: "break-word",
    color: TabiyaBasicColors.GrayDark,
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
    height: 16,
    marginBottom: 2,
    marginRight: 8,
  },
  categoryTitle: {
    fontWeight: "bold",
    fontSize: 13,
  },
  container: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  experienceTitle: {
    fontWeight: "bold",
    fontSize: 12,
  },
  experienceInfo: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    fontSize: 10,
    paddingVertical: 6,
  },
  location: {
    fontWeight: "normal",
    fontStyle: "italic",
    paddingLeft: 4,
  },
  contentColumn: {
    display: "flex",
    flexDirection: "column",
  },
  divider: {
    marginHorizontal: 48,
    borderBottomWidth: 1,
    border: 1,
    color: TabiyaBasicColors.GrayDark,
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
    height: 42,
  },
  compassImage: {
    height: 46,
  },
  infoIcon: {
    height: 12,
  },
  skillsTitle: {
    fontWeight: "bold",
    fontSize: 12,
    paddingBottom: 4,
  },
  skillText: {
    fontSize: 11,
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
    fontWeight: "bold",
    paddingBottom: 18,
    color: TabiyaBasicColors.DarkBlue,
  },
  info: {
    fontSize: 11,
    wordBreak: "break-word",
    color: TabiyaBasicColors.GrayDark,
  },
  skillDivider: {
    borderBottomWidth: 1,
    border: 1,
    color: TabiyaBasicColors.GrayDark,
    marginTop: 12,
    marginBottom: 20,
  },
  skillContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontWeight: "bold",
    fontSize: 12,
    color: TabiyaBasicColors.GrayDark,
  },
  description: {
    fontSize: 10,
    color: TabiyaBasicColors.GrayDark,
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
    borderColor: TabiyaBasicColors.GrayDark,
  },
  disclaimerText: {
    display: "flex",
    flex: 1,
    flexWrap: "wrap",
    fontSize: 9,
    color: COLORS.grey700,
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
    color: TabiyaBasicColors.GrayDark,
  },
});

export default styles;
