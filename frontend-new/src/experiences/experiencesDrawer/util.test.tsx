import {
  COMPANY_MAX_LENGTH,
  DiveInPhase,
  Experience,
  EXPERIENCE_TITLE_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
  TIMELINE_MAX_LENGTH,
  WorkType,
} from "src/experiences/experienceService/experiences.types";
import {
  checkInitialFieldErrors,
  getExperienceDiff,
  getWorkTypeDescription,
  getWorkTypeIcon,
  getWorkTypeTitle,
  sortSkillsByOrderIndex,
  WORK_TYPE_DESCRIPTIONS,
} from "src/experiences/experiencesDrawer/util";
import { ReportContent } from "src/experiences/report/reportContent";
import StoreIcon from "@mui/icons-material/Store";
import WorkIcon from "@mui/icons-material/Work";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import SchoolIcon from "@mui/icons-material/School";
import QuizIcon from "@mui/icons-material/Quiz";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";

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

  describe("checkInitialFieldErrors", () => {
    test("should return empty object when all fields are valid", () => {
      // GIVEN an experience with all valid fields
      const experience: Experience = mockExperiences[0];

      // WHEN checking for errors
      const errors = checkInitialFieldErrors(experience);

      // THEN it should return an empty object
      expect(errors).toEqual({});
    });

    test("should detect errors for all fields exceeding max length", () => {
      // GIVEN an experience with all fields exceeding max length
      const experience: Experience = {
        UUID: "530043b7-7af4-4207-8313-682d2c9bfae9",
        experience_title: "a".repeat(EXPERIENCE_TITLE_MAX_LENGTH + 1),
        company: "a".repeat(COMPANY_MAX_LENGTH + 1),
        location: "a".repeat(LOCATION_MAX_LENGTH + 1),
        summary: "a".repeat(SUMMARY_MAX_LENGTH + 1),
        timeline: {
          start: "a".repeat(TIMELINE_MAX_LENGTH + 1),
          end: "a".repeat(TIMELINE_MAX_LENGTH + 1),
        },
        top_skills: [],
        remaining_skills: [],
        work_type: WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        exploration_phase: DiveInPhase.PROCESSED,
      };

      // WHEN checking for errors
      const errors = checkInitialFieldErrors(experience);

      // THEN it should return an object with all the field errors
      expect(errors).toEqual({
        experience_title: `Maximum ${EXPERIENCE_TITLE_MAX_LENGTH} characters allowed.`,
        company: `Maximum ${COMPANY_MAX_LENGTH} characters allowed.`,
        location: `Maximum ${LOCATION_MAX_LENGTH} characters allowed.`,
        summary: `Maximum ${SUMMARY_MAX_LENGTH} characters allowed.`,
        timeline_start: `Maximum ${TIMELINE_MAX_LENGTH} characters allowed.`,
        timeline_end: `Maximum ${TIMELINE_MAX_LENGTH} characters allowed.`,
      });
    });
  });

  describe("getExperienceDiff", () => {
    test("should return null when experiences are identical", () => {
      // GIVEN two identical experiences
      const original: Experience = mockExperiences[0];
      const current: Experience = { ...original };

      // WHEN creating a diff
      const diff = getExperienceDiff(original, current);

      // THEN it should return null (no changes)
      expect(diff).toBeNull();
    });

    test("should return object with changed fields only", () => {
      // GIVEN an original experience and a modified current experience
      const original: Experience = mockExperiences[0];
      const current: Experience = {
        ...original,
        experience_title: "Foo Title",
        company: "Bar Company",
        location: "Baz Location",
        summary: "Foo Summary",
        work_type: WorkType.SELF_EMPLOYMENT,
        timeline: {
          start: original.timeline.start,
          end: "December 2023",
        },
        top_skills: [
          {
            UUID: "skill-1",
            description: "foo",
            preferredLabel: "javascript",
            altLabels: ["react"],
            orderIndex: 0,
          },
        ],
      };

      // WHEN creating a diff
      const diff = getExperienceDiff(original, current);

      // THEN it should return an object with only the changed fields
      expect(diff).toEqual({
        experience_title: current.experience_title,
        company: current.company,
        location: current.location,
        summary: current.summary,
        work_type: WorkType.SELF_EMPLOYMENT,
        timeline: {
          start: current.timeline.start,
          end: current.timeline.end,
        },
        top_skills: current.top_skills,
      });
    });
  });

  test("should sort skills by orderIndex in ascending order", () => {
    // GIVEN an experience with skills in random order
    const mockTopSkills = [
      { UUID: "skill-3", preferredLabel: "skill 1", description: "", altLabels: [], orderIndex: 2 },
      { UUID: "skill-1", preferredLabel: "skill 2", description: "", altLabels: [], orderIndex: 0 },
      { UUID: "skill-2", preferredLabel: "skill 3", description: "", altLabels: [], orderIndex: 1 },
    ];
    const experience: Experience = {
      ...mockExperiences[0],
      top_skills: mockTopSkills,
    };

    // WHEN sorting the skills
    const sortedSkills = sortSkillsByOrderIndex(experience.top_skills);

    // THEN expect the skills to be sorted by orderIndex in ascending order
    expect(sortedSkills.map((skill) => skill.orderIndex)).toEqual([0, 1, 2]);
    // AND the order of UUIDs should match the expected sorted order
    expect(sortedSkills.map((skill) => skill.UUID)).toEqual(["skill-1", "skill-2", "skill-3"]);
    // AND it should not mutate the original array
    expect(experience.top_skills.map((skill) => skill.UUID)).toEqual(["skill-3", "skill-1", "skill-2"]);
  });
});
