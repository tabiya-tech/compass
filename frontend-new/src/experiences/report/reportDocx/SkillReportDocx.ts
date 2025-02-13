import { Packer } from "docx";
import { Experience } from "src/experiences/experiencesDrawer/experienceService/experiences.types";
import { constructSkillReportDocument } from "src/experiences/report/reportDocx/constructSkillReportDocument";

interface SkillReportDocxProps {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationConductedAt: string | null;
}

const SkillReportDocx = async (props: SkillReportDocxProps): Promise<Blob> => {
  const doc = await constructSkillReportDocument(props);
  return Packer.toBlob(doc);
};

export default SkillReportDocx;
