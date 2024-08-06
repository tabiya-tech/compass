import { Font, StyleSheet } from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [{ src: "/fonts/Inter-4.0/ttf/Inter-Regular.ttf" }, { src: "/fonts/Inter-4.0/ttf/Inter-Bold.ttf" }],
});

const styles = StyleSheet.create({
  page: {
    display: "flex",
    flexDirection: "column",
    padding: 26,
    color: "#403E39",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter",
    fontWeight: "bold",
    paddingBottom: 36,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: "bold",
    paddingBottom: 8,
  },
  text: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "normal",
    paddingBottom: 8,
    wordBreak: "break-word",
  },
  boldText: {
    fontFamily: "Inter",
    fontWeight: "bold",
    fontSize: 12,
  },
  darkText: {
    fontSize: 13,
    color: "#0d0d0f",
  },
  experiencesTitle: {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "bold",
    paddingBottom: 36,
  },
  body: {
    display: "flex",
    flexDirection: "column",
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
    gap: 2,
  },
  column: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
  },
  bodyText: {
    fontSize: 12,
    paddingBottom: 36,
    fontFamily: "Inter",
    fontWeight: "normal",
    wordBreak: "break-word",
  },
  experiencesContainer: {
    display: "flex",
    flexDirection: "column",
  },
  container: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingBottom: 16,
  },
  experienceTitle: {
    fontFamily: "Inter",
    fontWeight: "bold",
    fontSize: 12,
    paddingBottom: 16,
  },
  firstColumn: {
    fontSize: 12,
    flexBasis: 200,
    fontWeight: "bold",
    fontFamily: "Inter",
  },
  secondColumn: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    marginBottom: 8,
  },
  imageContainer: {
    display: "flex",
    flexDirection: "row",
    position: "absolute",
    alignItems: "center",
    right: 26,
    bottom: 16,
    gap: 2,
  },
  image: {
    height: 26,
    marginTop: 56,
  },
  compassImage: {
    height: 30,
    marginTop: 56,
  },
  pageNumber: {
    position: "absolute",
    fontSize: 12,
    bottom: 16,
    left: 26,
    textAlign: "center",
    color: "#403E39",
  },
});

export default styles;
