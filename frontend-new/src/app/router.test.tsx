import routerConfig from "./routerConfig";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { render, screen } from "src/_test_utilities/test-utils";
import { DATA_TEST_ID as INFO_DATA_TEST_ID } from "src/info/Info";
import { DATA_TEST_ID as ERROR_PAGE_DATA_TEST_ID } from "src/errorPage/NotFound";
import { DATA_TEST_ID as REGISTER_DATA_TEST_ID } from "src/auth/components/Register/Register";
import { DATA_TEST_ID as LOGIN_DATA_TEST_ID } from "src/auth/components/Login/Login";
import { DATA_TEST_ID as VERIFY_EMAIL_DATA_TEST_ID } from "src/auth/components/VerifyEmail/VerifyEmail";
import { DATA_TEST_ID as DPA_DATA_TEST_ID } from "src/auth/components/PolicyNotice/DataProtectionPolicy";
import { DATA_TEST_ID as HOME_DATA_TEST_ID } from "src/homePage/Home";

import { routerPaths } from "./routerPaths";
import { mockLoggedInUser, TestUser } from "src/_test_utilities/mockLoggedInUser";
import * as firebaseui from "firebaseui";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider";

// mock the firebase module
jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: {
      GoogleAuthProvider: { PROVIDER_ID: "foo.bar" },
    },
  };
});

// mock the firebaseConfig module
jest.mock("src/auth/firebaseConfig", () => {
  const auth = jest.fn(() => ({
    signInWithCustomToken: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: { PROVIDER_ID: "foo.bar" },
  }));
  return {
    auth,
  };
});

// mock the firebaseui module
jest.mock("firebaseui", () => {
  return {
    auth: {
      AuthUI: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        getInstance: jest.fn(),
      })),
    },
  };
});

// mock the snackbar provider
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

// mock the UserPreferencesService
jest.mock("src/auth/services/UserPreferences/userPreferences.service", () => {
  return jest.fn().mockImplementation(() => {
    return {
      getUserPreferences: jest.fn(),
    };
  });
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

function renderWithRouter(route: string, user: TabiyaUser | null) {
  const authContextValue = {
    login: jest.fn(),
    isLoggingIn: false,
    isRegistering: false,
    user: user,
    register: jest.fn(),
    logout: jest.fn(),
    handlePageLoad: jest.fn(),
  };

  const router = createMemoryRouter(routerConfig, {
    initialEntries: [route],
  });

  render(
    <AuthContext.Provider value={authContextValue}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
  );

  return { router };
}
// mock the home component
jest.mock("src/homePage/Home", () => {
  const originalModule = jest.requireActual("src/homePage/Home");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.HOME_CONTAINER}></div>),
  };
});

// mock the info component
jest.mock("src/info/Info", () => {
  const originalModule = jest.requireActual("src/info/Info");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.INFO_ROOT}></div>),
  };
});

// mock the register component
jest.mock("src/auth/components/Register/Register", () => {
  const originalModule = jest.requireActual("src/auth/components/Register/Register");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.REGISTER_CONTAINER}></div>),
  };
});

// mock the login component
jest.mock("src/auth/components/Login/Login", () => {
  const originalModule = jest.requireActual("src/auth/components/Login/Login");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.LOGIN_CONTAINER}></div>),
  };
});

// mock the verify email component
jest.mock("src/auth/components/VerifyEmail/VerifyEmail", () => {
  const originalModule = jest.requireActual("src/auth/components/VerifyEmail/VerifyEmail");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.VERIFY_EMAIL_CONTAINER}></div>),
  };
});

// mock the DPA component
jest.mock("src/auth/components/PolicyNotice/DataProtectionPolicy", () => {
  const originalModule = jest.requireActual("src/auth/components/PolicyNotice/DataProtectionPolicy");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.DPA_CONTAINER}></div>),
  };
});

// mock the error page component
jest.mock("src/errorPage/NotFound", () => {
  const originalModule = jest.requireActual("src/errorPage/NotFound");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.NOT_FOUND_CONTAINER}></div>),
  };
});

describe("Tests for router config", () => {
  beforeAll(() => mockLoggedInUser({}));
  beforeAll(() => mockUseTokens());
  beforeEach(() => {
    firebaseui.auth.AuthUI.getInstance = jest.fn();
  });
  afterEach(() => jest.clearAllMocks());

  test.each([
    ["Home", routerPaths.ROOT, HOME_DATA_TEST_ID.HOME_CONTAINER, TestUser],
    ["Info", routerPaths.SETTINGS, INFO_DATA_TEST_ID.INFO_ROOT, null],
    ["Register", routerPaths.REGISTER, REGISTER_DATA_TEST_ID.REGISTER_CONTAINER, null],
    ["Login", routerPaths.LOGIN, LOGIN_DATA_TEST_ID.LOGIN_CONTAINER, null],
    ["DPA", routerPaths.DPA, DPA_DATA_TEST_ID.DPA_CONTAINER, TestUser],
    ["Verify", routerPaths.VERIFY_EMAIL, VERIFY_EMAIL_DATA_TEST_ID.VERIFY_EMAIL_CONTAINER, null],
  ])("should render the %s component given the path %s", async (_description, givenRoute, expectedDataTestId, user) => {
    // WHEN the ROOT is chosen
    renderWithRouter(givenRoute, user);

    // THEN expect home to be the landing page
    expect(screen.getByTestId(expectedDataTestId)).toBeInTheDocument();
  });

  test("should render the 404 page", async () => {
    // WHEN an invalid route is chosen
    renderWithRouter("/invalid-route", null);

    // THEN expect the 404 page to be rendered
    expect(screen.getByTestId(ERROR_PAGE_DATA_TEST_ID.NOT_FOUND_CONTAINER)).toBeInTheDocument();
  });
});
