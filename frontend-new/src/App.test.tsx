import { render, screen } from "./_test_utilities/test-utils";

import App from "./App";

test("should render correctly", () => {
  // When the App component is rendered
  render(<App />);

  // THEN expect the hello world text to be in the DOM
  const helloWorldElement = screen.getByText(/Welcome to Tabiya Compass/i);
  expect(helloWorldElement).toBeInTheDocument();
});
