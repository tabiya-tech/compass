import { HashRouter, Route, Routes } from "react-router-dom";
import routerConfig from "./routerConfig";
import { useRef, useEffect, useContext } from "react";
import { IsOnlineContext } from "./providers/IsOnlineProvider";
import { DEFAULT_SNACKBAR_AUTO_HIDE_DURATION, useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

const uniqueId = "17ccbdb7-1855-44b2-bc68-ef066e5c4e6f";
export const SNACKBAR_KEYS = {
  OFFLINE_ERROR: `offline-error-${uniqueId}`,
  ONLINE_SUCCESS: `online-success-${uniqueId}`,
};

const App = () => {
  const renderCount = useRef(0);
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  useEffect(() => {
    renderCount.current++;
    // if currently online and initial render, then don't show notification
    console.log(isOnline)
    if (isOnline && renderCount.current === 1) {
      return;
    }

    if (!isOnline) {
      // offline
      closeSnackbar(SNACKBAR_KEYS.ONLINE_SUCCESS);
      enqueueSnackbar(`You are offline`, {
        variant: "warning",
        key: SNACKBAR_KEYS.OFFLINE_ERROR,
        preventDuplicate: true,
        persist: true,
        action: [],
      });
    } else {
      // online
      closeSnackbar(SNACKBAR_KEYS.OFFLINE_ERROR);
      enqueueSnackbar(`You are back online`, {
        variant: "success",
        key: SNACKBAR_KEYS.ONLINE_SUCCESS,
        preventDuplicate: true,
        autoHideDuration: DEFAULT_SNACKBAR_AUTO_HIDE_DURATION,
      });
    }
  }, [isOnline, closeSnackbar, enqueueSnackbar]);

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
