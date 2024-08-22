import { Font, StyleSheet } from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [{ src: "/fonts/Inter-4.0/ttf/Inter-Regular.ttf" }, { src: "/fonts/Inter-4.0/ttf/Inter-Bold.ttf" }],
});

const styles = StyleSheet.create({
  page: {
    display: "flex",
    flexDirection: "column",
    paddingBottom: 100,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: "bold",
    paddingBottom: 18,
    color: "#083763",
    paddingHorizontal: 48,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "bold",
  },
  text: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "normal",
    wordBreak: "break-word",
  },
  boldText: {
    fontFamily: "Inter",
    fontWeight: "bold",
    fontSize: 12,
  },
  experiencesTitle: {
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "bold",
    paddingHorizontal: 48,
    color: "#083763",
  },
  body: {
    display: "flex",
    flexDirection: "column",
  },
  rowView: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
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
    fontFamily: "Inter",
    fontWeight: "normal",
    wordBreak: "break-word",
    color: "#43474E",
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
    width: 16,
    height: 16,
    marginBottom: 2,
    marginRight: 8,
  },
  categoryTitle: {
    fontFamily: "Inter",
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
    fontFamily: "Inter",
    fontWeight: "bold",
    fontSize: 12,
  },
  date: {
    fontSize: 10,
    fontWeight: "normal",
    fontFamily: "Inter",
    paddingVertical: 6,
  },
  contentColumn: {
    display: "flex",
    flexDirection: "column",
  },
  divider: {
    marginHorizontal: 48,
    borderBottomWidth: 1,
    border: 1,
    color: "#43474E",
    marginTop: 12,
    marginBottom: 16,
  },
  logoContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 18,
    paddingHorizontal: 32,
    paddingTop: 32,
    gap: 4,
  },
  image: {
    height: 42,
  },
  compassImage: {
    height: 62,
  },
  infoIcon: {
    height: 12,
  },
  skillsTitle: {
    fontFamily: "Inter",
    fontWeight: "bold",
    fontSize: 12,
    paddingBottom: 4,
  },
  skillText: {
    fontSize: 11,
    color: "#211F1D",
    fontFamily: "Inter",
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
    fontFamily: "Inter",
    fontWeight: "bold",
    paddingBottom: 18,
    color: "#083763",
  },
  info: {
    fontSize: 11,
    fontFamily: "Inter",
    fontWeight: "normal",
    wordBreak: "break-word",
    color: "#43474E",
  },
  skillDivider: {
    borderBottomWidth: 1,
    border: 1,
    color: "#43474E",
    marginTop: 12,
    marginBottom: 20,
  },
  skillContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontFamily: "Inter",
    fontWeight: "bold",
    fontSize: 12,
    color: "#43474E",
  },
  description: {
    fontFamily: "Inter",
    fontWeight: "normal",
    fontSize: 10,
    color: "#43474E",
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
    borderColor: "#666666",
  },
  disclaimerText: {
    display: "flex",
    flex: 1,
    flexWrap: "wrap",
    fontFamily: "Inter",
    fontWeight: "normal",
    fontSize: 9,
    color: "#666666",
  },
  disclaimerTextBold: {
    fontSize: 9,
    color: "#000000",
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
    color: "#666666",
  },
});

export default styles;
