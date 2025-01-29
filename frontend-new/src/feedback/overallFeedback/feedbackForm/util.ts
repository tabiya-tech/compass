import React from "react";

// This function is used to focus on the input field and scroll to it
export const focusAndScrollToField = (ref: React.RefObject<HTMLInputElement>) => {
  if (!ref.current) return;

  ref.current.focus();

  // Using setTimeout to delay refocusing to prevent layout shifts
  setTimeout(() => {
    if (!ref.current) return;

    // Scroll to the input field
    const yOffset = ref.current.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top: yOffset, behavior: "smooth" });
  }, 300);
};
