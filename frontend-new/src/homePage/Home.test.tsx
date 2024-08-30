// mute the console
import "src/_test_utilities/consoleMock";

import Home, { DATA_TEST_ID } from "./Home";
import { render, screen } from "src/_test_utilities/test-utils";
import { HashRouter } from "react-router-dom";
import { DATA_TEST_ID as CHAT_DATA_TEST_ID } from "src/chat/Chat";

// mock the SocialAuthService
jest.mock("src/auth/services/socialAuth/SocialAuth.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

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
});
