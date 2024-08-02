// mute the console
import "src/_test_utilities/consoleMock";

import CustomTextField, { DATA_TEST_ID } from "src/theme/CustomTextField/CustomTextField";
import { render, screen } from "src/_test_utilities/test-utils";

describe("Custom text field", () => {
  test("should render CustomTextField correctly", () => {
    // GIVEN the CustomTextField component
    const givenCustomTextField = (
      <CustomTextField label="label" placeholder="Enter text here" value="Some text" onChange={jest.fn()} />
    );

    // WHEN the component is rendered
    render(givenCustomTextField);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the custom text field container to be in the document
    const customTextFieldContainer = screen.getByTestId(DATA_TEST_ID.CUSTOM_TEXT_FIELD_CONTAINER);
    expect(customTextFieldContainer).toBeInTheDocument();
    // AND the custom text field label to be in the document
    const customTextFieldLabel = screen.getByTestId(DATA_TEST_ID.CUSTOM_TEXT_FIELD_LABEL);
    expect(customTextFieldLabel).toBeInTheDocument();
    // AND the custom text field input to be in the document
    const customTextFieldInput = screen.getByTestId(DATA_TEST_ID.CUSTOM_TEXT_FIELD_INPUT);
    expect(customTextFieldInput).toBeInTheDocument();
    // AND to match the snapshot
    expect(customTextFieldContainer).toMatchSnapshot();
  });
});
