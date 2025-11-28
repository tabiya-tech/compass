import React from "react";
import { View, Text } from "@react-pdf/renderer";
import styles from "src/experiences/report/reportPdf/styles";
import { ReportContent } from "src/experiences/report/reportContent";

interface SkillsDescriptionProps {
  skillsList: { UUID: string; preferredLabel: string; description: string }[];
}

const SkillsDescription: React.FC<SkillsDescriptionProps> = ({ skillsList }) => (
  <View style={styles.skillDescriptionContainer} break>
    <Text x={0} y={0} style={styles.skillDescriptionTitle}>
      {ReportContent.SKILLS_DESCRIPTION_TITLE}
    </Text>
    <Text x={0} y={0} style={styles.info}>
      {ReportContent.SKILLS_DESCRIPTION_TEXT}
    </Text>
    <View style={styles.skillDivider} />
    {skillsList.map((skill) => (
      <View wrap={false} key={skill.UUID} style={styles.skillContainer}>
        <Text x={0} y={0} style={styles.label}>
          {skill.preferredLabel.charAt(0).toUpperCase() + skill.preferredLabel.slice(1)}
        </Text>
        <Text x={0} y={0} style={styles.description}>
          {skill.description}
        </Text>
      </View>
    ))}
  </View>
);

export default SkillsDescription;
