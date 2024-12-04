import questions from "src/feedback/feedbackForm/questions-en.json";
import { DetailedQuestion, QuestionType, YesNoEnum } from "src/feedback/feedbackForm/feedback.types";

interface Step {
  label: string;
  questions: DetailedQuestion[];
}

const stepsContent: Step[] = [
  {
    label: "Overall Satisfaction",
    questions: [
      {
        type: QuestionType.Rating,
        questionId: "interaction_ease",
        questionText: questions["interaction_ease"].question_text,
        lowRatingLabel: "Difficult",
        highRatingLabel: "Easy",
        maxRating: 7,
        placeholder: questions["interaction_ease"].comment_placeholder,
      },
      {
        type: QuestionType.Rating,
        questionId: "satisfaction_with_compass",
        questionText: questions["satisfaction_with_compass"].question_text,
        lowRatingLabel: "Unsatisfied",
        highRatingLabel: "Satisfied",
        maxRating: 5,
      },
    ],
  },
  {
    label: "Bias & Experience Accuracy",
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
        options: Object.entries(questions["work_experience_accuracy"].options).map(([key, value]) => ({ key, value })),
        lowRatingLabel: "Inaccurate",
        highRatingLabel: "Very accurate",
        placeholder: questions["work_experience_accuracy"].comment_placeholder,
      }
    ],
  },
  {
    label: "Skill Accuracy",
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
    label: "Final feedback",
    questions: [
      {
        type: QuestionType.Rating,
        questionId: "recommendation",
        questionText: questions["recommendation"].question_text,
        lowRatingLabel: "Unlikely",
        highRatingLabel: "Likely",
        maxRating: 11,
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

export default stepsContent;
