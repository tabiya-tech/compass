import { Skill } from "src/experiences/experienceService/experiences.types";
import { DuplicateSkillError } from "../error/commonErrors";

/**
 * Deduplicates skills by UUID and returns information about duplicates found
 */
export const deduplicateSkills = (
  skills: Skill[]
): {
  uniqueSkills: Skill[];
  hasDuplicates: boolean;
  duplicateCount: number;
  duplicates: Skill[];
} => {
  const seenUuids = new Set<string>();
  const uniqueSkills: Skill[] = [];
  const duplicates: Skill[] = [];

  for (const skill of skills) {
    if (seenUuids.has(skill.UUID)) {
      duplicates.push(skill);
      console.warn(new DuplicateSkillError("Duplicate skill found", skill));
    } else {
      seenUuids.add(skill.UUID);
      uniqueSkills.push(skill);
    }
  }

  return {
    uniqueSkills,
    hasDuplicates: duplicates.length > 0,
    duplicateCount: duplicates.length,
    duplicates,
  };
};
