import { Experience, Skill, WorkType } from "src/Experiences/ExperienceService/Experiences.types";
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

export const mockExperiences: Experience[] = [
  {
    UUID: "c3c8b43d-73dd-4c6d-9e71-010492e86d5e",
    start_date: "2022",
    end_date: "Present",
    experience_title: "Project Manager",
    company: "Business Inc",
    location: "New York, NY",
    work_type: WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
    top_skills: [
      {
        UUID: "2512652c-49ba-4751-b654-8fc525ce98ca",
        preferredLabel: "Management",
        description: "The process of dealing with or controlling things or people",
        altLabels: ["Leadership", "Administration"],
      },
      {
        UUID: "815f3660-4c7f-43ba-859d-cf50dd527fe0",
        preferredLabel: "Communication",
        description: "The imparting or exchanging of information or news",
        altLabels: ["Interpersonal Communication", "Public Speaking"],
      },
    ],
  },
];

const generateRandomSkill = (): Skill => {
  return {
    UUID: uuidv4(),
    preferredLabel: faker.hacker.adjective() + " " + faker.hacker.noun(),
    description: faker.hacker.phrase(),
    altLabels: [faker.hacker.verb(), faker.hacker.adjective()],
  };
};

const formatShortDate = (date: Date): string => format(date, "MMM yyyy");

const generateRandomDate = (): string => {
  return formatShortDate(faker.date.past());
};

const generateStandaloneDate = (): string => {
  const chance = Math.random();
  return chance < 0.5 ? "A long time ago" : "Since I was five";
};

const generateRandomExperience = (): Experience => {
  const useStandaloneDate = Math.random() < 0.5;
  const startDate = useStandaloneDate ? generateStandaloneDate() : generateRandomDate();
  const endDate = useStandaloneDate ? "" : Math.random() > 0.5 ? generateRandomDate() : "Present";

  return {
    UUID: uuidv4(),
    start_date: startDate,
    end_date: endDate,
    experience_title: faker.name.jobTitle(),
    company: faker.company.name(),
    location: faker.location.city(),
    work_type: Math.random() > 0.5 ? WorkType.SELF_EMPLOYMENT : WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
    top_skills: [
      generateRandomSkill(),
      generateRandomSkill(),
      generateRandomSkill(),
      generateRandomSkill(),
      generateRandomSkill(),
    ],
  };
};

export const generateRandomExperiences = (count: number): Experience[] => {
  const experiences: Experience[] = [];
  for (let i = 0; i < count; i++) {
    experiences.push(generateRandomExperience());
  }
  return experiences;
};
