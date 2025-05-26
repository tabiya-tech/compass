import questions from "src/feedback/overallFeedback/feedbackForm/questions-en.json";
import {
  DetailedQuestion,
  QuestionType,
  YesNoEnum,
} from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

interface Step {
  label: string;
  questions: DetailedQuestion[];
}

const feedbackFormContentSteps: Step[] = [
  {
    label: "Bias & Experience Accuracy",
    questions: [
      {
        type: QuestionType.YesNo,
        questionId: "perceived_bias",
        questionText: questions["perceived_bias"].question_text,
        showCommentsOn: questions["perceived_bias"].show_comments_on === "yes" ? YesNoEnum.Yes : YesNoEnum.No,
        placeholder: questions["perceived_bias"].comment_placeholder,
      },
      {
        type: QuestionType.Checkbox,
        questionId: "work_experience_accuracy",
        questionText: questions["work_experience_accuracy"].question_text,
        options: Object.entries(questions["work_experience_accuracy"].options).map(([key, value]) => ({ key, value })),
        lowRatingLabel: questions["work_experience_accuracy"].low_rating_label,
        highRatingLabel: questions["work_experience_accuracy"].high_rating_label,
        placeholder: questions["work_experience_accuracy"].comment_placeholder,
      },
    ],
  },
  {
    label: "Skill Accuracy",
    questions: [
      {
        type: QuestionType.YesNo,
        questionId: "clarity_of_skills",
        questionText: questions["clarity_of_skills"].question_text,
        showCommentsOn: questions["clarity_of_skills"].show_comments_on === "yes" ? YesNoEnum.Yes : YesNoEnum.No,
        placeholder: questions["clarity_of_skills"].comment_placeholder,
      },
      {
        type: QuestionType.YesNo,
        questionId: "incorrect_skills",
        questionText: questions["incorrect_skills"].question_text,
        showCommentsOn: questions["incorrect_skills"].show_comments_on === "yes" ? YesNoEnum.Yes : YesNoEnum.No,
        placeholder: questions["incorrect_skills"].comment_placeholder,
      },
      {
        type: QuestionType.YesNo,
        questionId: "missing_skills",
        questionText: questions["missing_skills"].question_text,
        showCommentsOn: questions["missing_skills"].show_comments_on === "yes" ? YesNoEnum.Yes : YesNoEnum.No,
        placeholder: questions["missing_skills"].comment_placeholder,
      },
    ],
  },
  {
    label: "Final feedback",
    questions: [
      {
        type: QuestionType.Rating,
        questionId: "interaction_ease",
        questionText: questions["interaction_ease"].question_text,
        lowRatingLabel: questions["interaction_ease"].low_rating_label,
        highRatingLabel: questions["interaction_ease"].high_rating_label,
        maxRating: questions["interaction_ease"].max_rating,
        placeholder: questions["interaction_ease"].comment_placeholder,
      },
      {
        type: QuestionType.Rating,
        questionId: "recommendation",
        questionText: questions["recommendation"].question_text,
        lowRatingLabel: questions["recommendation"].low_rating_label,
        highRatingLabel: questions["recommendation"].high_rating_label,
        maxRating: questions["recommendation"].max_rating,
      },
      {
        type: QuestionType.Rating,
        questionId: "additional_feedback",
        questionText: questions["additional_feedback"].question_text,
        displayRating: questions["additional_feedback"].display_rating,
        placeholder: questions["additional_feedback"].comment_placeholder,
      },
    ],
  },
];

export default feedbackFormContentSteps;
