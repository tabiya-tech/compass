import { render, screen } from "src/_test_utilities/test-utils";
import InlineEditField from "src/theme/InlineEditField/InlineEditField";

describe("render tests", () => {
  test("should render correctly", () => {

    // WHEN the component is rendered
    render(<InlineEditField placeholder={"foo bar"} data-testid={"foo-testid"} />);

    // THEN it should render a text field with a specific style.
    const textField = screen.getByRole("textbox");
    expect(textField).toBeInTheDocument();
    expect(textField).toMatchSnapshot();
    });
  });