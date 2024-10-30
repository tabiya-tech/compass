import Report from "src/experiences/report/reactPdf/Report";
import { Meta } from "@storybook/react";
import { generateRandomExperiences } from "src/experiences/experiencesDrawer/experienceService/_test_utilities/mockExperiencesResponses";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { ReportProps } from "src/experiences/report/types";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

const meta: Meta = {
  title: "Report/ReportPdf",
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

const mockedData = {
  name: "John Doe",
  email: "john.doe@example.com",
  phone: "123-456-7890",
  address: "123 Main St, Chicago, USA",
  experiences: generateRandomExperiences(2),
  conversationConductedAt: "2021-08-01T00:00:00Z",
};

const generatePdf = async (data: ReportProps) => {
  const fileName = "compass-skills-report.pdf";
  const blob = await pdf(<Report {...data} />).toBlob();
  saveAs(blob, fileName);
};

export const Shown = () => <PrimaryButton onClick={() => generatePdf(mockedData)}>Download Report Pdf</PrimaryButton>;

export const ShownWithSingleExperience = () => {
  return (
    <PrimaryButton
      onClick={() =>
        generatePdf({
          ...mockedData,
          experiences: generateRandomExperiences(1).slice(0, 1),
        })
      }
    >
      Download Report Pdf
    </PrimaryButton>
  );
};

export const ShownWithManyExperiences = () => {
  return (
    <PrimaryButton
      onClick={() =>
        generatePdf({
          ...mockedData,
          experiences: generateRandomExperiences(10),
        })
      }
    >
      Download Report Pdf
    </PrimaryButton>
  );
};

export const ShownWithNoPersonalInfo = () => {
  return (
    <PrimaryButton
      onClick={() =>
        generatePdf({
          ...mockedData,
          name: "",
          email: "",
          phone: "",
          address: "",
        })
      }
    >
      Download Report Pdf
    </PrimaryButton>
  );
};

export const ShownWithSomePersonalInfo = () => {
  return (
    <PrimaryButton
      onClick={() =>
        generatePdf({
          ...mockedData,
          email: "",
          phone: "",
        })
      }
    >
      Download Report Pdf
    </PrimaryButton>
  );
};

export const ShownWithNoCompany = () => {
  return (
    <PrimaryButton
      onClick={() =>
        generatePdf({
          ...mockedData,
          experiences: [
            {
              ...generateRandomExperiences(1)[0],
              company: "",
            },
          ],
        })
      }
    >
      Download Report Pdf
    </PrimaryButton>
  );
};

export const ShownWithNoLocation = () => {
  return (
    <PrimaryButton
      onClick={() =>
        generatePdf({
          ...mockedData,
          experiences: [
            {
              ...generateRandomExperiences(1)[0],
              location: "",
            },
          ],
        })
      }
    >
      Download Report Pdf
    </PrimaryButton>
  );
};
