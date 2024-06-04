import { HashRouter, Route, Routes } from "react-router-dom";
import routerConfig from "./routerConfig";
import { AuthProvider } from "src/auth/AuthProvider";

const App = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          {routerConfig.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} errorElement={route.errorElement} />
          ))}
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
