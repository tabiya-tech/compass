import React from "react";
import styles from "src/experiences/report/reportPdf/styles";
import { View, Text } from "@react-pdf/renderer";

const Footer: React.FC = () => (
  <View fixed style={styles.footer}>
    <Text
      x={0}
      y={0}
      style={styles.pageNumber}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    />
  </View>
);

export default Footer;
