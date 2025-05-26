import { QuestionType, YesNoEnum, QuestionsConfig } from "./overallFeedbackForm.types";
import {
  WORK_EXPERIENCE_ACCURACY_QUESTION_ID
} from "./components/formContent/questionComponents/workExperienceAccuracy/constants";
import { RECOMMENDATION_QUESTION_ID } from "./components/formContent/questionComponents/recommendation/constants";
import { PERCEIVED_BIAS_QUESTION_ID } from "./components/formContent/questionComponents/perceivedBias/constants";
import { MISSING_SKILLS_QUESTION_ID } from "./components/formContent/questionComponents/missingSkills/constants";
import { INTERACTION_EASE_QUESTION_ID } from "./components/formContent/questionComponents/interactionEase/constants";
import { INCORRECT_SKILLS_QUESTION_ID } from "./components/formContent/questionComponents/incorrectSkills/constants";
import {
  CUSTOMER_SATISFACTION_QUESTION_KEY
} from "./components/formContent/questionComponents/customerSatisfactionRating/constants";
import { CLARITY_OF_SKILLS_QUESTION_ID } from "./components/formContent/questionComponents/clarityOfSkills/constants";
import {
  ADDITIONAL_FEEDBACK_QUESTION_ID
} from "./components/formContent/questionComponents/additionalFeedback/constants";

export const mockQuestionsConfig: QuestionsConfig = {
  [PERCEIVED_BIAS_QUESTION_ID]: {
    question_id: PERCEIVED_BIAS_QUESTION_ID,
    question_text: "Did you notice any bias in the conversation?",
    description: "Please let us know if you noticed any bias",
    type: QuestionType.YesNo,
    comment_placeholder: "Please share your thoughts (optional)",
    show_comments_on: YesNoEnum.Yes,
  },
  [WORK_EXPERIENCE_ACCURACY_QUESTION_ID]: {
    question_id: WORK_EXPERIENCE_ACCURACY_QUESTION_ID,
    question_text: "How accurate was the work experience information?",
    description: "Please rate the accuracy of the work experience information",
    type: QuestionType.Checkbox,
    options: {
      "1": "Very accurate",
      "2": "Somewhat accurate",
      "3": "Not accurate"
    },
    comment_placeholder: "Please share your thoughts (optional)",
  },
  [CLARITY_OF_SKILLS_QUESTION_ID]: {
    question_id: CLARITY_OF_SKILLS_QUESTION_ID,
    question_text: "Were the skills clearly explained?",
    description: "Please let us know if the skills were clearly explained",
    type: QuestionType.YesNo,
    comment_placeholder: "Please share your thoughts (optional)",
    show_comments_on: YesNoEnum.Yes,
  },
  [INCORRECT_SKILLS_QUESTION_ID]: {
    question_id: INCORRECT_SKILLS_QUESTION_ID,
    question_text: "Were there any incorrect skills identified?",
    description: "Please let us know if any incorrect skills were identified",
    type: QuestionType.YesNo,
    comment_placeholder: "Please share your thoughts (optional)",
    show_comments_on: YesNoEnum.Yes,
  },
  [MISSING_SKILLS_QUESTION_ID]: {
    question_id: MISSING_SKILLS_QUESTION_ID,
    question_text: "Were there any missing skills?",
    description: "Please let us know if any skills were missing",
    type: QuestionType.YesNo,
    comment_placeholder: "Please share your thoughts (optional)",
    show_comments_on: YesNoEnum.Yes,
  },
  [INTERACTION_EASE_QUESTION_ID]: {
    question_id: INTERACTION_EASE_QUESTION_ID,
    question_text: "How easy was it to interact with the system?",
    description: "Please rate how easy it was to interact with the system",
    type: QuestionType.Rating,
    comment_placeholder: "Please share your thoughts (optional)",
    low_rating_label: "Very difficult",
    high_rating_label: "Very easy",
    max_rating: 5,
    display_rating: true,
  },
  [RECOMMENDATION_QUESTION_ID]: {
    question_id: RECOMMENDATION_QUESTION_ID,
    question_text: "Would you recommend this system?",
    description: "Please rate how likely you are to recommend this system",
    type: QuestionType.Rating,
    comment_placeholder: "Please share your thoughts (optional)",
    low_rating_label: "Not likely",
    high_rating_label: "Very likely",
    max_rating: 5,
    display_rating: true,
  },
  [ADDITIONAL_FEEDBACK_QUESTION_ID]: {
    question_id: ADDITIONAL_FEEDBACK_QUESTION_ID,
    question_text: "Do you have any additional feedback?",
    description: "Please share any additional feedback you have",
    type: QuestionType.Rating,
    comment_placeholder: "Please share your thoughts (optional)",
    low_rating_label: "Not satisfied",
    high_rating_label: "Very satisfied",
    max_rating: 5,
    display_rating: true,
  },
  [CUSTOMER_SATISFACTION_QUESTION_KEY]: {
    question_id: CUSTOMER_SATISFACTION_QUESTION_KEY,
    question_text: "How would you rate your overall experience?",
    description: "Please rate your overall satisfaction with the system",
    type: QuestionType.Rating,
    comment_placeholder: "Please share your thoughts (optional)",
    low_rating_label: "Very dissatisfied",
    high_rating_label: "Very satisfied",
    max_rating: 5,
    display_rating: true,
  },
}; 