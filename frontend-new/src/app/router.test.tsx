import routerConfig from "./routerConfig";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { render, screen } from "src/_test_utilities/test-utils";
import { DATA_TEST_ID as INFO_DATA_TEST_ID } from "src/info/Info";
import { routerPaths } from "./routerPaths";

function renderWithRouter(route: string) {
  const router = createMemoryRouter(routerConfig, {
    initialEntries: [route],
  });
  render(<RouterProvider router={router} />);

  return { router };
}

describe("Tests for router config", () => {
  test("should render the full application given root", async () => {
    // WHEN the ROOT is chosen
    renderWithRouter(routerPaths.ROOT);

    // THEN expect home to be the landing page
    expect(screen.getByText(/Welcome to Tabiya Compass/i)).toBeInTheDocument();
  });

  test("should render the settings", async () => {
    // WHEN the SETTINGS page is chosen
    renderWithRouter(routerPaths.SETTINGS);

    // THEN expect the Info page to be rendered
    expect(screen.getByTestId(INFO_DATA_TEST_ID.INFO_ROOT)).toBeInTheDocument();
  });
});
