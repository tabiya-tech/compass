import React from "react";
import styles from "src/experiences/report/reactPdf/styles";
import { View, Text } from "@react-pdf/renderer";
import { ReportContent } from "src/experiences/report/reportContent";
import { Image } from "src/experiences/report/reactPdf/Report";
import { Experience } from "src/experiences/experiencesDrawer/experienceService/experiences.types";
import { getBase64Image } from "src/experiences/report/util";

const Footer: React.FC<{ experiences: Experience[] }> = ({ experiences }) => (
  <View fixed style={styles.footer}>
    <View style={styles.disclaimerContainer}>
      <Image src={getBase64Image(ReportContent.IMAGE_URLS.WARNING_ICON)} style={styles.disclaimerIcon} />
      <Text x={0} y={0} style={styles.disclaimerText}>
        {" "}
        {ReportContent.DISCLAIMER_TEXT_PART1}{" "}
        <Text x={0} y={0} style={styles.disclaimerTextBold}>
          {ReportContent.DISCLAIMER_TEXT_PART2}{" "}
        </Text>
        {ReportContent.DISCLAIMER_TEXT_PART3}
      </Text>
    </View>
    {experiences.length > 2 ? (
      <Text
        x={0}
        y={0}
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    ) : null}
  </View>
);

export default Footer;
