import Info from "src/info/Info";
import Home from "src/homePage/Home";
import NotFound from "src/errorPage/NotFound";
import { routerPaths } from "./routerPaths";
import Register from "src/auth/components/Register/Register";
import Login from "src/auth/components/Login/Login";
import DataProtectionAgreement from "src/auth/components/PolicyNotice/DataProtectionPolicy";
import VerifyEmail from "src/auth/components/VerifyEmail/VerifyEmail";
import ProtectedRoute from "src/auth/components/ProtectedRoute/ProtectedRoute";

const routerConfig = [
  {
    path: routerPaths.ROOT,
    element: (
      <ProtectedRoute authenticationRequired={true}>
        <Home />
      </ProtectedRoute>
    ),
    errorElement: <div>Sorry, something went wrong</div>,
  },
  {
    path: routerPaths.SETTINGS,
    element: <Info />,
    errorElement: <div>Sorry, application settings could be shown</div>,
  },
  {
    path: routerPaths.REGISTER,
    element: (
      <ProtectedRoute authenticationRequired={false}>
        <Register />
      </ProtectedRoute>
    ),
    errorElement: <div>Sorry, registration could not be shown</div>,
  },
  {
    path: routerPaths.LOGIN,
    element: (
      <ProtectedRoute authenticationRequired={false}>
        <Login />
      </ProtectedRoute>
    ),
    errorElement: <div>Sorry, login could not be shown</div>,
  },
  {
    path: routerPaths.DPA,
    element: (
      <ProtectedRoute authenticationRequired={true}>
        <DataProtectionAgreement />
      </ProtectedRoute>
    ),
    errorElement: <div>Sorry, data protection policy could not be shown</div>,
  },
  {
    path: routerPaths.VERIFY_EMAIL,
    element: <VerifyEmail />,
    errorElement: <div>Sorry, email verification could not be shown</div>,
  },
  {
    path: "*",
    element: <NotFound />,
    errorElement: <div>Sorry, something went wrong</div>,
  },
];

export default routerConfig;
