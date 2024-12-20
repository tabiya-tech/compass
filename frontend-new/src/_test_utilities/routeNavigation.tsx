import React from "react";
import { render } from "@testing-library/react";
import { AllTheProviders, screen } from "src/_test_utilities/test-utils";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";

export function testNavigateToPath(
  givenComponentWithLink: React.ReactElement,
  givenElementName: string,
  givenElementToClickTestId: string,
  expectedPath: string
): void {
  return test(`clicking the '${givenElementName}' should navigate to '${expectedPath}'`, async () => {
    // GIVEN the givenComponentWithLink has access to a router
    // AND there is some initial route defined with some associated component
    // AND there component associated with the expectedPath
    const givenRouter = (
      <AllTheProviders>
        <MemoryRouter initialEntries={["/foo-initial-path"]}>
          <>{givenComponentWithLink}</>
          <Routes>
            <Route path="/foo-initial-path" element={<div data-testid="/foo-initial-path"></div>} />
            <Route path={expectedPath} element={<div data-testid={expectedPath}></div>} />
          </Routes>
        </MemoryRouter>
      </AllTheProviders>
    );
    // AND the givenRouter is rendered
    // passing false for the third argument to avoid wrapping the component in a HashRouter
    // since we cant have two routers in the hierarchy
    // see src/_test_utilities/test-utils.tsx for more details
    render(givenRouter, {});
    // AND the initial component is shown;
    expect(screen.getByTestId("/foo-initial-path")).toBeInTheDocument();

    // WHEN the element with the givenElementToClickTestId test idis clicked.
    const actualLink = screen.getByTestId(givenElementToClickTestId);
    await userEvent.click(actualLink);

    // THEN to component associated with the expectedPath is shown
    const actualComponent = screen.getByTestId(expectedPath);
    expect(actualComponent).toBeInTheDocument();
  });
}
