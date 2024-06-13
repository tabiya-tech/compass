// mute the console
import "src/_test_utilities/consoleMock";

import Home from "./Home";
import { render, screen } from "src/_test_utilities/test-utils";
import { HashRouter } from "react-router-dom";

test("should render the home page", () => {
  // WHEN the home page is rendered
  render(
    <HashRouter>
      <Home />
    </HashRouter>
  );

  // THEN expect the home page to be rendered
  expect(screen.getByText(/Welcome to Tabiya Compass/i)).toBeInTheDocument();
});
