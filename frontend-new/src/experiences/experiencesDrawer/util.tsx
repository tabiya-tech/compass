import React from "react";
import { WorkType } from "src/experiences/experienceService/experiences.types";
import { ReportContent } from "src/experiences/report/reportContent";
import StoreIcon from "@mui/icons-material/Store";
import WorkIcon from "@mui/icons-material/Work";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import SchoolIcon from "@mui/icons-material/School";
import QuizIcon from "@mui/icons-material/Quiz";

export const WORK_TYPE_DESCRIPTIONS = {
  SELF_EMPLOYMENT: "You work for yourself, run your own business, or take on freelance or contract jobs",
  FORMAL_SECTOR_WAGED_EMPLOYMENT: "You have a paid job and work for an employer, company, or organization",
  FORMAL_SECTOR_UNPAID_TRAINEE_WORK: "You're in a training or internship role to gain skills or experience",
  UNSEEN_UNPAID: "You do unpaid work like caregiving, household tasks, or community volunteering",
  UNCATEGORIZED: "Compass couldn't categorize this work type",
};

export const getWorkTypeTitle = (workType: WorkType | null) => {
  switch (workType) {
    case WorkType.SELF_EMPLOYMENT:
      return ReportContent.SELF_EMPLOYMENT_TITLE;
    case WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
      return ReportContent.SALARY_WORK_TITLE;
    case WorkType.UNSEEN_UNPAID:
      return ReportContent.UNPAID_WORK_TITLE;
    case WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
      return ReportContent.TRAINEE_WORK_TITLE;
    default:
      return ReportContent.UNCATEGORIZED_TITLE;
  }
};

export const getWorkTypeDescription = (workType: WorkType | null) => {
  switch (workType) {
    case WorkType.SELF_EMPLOYMENT:
      return WORK_TYPE_DESCRIPTIONS.SELF_EMPLOYMENT;
    case WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
      return WORK_TYPE_DESCRIPTIONS.FORMAL_SECTOR_WAGED_EMPLOYMENT;
    case WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
      return WORK_TYPE_DESCRIPTIONS.FORMAL_SECTOR_UNPAID_TRAINEE_WORK;
    case WorkType.UNSEEN_UNPAID:
      return WORK_TYPE_DESCRIPTIONS.UNSEEN_UNPAID;
    default:
      return WORK_TYPE_DESCRIPTIONS.UNCATEGORIZED;
  }
};

export const getWorkTypeIcon = (workType: WorkType | null) => {
  switch (workType) {
    case WorkType.SELF_EMPLOYMENT:
      return <StoreIcon />;
    case WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
      return <WorkIcon />;
    case WorkType.UNSEEN_UNPAID:
      return <VolunteerActivismIcon />;
    case WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
      return <SchoolIcon />;
    default:
      return <QuizIcon />;
  }
};
