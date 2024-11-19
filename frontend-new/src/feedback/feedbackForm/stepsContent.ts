import questions from "src/feedback/feedbackForm/questions-en.json";
import { DetailedQuestion, QuestionType, YesNoEnum } from "src/feedback/feedbackForm/feedback.types";

interface Step {
  label: string;
  questions: DetailedQuestion[];
}

const stepsContent: Step[] = [
  {
    label: "Ease of Use & Skill Insight",
    questions: [
      {
        type: QuestionType.Rating,
        questionId: "interaction_ease",
        questionText: questions["interaction_ease"].question_text,
        lowRatingLabel: "Not easy",
        highRatingLabel: "Very easy",
      },
      {
        type: QuestionType.YesNo,
        questionId: "clarity_of_skills",
        questionText: questions["clarity_of_skills"].question_text,
        showCommentsOn: YesNoEnum.No,
      },
      {
        type: QuestionType.Rating,
        questionId: "satisfaction_with_compass",
        questionText: questions["satisfaction_with_compass"].question_text,
        lowRatingLabel: "Not satisfied",
        highRatingLabel: "Very satisfied",
      }
    ],
  },
  {
    label: "Accuracy & Relevance",
    questions: [
      {
        type: QuestionType.Checkbox,
        questionId: "accuracy_relevance",
        questionText: questions["accuracy_relevance"].question_text,
        options: Object.entries(questions["accuracy_relevance"].options).map(([key, value]) => ({ key, value })),
        lowRatingLabel: "Inaccurate",
        highRatingLabel: "Very accurate",
      },
      {
        type: QuestionType.YesNo,
        questionId: "incorrect_skills",
        questionText: questions["incorrect_skills"].question_text,
        showCommentsOn: YesNoEnum.Yes,
      },
      {
        type: QuestionType.YesNo,
        questionId: "missing_skills",
        questionText: questions["missing_skills"].question_text,
        showCommentsOn: YesNoEnum.Yes,
      },
      {
       type: QuestionType.YesNo,
        questionId: "skill_recognition",
        questionText: questions["skill_recognition"].question_text,
        showCommentsOn: YesNoEnum.No,
      },
    ],
  },
  {
    label: "Recommendation & Additional Feedback",
    questions: [
      {
        type: QuestionType.Rating,
        questionId: "recommendation",
        questionText: questions["recommendation"].question_text,
        lowRatingLabel: "Unlikely",
        highRatingLabel: "Very likely",
      },
      {
        type: QuestionType.Rating,
        questionId: "additional_feedback",
        questionText: questions["additional_feedback"].question_text,
        displayRating: false,
      },
    ],
  },
];

export default stepsContent;