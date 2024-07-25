import { useCallback, useContext, useState } from "react";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { useNavigate } from "react-router-dom";
import { TabiyaUser } from "src/auth/auth.types";
import { routerPaths } from "src/app/routerPaths";
import { writeServiceErrorToLog } from "src/error/logger";

export const useRouteHandlers = () => {
  const { getUserPreferences } = useContext(UserPreferencesContext);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const [isPostLoginLoading, setIsPostLoginLoading] = useState(false);

  /**
   * Handles what happens after the login process
   * @param user
   */
  const handlePostLogin = useCallback(
    (user: TabiyaUser) => {
      setIsPostLoginLoading(true);
      getUserPreferences(
        user.id,
        (prefs) => {
          setIsPostLoginLoading(false);
          if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
            navigate(routerPaths.DPA, { replace: true });
          } else {
            navigate(routerPaths.ROOT, { replace: true });
            enqueueSnackbar("Welcome back!", { variant: "success" });
          }
        },
        (error) => {
          setIsPostLoginLoading(false);
          enqueueSnackbar("An error occurred while trying to get your preferences", { variant: "error" });
          writeServiceErrorToLog(error, console.error);
        }
      );
    },
    [getUserPreferences, navigate, enqueueSnackbar]
  );
  /**
   * Handles what happens after the user registers
   */
  const handlePostRegister = useCallback(() => {
    navigate(routerPaths.VERIFY_EMAIL, { replace: true });
  }, [navigate]);

  /**
   * Handles what happens after the user accepts the DPA
   */
  const handlePostAcceptDPA = useCallback(() => {
    navigate(routerPaths.ROOT, { replace: true });
  }, [navigate]);

  /**
   * Handles what happens after the user verifies their email
   */
  const handlePostVerifyEmail = useCallback(() => {
    navigate(routerPaths.LOGIN, { replace: true });
  }, [navigate]);

  return {
    handleLogin: handlePostLogin,
    handleRegister: handlePostRegister,
    handleAcceptDPA: handlePostAcceptDPA,
    handleVerifyEmail: handlePostVerifyEmail,
    isPostLoginLoading: isPostLoginLoading,
  };
};
