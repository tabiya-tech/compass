import { HashRouter, Route, Routes } from "react-router-dom";
import routerConfig from "./routerConfig";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        {routerConfig.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} errorElement={route.errorElement} />
        ))}
      </Routes>
    </HashRouter>
  );
};

export default App;
