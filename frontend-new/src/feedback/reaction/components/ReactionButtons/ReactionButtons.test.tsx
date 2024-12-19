describe("render tests", () => {
  test
    // .each([
    // LIKED
    // DISLIKED
    // ])
    ("should render the reaction buttons correctly", () => {
    // GIVEN a message id and data test id
    // AND a current reaction
    // WHEN the component is rendered
    // THEN expect the container to be in the document
    // AND expect both like and dislike buttons to be rendered
    // AND expect the correct button to be active
    // AND expect the component to match snapshot
  });

  test("should render with correct data-testids", () => {
    // GIVEN a specific data test id
    // WHEN the component is rendered
    // THEN expect all elements to have the correct compound data-testids
    // AND expect the container to use the base data-testid with -reaction-container
    // AND expect the like button to use the base data-testid with -reaction-like
    // AND expect the dislike button to use the base data-testid with -reaction-dislike
  });
});

describe("action tests", () => {
 test("should call the onReactionChange function with the correct reaction when the like button is clicked", () => {
    // GIVEN a message id and onReactionChange function
    // WHEN the like button is clicked
    // THEN expect the onReactionChange function to be called with the correct reaction
 });
});
