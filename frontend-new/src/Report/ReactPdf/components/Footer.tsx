import React from "react";
import styles from "src/Report/ReactPdf/styles";
import { View, Text } from "@react-pdf/renderer";
import { ReportContent } from "src/Report/ReportContent";
import { Image } from "src/Report/ReactPdf/Report";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { getBase64Image } from "src/Report/util";

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
