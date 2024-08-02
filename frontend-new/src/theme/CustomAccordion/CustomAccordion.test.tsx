// mute the console
import "src/_test_utilities/consoleMock";

import CustomAccordion, { DATA_TEST_ID } from "src/theme/CustomAccordion/CustomAccordion";
import { render, screen } from "src/_test_utilities/test-utils";

// mock the help tip component
jest.mock("src/theme/HelpTip/HelpTip", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((props) => <div data-testid={props["data-testid"]} />),
  };
});

describe("CustomAccordion", () => {
  test("should render CustomAccordion correctly", () => {
    // GIVEN the CustomAccordion component
    const givenCustomAccordion = (
      <CustomAccordion title="foo" tooltipText="some info">
        <div>Some content</div>
      </CustomAccordion>
    );
    // WHEN the component is rendered
    render(givenCustomAccordion);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the custom accordion container to be in the document
    const customAccordionContainer = screen.getByTestId(DATA_TEST_ID.CUSTOM_ACCORDION_CONTAINER);
    expect(customAccordionContainer).toBeInTheDocument();
    // AND the custom accordion summary to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CUSTOM_ACCORDION_SUMMARY)).toBeInTheDocument();
    // AND the custom accordion details to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CUSTOM_ACCORDION_DETAILS)).toBeInTheDocument();
    // AND the custom accordion help tip to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CUSTOM_ACCORDION_HELP_TIP)).toBeInTheDocument();
    // AND to match the snapshot
    expect(customAccordionContainer).toMatchSnapshot();
  });
});
