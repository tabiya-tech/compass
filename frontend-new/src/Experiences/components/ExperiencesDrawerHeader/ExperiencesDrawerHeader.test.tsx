// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import ExperiencesDrawerHeader, {
  DATA_TEST_ID,
} from "src/Experiences/components/ExperiencesDrawerHeader/ExperiencesDrawerHeader";

describe("ExperiencesDrawerHeader", () => {
  test("should render ExperiencesDrawerHeader correctly", () => {
    // GIVEN the ExperiencesDrawerHeader component
    const givenExperiencesDrawerHeader = <ExperiencesDrawerHeader notifyOnClose={jest.fn()} />;

    // WHEN the component is rendered
    render(givenExperiencesDrawerHeader);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the experiences drawer header container to be in the document
    const experiencesDrawerHeaderContainer = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_CONTAINER);
    expect(experiencesDrawerHeaderContainer).toBeInTheDocument();
    // AND the experiences drawer header text to be in the document
    expect(screen.getByText("Experiences and skills")).toBeInTheDocument();
    // AND the experiences drawer header button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_BUTTON)).toBeInTheDocument();
    // AND the experiences drawer header icon to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_ICON)).toBeInTheDocument();
    // AND to match the snapshot
    expect(experiencesDrawerHeaderContainer).toMatchSnapshot();
  });

  test("should call notifyOnClose when the close button is clicked", () => {
    // GIVEN the notifyOnClose
    const givenNotifyOnClose = jest.fn();
    // AND the ExperiencesDrawerHeader component is rendered
    render(<ExperiencesDrawerHeader notifyOnClose={givenNotifyOnClose} />);

    // WHEN the close button is clicked
    const closeButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_BUTTON);
    fireEvent.click(closeButton);

    // THEN expect notifyOnClose to have been called
    expect(givenNotifyOnClose).toHaveBeenCalled();
  });
});
