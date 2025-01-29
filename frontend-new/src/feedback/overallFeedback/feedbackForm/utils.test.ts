import { SLIDE_DURATION } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";
import { focusAndScrollToField } from "src/feedback/overallFeedback/feedbackForm/util";

describe("focusAndScrollToField", () => {

  beforeEach(() => {
    jest.useFakeTimers();
    window.scrollTo = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

 test("should focus and scroll to the input field after the specified delay", () => {
   // GIVEN a ref pointing to an input element
   const ref = {
     current: {
       focus: jest.fn(),
       getBoundingClientRect: jest.fn().mockReturnValue({ top: 100 })
     } as unknown as HTMLInputElement
   };

   // WHEN the function is called
   focusAndScrollToField(ref);

   // THEN expect the input field to be focused
   jest.advanceTimersByTime((SLIDE_DURATION * 1000) / 2);
   expect(ref.current.focus).toHaveBeenCalled();
   // AND expect the window to scroll to the input field
   expect(window.scrollTo).toHaveBeenCalledWith({ top: 100, behavior: "smooth" });
 });

 test("should not focus and scroll to the input field if the ref is not available", () => {
   // GIVEN there is no element to focus on
    const ref = {
      current: null
    };

   // WHEN the function is called
    focusAndScrollToField(ref);

    // THEN expect the input field to be focused
   expect(ref.current).toBeNull();
   // AND expect the window not to scroll
   expect(window.scrollTo).not.toHaveBeenCalled();
 });
});