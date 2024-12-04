import React from "react";

// This function is used to focus on the input field and scroll to it
export const focusAndScrollToField = (ref: React.RefObject<HTMLInputElement>) => {
  if (ref.current) {
    ref.current.focus();
    // We are making scrollIntoView optional because in Jest (jsdom),
    // scrollIntoView is not a function since Jest's jsdom does not have a view.
    ref.current.scrollIntoView?.({ behavior: "smooth" });
  }
};
