import React from "react";
import { Meta } from "@storybook/react";
import SkillReportDocx from "src/Report/ReportDocx/ReportDocx";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { generateRandomExperiences } from "src/Experiences/ExperienceService/_test_utilities/mockExperiencesResponses";

const meta: Meta = {
  title: "Report/ReportDocx",
  tags: ["autodocs"],
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

export const Shown = () => (
  <PrimaryButton onClick={() => SkillReportDocx(mockedData)}>Download Report Docx</PrimaryButton>
);

export const ShownWithSingleExperience = () => {
  return (
    <PrimaryButton
      onClick={() =>
        SkillReportDocx({
          ...mockedData,
          experiences: generateRandomExperiences(1).slice(0, 1),
        })
      }
    >
      Download Report Docx
    </PrimaryButton>
  );
};

export const ShownWithManyExperiences = () => {
  return (
    <PrimaryButton
      onClick={() =>
        SkillReportDocx({
          ...mockedData,
          experiences: generateRandomExperiences(10),
        })
      }
    >
      Download Report Docx
    </PrimaryButton>
  );
};

export const ShowWithNoPersonalInfo = () => {
  return (
    <PrimaryButton
      onClick={() =>
        SkillReportDocx({
          ...mockedData,
          name: "",
          email: "",
          phone: "",
          address: "",
        })
      }
    >
      Download Report Docx
    </PrimaryButton>
  );
};

export const ShownWithSomePersonalInfo = () => {
  return (
    <PrimaryButton
      onClick={() =>
        SkillReportDocx({
          ...mockedData,
          email: "",
          phone: "",
        })
      }
    >
      Download Report Docx
    </PrimaryButton>
  );
};

export const ShownWithNoCompany = () => {
  return (
    <PrimaryButton
      onClick={() =>
        SkillReportDocx({
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
      Download Report Docx
    </PrimaryButton>
  );
};

export const ShownWithNoLocation = () => {
  return (
    <PrimaryButton
      onClick={() =>
        SkillReportDocx({
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
      Download Report Docx
    </PrimaryButton>
  );
};
