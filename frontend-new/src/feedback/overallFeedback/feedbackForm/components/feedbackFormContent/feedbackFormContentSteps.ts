import { TypedTFunction } from "src/react-i18next";
import {
  DetailedQuestion,
  QuestionType,
  YesNoEnum,
} from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

interface Step {
  label: string;
  questions: DetailedQuestion[];
}

// Helper function to get questions from translation namespace
const getQuestions = (t: TypedTFunction) => {
  // Access the questions namespace which contains the imported JSON structure
  // t() with returnObjects: true will return the entire object instead of a string
  return t("questions", { returnObjects: true }) as Record<string, any>;
};

// Convert to a function that accepts translation function
const getFeedbackFormContentSteps = (t: TypedTFunction): Step[] => {
  const questions = getQuestions(t);

  return [
    {
      label: t("steps.biasAndExperience"),
      questions: [
        {
          type: QuestionType.YesNo,
          questionId: "perceived_bias",
          questionText: questions["perceived_bias"].question_text,
          showCommentsOn: YesNoEnum.Yes,
          placeholder: questions["perceived_bias"].comment_placeholder,
        },
        {
          type: QuestionType.Checkbox,
          questionId: "work_experience_accuracy",
          questionText: questions["work_experience_accuracy"].question_text,
          options: Object.entries(questions["work_experience_accuracy"].options).map(([key, value]) => ({
            key,
            value: value as string,
          })),
          lowRatingLabel: t("labels.inaccurate"),
          highRatingLabel: t("labels.veryAccurate"),
          placeholder: questions["work_experience_accuracy"].comment_placeholder,
        },
      ],
    },
    {
      label: t("steps.skillAccuracy"),
      questions: [
        {
          type: QuestionType.YesNo,
          questionId: "clarity_of_skills",
          questionText: questions["clarity_of_skills"].question_text,
          showCommentsOn: YesNoEnum.No,
          placeholder: questions["clarity_of_skills"].comment_placeholder,
        },
        {
          type: QuestionType.YesNo,
          questionId: "incorrect_skills",
          questionText: questions["incorrect_skills"].question_text,
          showCommentsOn: YesNoEnum.Yes,
          placeholder: questions["incorrect_skills"].comment_placeholder,
        },
        {
          type: QuestionType.YesNo,
          questionId: "missing_skills",
          questionText: questions["missing_skills"].question_text,
          showCommentsOn: YesNoEnum.Yes,
          placeholder: questions["missing_skills"].comment_placeholder,
        },
      ],
    },
    {
      label: t("steps.finalFeedback"),
      questions: [
        {
          type: QuestionType.Rating,
          questionId: "interaction_ease",
          questionText: questions["interaction_ease"].question_text,
          lowRatingLabel: t("labels.difficult"),
          highRatingLabel: t("labels.easy"),
          maxRating: 5,
          placeholder: questions["interaction_ease"].comment_placeholder,
        },
        {
          type: QuestionType.Rating,
          questionId: "recommendation",
          questionText: questions["recommendation"].question_text,
          lowRatingLabel: t("labels.unlikely"),
          highRatingLabel: t("labels.likely"),
          maxRating: 5,
        },
        {
          type: QuestionType.Rating,
          questionId: "additional_feedback",
          questionText: questions["additional_feedback"].question_text,
          displayRating: false,
          placeholder: questions["additional_feedback"].comment_placeholder,
        },
      ],
    },
  ];
};

export default getFeedbackFormContentSteps;
