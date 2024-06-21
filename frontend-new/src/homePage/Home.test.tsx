// mute the console
import "src/_test_utilities/consoleMock";

import Home, { DATA_TEST_ID } from "./Home";
import { render, screen } from "src/_test_utilities/test-utils";
import { HashRouter, useNavigate } from "react-router-dom";
import { mockLoggedInUser } from "src/_test_utilities/mockLoggedInUser";
import { routerPaths } from "src/app/routerPaths";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";
import { DATA_TEST_ID as CHAT_DATA_TEST_ID } from "src/chat/Chat";

// mock the router
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    __esModule: true,
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
    NavLink: jest.fn().mockImplementation(() => {
      return <></>;
    }),
  };
});

// mock the Chat component
jest.mock("src/chat/Chat", () => {
  const originalModule = jest.requireActual("src/chat/Chat");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_CONTAINER}></div>),
  };
});

describe("Home", () => {
  beforeAll(() => mockLoggedInUser({}));
  beforeAll(() => mockUseTokens());
  test("should render the home page", () => {
    // WHEN the home page is rendered
    render(
      <HashRouter>
        <Home />
      </HashRouter>
    );

    // THEN expect the home page to be rendered
    expect(screen.getByTestId(DATA_TEST_ID.HOME_CONTAINER)).toBeDefined();
    // AND the Chat component to be rendered
    expect(screen.getByTestId(CHAT_DATA_TEST_ID.CHAT_CONTAINER)).toBeDefined();
    // AND the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.HOME_CONTAINER)).toMatchSnapshot();
  });
  test("should redirect to login page if user is not authenticated", () => {
    // GIVEN the user is not authenticated
    mockLoggedInUser({ user: null });
    // WHEN the home page is rendered
    render(
      <HashRouter>
        <Home />
      </HashRouter>
    );

    // THEN expect the login page to be rendered
    expect(useNavigate()).toHaveBeenCalledWith(routerPaths.LOGIN, { replace: true });
  });
});
