import Info from "src/info/Info";
import Home from "src/homePage/Home";
import NotFound from "src/errorPage/NotFound";
import { routerPaths } from "./routerPaths";
import Register from "src/auth/components/Register/Register";

const routerConfig = [
  {
    path: routerPaths.ROOT,
    element: <Home />,
    errorElement: <div>Sorry, something went wrong</div>,
  },
  {
    path: routerPaths.SETTINGS,
    element: <Info />,
    errorElement: <div>Sorry, application settings could be shown</div>,
  },
  {
    path: routerPaths.REGISTER,
    element: <Register />,
    errorElement: <div>Sorry, registration could not be shown</div>,
  },
  {
    path: "*",
    element: <NotFound />,
    errorElement: <div>Sorry, something went wrong</div>,
  },
];

export default routerConfig;