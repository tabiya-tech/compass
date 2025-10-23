import React, { createContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_SNACKBAR_AUTO_HIDE_DURATION, useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { SNACKBAR_KEYS } from "src/app";

type IsOnlineProviderProps = {
  children: React.ReactNode;
};

export const IsOnlineContext = createContext<boolean>(navigator.onLine);

export const IsOnlineProvider: React.FC<IsOnlineProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const renderCount = useRef(0);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { t } = useTranslation();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Perform the one-time comparison to ensure the initial value is correct
    if (isOnline !== navigator.onLine) {
      setIsOnline(navigator.onLine);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOnline]);

  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    renderCount.current++;
    if (isOnline && renderCount.current === 1) {
      return;
    }

    if (!isOnline) {
      setWasOffline(true);
      closeSnackbar(SNACKBAR_KEYS.ONLINE_SUCCESS);
      enqueueSnackbar(t("app_isOnline_offline"), {
        variant: "offline",
        key: SNACKBAR_KEYS.OFFLINE_ERROR,
        preventDuplicate: true,
        anchorOrigin: {
          vertical: "top",
          horizontal: "center",
        },
        persist: true,
        action: [],
        style: { minWidth: "0", width: "fit-content", margin: "0 auto" },
      });
    } else {
      if (wasOffline) {
        enqueueSnackbar(t("app_isOnline_back_online"), {
          variant: "success",
          key: SNACKBAR_KEYS.ONLINE_SUCCESS,
          preventDuplicate: true,
          autoHideDuration: DEFAULT_SNACKBAR_AUTO_HIDE_DURATION,
        });
      }
      setWasOffline(false);
      closeSnackbar(SNACKBAR_KEYS.OFFLINE_ERROR);
    }
  }, [isOnline, closeSnackbar, enqueueSnackbar, wasOffline, t]);

  return <IsOnlineContext.Provider value={isOnline}>{children}</IsOnlineContext.Provider>;
};
