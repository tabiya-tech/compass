import React from "react";
import { SLIDE_DURATION } from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/FormContent";

/**
 * This function is used to focus on the input field and scroll to it.
 * It ensures that the focus and scroll actions are performed only once at a time.
 *
 * @param ref - A React ref object pointing to the input element to be focused and scrolled to.
 */
let isFocusingOnElement = false;

export const focusAndScrollToField = (ref: React.RefObject<HTMLInputElement>) => {
  if (isFocusingOnElement) return;

  // Calculate the delay in milliseconds.
  // The delay is half of the slide duration (in seconds), converted to milliseconds.
  const delayInMs = (SLIDE_DURATION * 1000) / 2;

  if (!ref.current) return;
  ref.current.focus();

  // We want to add scroll into view animation only after the sliding animation is done.
  // Using setTimeout to delay refocusing to prevent layout shifts.
  isFocusingOnElement = true;
  setTimeout(() => {

    // Scroll to the input field
    const yOffset = ref.current?.getBoundingClientRect().top;
    window.scrollTo({ top: yOffset, behavior: "smooth" });
    isFocusingOnElement = false;
  }, delayInMs);
};
