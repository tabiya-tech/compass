import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
// REMOVED: import questions from "src/feedback/overallFeedback/feedbackForm/questions-en.json"; 
// The data will now be loaded dynamically inside the hook.
import {
    DetailedQuestion,
    QuestionType,
    YesNoEnum,
} from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

interface Step {
    label: string;
    questions: DetailedQuestion[];
}

// Define the shape of your imported questions data for better type safety
interface QuestionsData {
    [key: string]: {
        question_text: string;
        comment_placeholder?: string;
        options?: {
            [key: string]: string;
        };
    };
}

/**
 * Custom hook to dynamically load and structure the feedback form steps
 * based on the current i18n locale.
 * @returns An object containing the structured steps and a loading state.
 */
export const useFeedbackFormContentSteps = () => {
    // We use `t` for translating static labels and `i18n` for locale management
    const { t, i18n } = useTranslation();
    const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null);
    const [loading, setLoading] = useState(true);

    // Function to dynamically import the correct file
    const loadQuestions = useCallback(async (locale: string) => {
        setLoading(true);
        try {
            // Construct the file path dynamically. 
            // We use the full path relative to the project root/src for dynamic imports in Vite.
            const module = await import(/* @vite-ignore */ `src/feedback/overallFeedback/feedbackForm/questions-${locale}.json`);

            // JSON files often export as `default`.
            setQuestionsData(module.default || module);
        } catch (error) {
            console.error(`Failed to load questions for locale ${locale}.`, error);

            // Fallback: If the specific locale file fails, try to load a default (e.g., 'en-gb')
            if (locale !== 'en-gb') {
                console.info("Attempting to load fallback 'en-gb' locale.");
                loadQuestions('en-gb'); // Recursive call for fallback
                return;
            }
            // If fallback also fails, set to empty object
            console.error("Fallback 'en-gb' locale also failed to load.");
            setQuestionsData({});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial load based on current language
        loadQuestions(i18n.language);

        // Listen for language changes and reload questions
        i18n.on('languageChanged', loadQuestions);

        // Cleanup listener on component unmount
        return () => {
            i18n.off('languageChanged', loadQuestions);
        };
    }, [i18n, loadQuestions]);

    // Map the steps only if the questionsData is loaded
    const feedbackFormContentSteps: Step[] = questionsData
        ? [
            {
                // Translate the static step label using i18n's 't' function
                label: t("bias_experience_accuracy"), 
                questions: [
                    {
                        type: QuestionType.YesNo,
                        questionId: "perceived_bias",
                        // Use the dynamically loaded data
                        questionText: questionsData["perceived_bias"].question_text,
                        showCommentsOn: YesNoEnum.Yes,
                        placeholder: questionsData["perceived_bias"].comment_placeholder,
                    },
                    {
                        type: QuestionType.Checkbox,
                        questionId: "work_experience_accuracy",
                        questionText: questionsData["work_experience_accuracy"].question_text,
                        // Ensure options is not undefined before mapping
                        options: Object.entries(questionsData["work_experience_accuracy"].options || {}).map(([key, value]) => ({ key, value })),
                        // Translate static labels
                        lowRatingLabel: t("inaccurate"), 
                        highRatingLabel: t("very_accurate"),
                        placeholder: questionsData["work_experience_accuracy"].comment_placeholder,
                    },
                ],
            },
            {
                label: t("skill_accuracy"),
                questions: [
                    {
                        type: QuestionType.YesNo,
                        questionId: "clarity_of_skills",
                        questionText: questionsData["clarity_of_skills"].question_text,
                        showCommentsOn: YesNoEnum.No,
                        placeholder: questionsData["clarity_of_skills"].comment_placeholder,
                    },
                    {
                        type: QuestionType.YesNo,
                        questionId: "incorrect_skills",
                        questionText: questionsData["incorrect_skills"].question_text,
                        showCommentsOn: YesNoEnum.Yes,
                        placeholder: questionsData["incorrect_skills"].comment_placeholder,
                    },
                    {
                        type: QuestionType.YesNo,
                        questionId: "missing_skills",
                        questionText: questionsData["missing_skills"].question_text,
                        showCommentsOn: YesNoEnum.Yes,
                        placeholder: questionsData["missing_skills"].comment_placeholder,
                    },
                ],
            },
            {
                label: t("final_feedback"),
                questions: [
                    {
                        type: QuestionType.Rating,
                        questionId: "interaction_ease",
                        questionText: questionsData["interaction_ease"].question_text,
                        lowRatingLabel: t("difficult"),
                        highRatingLabel: t("easy"),
                        maxRating: 5,
                        placeholder: questionsData["interaction_ease"].comment_placeholder,
                    },
                    {
                        type: QuestionType.Rating,
                        questionId: "recommendation",
                        questionText: questionsData["recommendation"].question_text,
                        lowRatingLabel: t("unlikely"),
                        highRatingLabel: t("likely"),
                        maxRating: 5,
                    },
                    {
                        type: QuestionType.Rating,
                        questionId: "additional_feedback",
                        questionText: questionsData["additional_feedback"].question_text,
                        displayRating: false,
                        placeholder: questionsData["additional_feedback"].comment_placeholder,
                    },
                ],
            },
        ]
        : []; // Return empty array if data is still loading or failed to load

    return { feedbackFormContentSteps, loading };
};

export default useFeedbackFormContentSteps;