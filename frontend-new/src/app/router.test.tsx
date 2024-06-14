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
import { mockLoggedInUser } from "src/_test_utilities/mockLoggedInUser";
import * as firebaseui from "firebaseui";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";

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

function renderWithRouter(route: string) {
  const router = createMemoryRouter(routerConfig, {
    initialEntries: [route],
  });
  render(<RouterProvider router={router} />);

  return { router };
}

describe("Tests for router config", () => {
  beforeAll(() => mockLoggedInUser({}));
  beforeAll(() => mockUseTokens());
  beforeEach(() => {
    firebaseui.auth.AuthUI.getInstance = jest.fn();
  });
  afterEach(() => jest.clearAllMocks());
  test.each([
    ["Home", routerPaths.ROOT, HOME_DATA_TEST_ID.HOME_CONTAINER],
    ["Info", routerPaths.SETTINGS, INFO_DATA_TEST_ID.INFO_ROOT],
    ["Register", routerPaths.REGISTER, REGISTER_DATA_TEST_ID.REGISTER_CONTAINER],
    ["Login", routerPaths.LOGIN, LOGIN_DATA_TEST_ID.LOGIN_CONTAINER],
    ["DPA", routerPaths.DPA, DPA_DATA_TEST_ID.DPA_CONTAINER],
    ["Verify", routerPaths.VERIFY_EMAIL, VERIFY_EMAIL_DATA_TEST_ID.VERIFY_EMAIL_CONTAINER],
  ])("should render the %s component given the path %s", async (_description, givenRoute, expectedDataTestId) => {
    // WHEN the ROOT is chosen
    renderWithRouter(givenRoute);

    // THEN expect home to be the landing page
    expect(screen.getByTestId(expectedDataTestId)).toBeInTheDocument();
  });

  test("should render the 404 page", async () => {
    // WHEN an invalid route is chosen
    renderWithRouter("/invalid-route");

    // THEN expect the 404 page to be rendered
    expect(screen.getByTestId(ERROR_PAGE_DATA_TEST_ID.NOT_FOUND_CONTAINER)).toBeInTheDocument();
  });
});
