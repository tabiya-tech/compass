// silence chatty console
import "src/_test_utilities/consoleMock";
import { render, screen } from "src/_test_utilities/test-utils";
import AuthHeader, { DATA_TEST_ID } from "./AuthHeader";

describe("AuthHeader tests", () => {
  test("should render the AuthHeader", () => {
    // GIVEN that the component is rendered
    const givenTitle = "Test title";
    const givenSubtitle = <span>Test subtitle</span>;
    render(<AuthHeader title={givenTitle} subtitle={givenSubtitle} />);
    // THEN expect the component to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.AUTH_HEADER_CONTAINER)).toBeInTheDocument();
    // AND expect the logo to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.AUTH_HEADER_LOGO)).toBeInTheDocument();
    // AND expect the title to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.AUTH_HEADER_TITLE)).toBeInTheDocument();
    // AND expect the title to have the correct text
    expect(screen.getByTestId(DATA_TEST_ID.AUTH_HEADER_TITLE)).toHaveTextContent(givenTitle);
    // AND expect the subtitle to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.AUTH_HEADER_SUBTITLE)).toBeInTheDocument();
    // AND expect the subtitle to have the correct text
    expect(screen.getByTestId(DATA_TEST_ID.AUTH_HEADER_SUBTITLE)).toHaveTextContent(givenSubtitle.props.children);
    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.AUTH_HEADER_CONTAINER)).toMatchSnapshot();
  });

  test("should not render subtitle if not passed", () => {
    // GIVEN that the component is rendered without a subtitle
    const givenTitle = "Only title";
    render(<AuthHeader title={givenTitle} />);

    // THEN expect the subtitle to not be in the document
    expect(screen.queryByTestId(DATA_TEST_ID.AUTH_HEADER_SUBTITLE)).toBeNull();

    // AND only title to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.AUTH_HEADER_TITLE)).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.AUTH_HEADER_CONTAINER)).toMatchSnapshot();
  })
});
