import { WorkType } from "src/experiences/experienceService/experiences.types";
import {
  WORK_TYPE_DESCRIPTIONS,
  getWorkTypeDescription,
  getWorkTypeIcon,
  getWorkTypeTitle,
} from "src/experiences/experiencesDrawer/util";
import { ReportContent } from "src/experiences/report/reportContent";
import StoreIcon from "@mui/icons-material/Store";
import WorkIcon from "@mui/icons-material/Work";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import SchoolIcon from "@mui/icons-material/School";
import QuizIcon from "@mui/icons-material/Quiz";

describe("experiencesDrawer util", () => {
  test.each([
    // GIVEN a work type and its expected title
    [WorkType.SELF_EMPLOYMENT, ReportContent.SELF_EMPLOYMENT_TITLE],
    [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, ReportContent.SALARY_WORK_TITLE],
    [WorkType.UNSEEN_UNPAID, ReportContent.UNPAID_WORK_TITLE],
    [WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK, ReportContent.TRAINEE_WORK_TITLE],
    [null, ReportContent.UNCATEGORIZED_TITLE],
  ])("should return the correct work type title for %p", (workType, expectedTitle) => {
    // WHEN calling getWorkTypeTitle with the work type
    // THEN it should return the correct title
    expect(getWorkTypeTitle(workType)).toBe(expectedTitle);
  });

  test.each([
    // GIVEN a work type and its expected description
    [WorkType.SELF_EMPLOYMENT, WORK_TYPE_DESCRIPTIONS.SELF_EMPLOYMENT],
    [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WORK_TYPE_DESCRIPTIONS.FORMAL_SECTOR_WAGED_EMPLOYMENT],
    [WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK, WORK_TYPE_DESCRIPTIONS.FORMAL_SECTOR_UNPAID_TRAINEE_WORK],
    [WorkType.UNSEEN_UNPAID, WORK_TYPE_DESCRIPTIONS.UNSEEN_UNPAID],
    [null, WORK_TYPE_DESCRIPTIONS.UNCATEGORIZED],
  ])("should return the correct work type description for %p", (workType, expectedDescription) => {
    // WHEN calling getWorkTypeDescription with the work type
    // THEN it should return the correct description
    expect(getWorkTypeDescription(workType)).toBe(expectedDescription);
  });

  test.each([
    // GIVEN a work type and its expected icon
    [WorkType.SELF_EMPLOYMENT, StoreIcon],
    [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkIcon],
    [WorkType.UNSEEN_UNPAID, VolunteerActivismIcon],
    [WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK, SchoolIcon],
    [null, QuizIcon],
  ])("should return the correct work type icon for %p", (workType, expectedIcon) => {
    // WHEN calling getWorkTypeIcon with the work type
    // THEN it should return the correct icon
    expect(getWorkTypeIcon(workType).type).toBe(expectedIcon);
  });
});
