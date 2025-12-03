// mute chatty console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import React from "react";
import LanguageContextMenu, { DATA_TEST_ID } from "./LanguageContextMenu";

describe("LanguageContextMenu", () => {
  it("should render the LanguageContextMenu with the default props", () => {
    // GIVEN the component is rendered
    render(<LanguageContextMenu />);

    // THEN the LanguageContextMenu should be rendered
    const actualLanguageContextMenu = screen.getByTestId(DATA_TEST_ID.AUTH_LANGUAGE_SELECTOR_BUTTON);
    expect(actualLanguageContextMenu).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(actualLanguageContextMenu).toMatchSnapshot();
  });
});
