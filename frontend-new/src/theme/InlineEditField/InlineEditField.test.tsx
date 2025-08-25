import { render, screen } from "src/_test_utilities/test-utils";
import InlineEditField, { DATA_TEST_ID } from "src/theme/InlineEditField/InlineEditField";

describe("render tests", () => {
  test("should render correctly", () => {
    // WHEN the component is rendered
    render(<InlineEditField placeholder={"foo bar"} data-testid={"foo-testid"} />);

    // THEN it should render a text field with a specific style.
    const textField = screen.getByRole("textbox");
    expect(textField).toBeInTheDocument();
    expect(textField).toMatchSnapshot();
  });

  test("should show badge when field is edited", () => {
    // GIVEN the field is edited
    const givenIsEdited = true;

    // WHEN the component is rendered
    render(<InlineEditField data-testid={"foo-testid"} placeholder={"foo"} showEditBadge={givenIsEdited} />);

    // THEN expect the badge to be present
    const badge = screen.getByTestId(DATA_TEST_ID.INLINE_EDIT_FIELD_BADGE);
    expect(badge).toBeInTheDocument();
    expect(badge).toMatchSnapshot();
  });
});
