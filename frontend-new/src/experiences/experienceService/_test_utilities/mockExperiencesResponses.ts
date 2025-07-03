import { DiveInPhase, Experience, Skill, WorkType } from "src/experiences/experienceService/experiences.types";
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

export const mockExperiences: Experience[] = [
  {
    UUID: "c3c8b43d-73dd-4c6d-9e71-010492e86d5e",
    timeline: {
      start: "2022",
      end: "Present",
    },
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
    summary:
      "Managed multiple projects simultaneously, ensuring timely delivery and client satisfaction. Coordinated cross-functional teams of developers, designers, and stakeholders to achieve project milestones. Implemented agile methodologies that " +
      "improved delivery efficiency by 30%. Conducted regular client meetings to gather feedback and ensure alignment with business objectives. Resolved critical issues during development cycles to prevent delays and maintain quality standards.",
    exploration_phase: DiveInPhase.EXPLORING_SKILLS,
  },
  {
    UUID: "607c19f8-60e2-4c70-ac5a-6ce95426423c",
    timeline: {
      start: "2022",
      end: "Present",
    },
    experience_title: "Software Engineer",
    company: "Business Inc",
    location: "New York, NY",
    work_type: WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
    top_skills: [
      {
        UUID: "65a46171-a72e-42f7-bf8b-a685b795d1ab",
        preferredLabel: "Python Programming",
        description: "The ability to write code in Python",
        altLabels: ["Python Development", "Software Development"],
      },
    ],
    summary:
      "Managed multiple projects simultaneously, ensuring timely delivery and client satisfaction. Coordinated cross-functional teams of developers, designers, and stakeholders to achieve project milestones. Implemented agile methodologies that " +
      "improved delivery efficiency by 30%. Conducted regular client meetings to gather feedback and ensure alignment with business objectives. Resolved critical issues during development cycles to prevent delays and maintain quality standards.",
    exploration_phase: DiveInPhase.EXPLORING_SKILLS,
  },
];

const allWorkTypes = [
  WorkType.SELF_EMPLOYMENT,
  WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
  WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
  WorkType.UNSEEN_UNPAID,
];

const skillsLabels = [
  "work in an organised manner",
  "administer ingredients in food production",
  "sales activities",
  "unload supplies",
  "perform outdoor cleaning activities",
  "selling Kotas",
  "helping Brother with Car",
  "community Volunteering",
  "ensured the project was completed on time",
  "took care of the garden",
  "communication",
  "helped with the family business",
  "time management",
  "organise product display",
  "assist customers",
  "maintain work area cleanliness",
  "teamwork",
  "attention to details",
  "problem solving",
];

const companyNames = [
  "Tech Innovators Inc",
  "Global Solutions Ltd",
  "Creative Minds Co",
  "Business Ventures LLC",
  "Enterprise Corp",
  "Insight Analytics",
  "Visionary Labs",
  "BrightPath Consultants",
  "NextGen Enterprises",
  "Skyline Technologies",
];

const locations = [
  "New York, NY",
  "San Francisco, CA",
  "Austin, TX",
  "Seattle, WA",
  "Boston, MA",
  "Chicago, IL",
  "Los Angeles, CA",
  "Denver, CO",
  "Miami, FL",
  "Atlanta, GA",
];

const jobTitles = [
  "Software Engineer",
  "Project Manager",
  "Data Scientist",
  "Marketing Specialist",
  "Product Designer",
  "Sales Representative",
  "Operations Manager",
  "HR Coordinator",
  "Financial Analyst",
  "Content Writer",
];

const generateRandomSkill = (usedLabels: string[]): Skill => {
  let randomLabel;
  do {
    randomLabel = skillsLabels[Math.floor(Math.random() * skillsLabels.length)];
  } while (usedLabels.includes(randomLabel));
  usedLabels.push(randomLabel);
  return {
    UUID: uuidv4(),
    preferredLabel: randomLabel,
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

const generateRandomExperience = (workType?: WorkType): Experience => {
  const useStandaloneDate = Math.random() < 0.5;
  const startDate = useStandaloneDate ? generateStandaloneDate() : generateRandomDate();
  const endDate = useStandaloneDate ? "" : Math.random() > 0.5 ? generateRandomDate() : "Present";
  const randomWorkType = workType || allWorkTypes[Math.floor(Math.random() * allWorkTypes.length)];
  const usedLabels: string[] = [];

  return {
    UUID: uuidv4(),
    timeline: {
      start: startDate,
      end: endDate,
    },
    experience_title: jobTitles[Math.floor(Math.random() * jobTitles.length)],
    summary: faker.lorem.paragraphs(3, "\n"),
    company: companyNames[Math.floor(Math.random() * companyNames.length)],
    location: locations[Math.floor(Math.random() * locations.length)],
    work_type: randomWorkType,
    top_skills: [
      generateRandomSkill(usedLabels),
      generateRandomSkill(usedLabels),
      generateRandomSkill(usedLabels),
      generateRandomSkill(usedLabels),
      generateRandomSkill(usedLabels),
    ],
    exploration_phase: DiveInPhase.EXPLORING_SKILLS,
  };
};

export const generateRandomExperiences = (count: number): Experience[] => {
  const experiences: Experience[] = [];

  // ensure at least one experience is present for each work type
  allWorkTypes.forEach((workType) => {
    experiences.push(generateRandomExperience(workType));
  });

  // generate the rest of the experiences
  for (let i = 0; i < count; i++) {
    experiences.push(generateRandomExperience());
  }
  return experiences;
};
