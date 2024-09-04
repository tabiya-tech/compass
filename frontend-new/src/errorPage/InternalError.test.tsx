import { render, screen } from "src/_test_utilities/test-utils";
import InternalError, { DATA_TEST_ID } from "./InternalError";

describe("InternalError", () => {
  test("InternalError page renders correctly", () => {
    // GIVEN an InternalError page
    jest.spyOn(console, "error");
    jest.spyOn(console, "warn");
    render(<InternalError />);

    // THEN expect no console error or warning
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND expect the container to be present in the document
    expect(screen.getByTestId(DATA_TEST_ID.INTERNAL_ERROR_CONTAINER)).toBeInTheDocument();
    // AND to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.INTERNAL_ERROR_CONTAINER)).toMatchSnapshot();
    // AND expect the illustration and message to be present in the document
    expect(screen.getByTestId(DATA_TEST_ID.INTERNAL_ERROR_ILLUSTRATION)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.INTERNAL_ERROR_MESSAGE)).toBeInTheDocument();
  });
});
