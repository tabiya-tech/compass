import { Font, StyleSheet } from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [{ src: "/fonts/Inter-4.0/ttf/Inter-Regular.ttf" }, { src: "/fonts/Inter-4.0/ttf/Inter-Bold.ttf" }],
});

const styles = StyleSheet.create({
  page: {
    display: "flex",
    height: "100vh",
    flexDirection: "column",
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
    marginBottom: 16,
    paddingHorizontal: 48,
  },
  body: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    paddingBottom: 36,
  },
  row: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 28,
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
    gap: 8,
    paddingHorizontal: 48,
  },
  bodyText: {
    fontSize: 11,
    paddingTop: 18,
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
  },
  container: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingBottom: 10,
  },
  experienceTitle: {
    fontFamily: "Inter",
    fontWeight: "bold",
    fontSize: 12,
    paddingBottom: 4,
  },
  date: {
    fontSize: 10,
    fontWeight: "normal",
    fontFamily: "Inter",
    paddingBottom: 8,
  },
  secondColumn: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    marginBottom: 8,
  },
  divider: {
    marginHorizontal: 48,
    borderBottomWidth: 1,
    border: 1,
    color: "#43474E",
    marginTop: 28,
    marginBottom: 16,
  },
  logoContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 20,
    paddingHorizontal: 32,
    paddingTop: 40,
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
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BBB9B5",
    borderRadius: 16,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  chipText: {
    fontSize: 11,
    color: "#211F1D",
    fontFamily: "Inter",
  },
  chipContainer: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  disclaimerContainer: {
    display: "flex",
    flexDirection: "row",
    marginHorizontal: 48,
    marginTop: 32,
    marginBottom: 56,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
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
    position: "absolute",
    fontSize: 10,
    bottom: 26,
    left: 48,
    right: 48,
    textAlign: "center",
    color: "#666666",
  },
});

export default styles;
