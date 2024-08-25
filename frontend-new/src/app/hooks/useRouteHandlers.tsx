import { useCallback, useContext, useState } from "react";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { useNavigate } from "react-router-dom";
import { TabiyaUser } from "src/auth/auth.types";
import { routerPaths } from "src/app/routerPaths";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";

export const useRouteHandlers = () => {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { updateUserPreferences } = useContext(UserPreferencesContext);

  const [isPostLoginLoading, setIsPostLoginLoading] = useState(false);

  /**
   * Handles what happens after the login process
   * @param user
   */
  const handlePostLogin = useCallback(
    async (user: TabiyaUser) => {
      try {
        setIsPostLoginLoading(true);
        const prefs = await userPreferencesService.getUserPreferences(
          user.id
        );
        if(prefs === null){
          throw new Error("User preferences not found");
        }
        updateUserPreferences(prefs);
        if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
          navigate(routerPaths.DPA, { replace: true });
        } else {
          navigate(routerPaths.ROOT, { replace: true });
          enqueueSnackbar("Welcome back!", { variant: "success" });
        }
      } catch (error) {
        let errorMessage;
        if(error instanceof ServiceError) {
          writeServiceErrorToLog(error, console.error);
          errorMessage = getUserFriendlyErrorMessage(error);
        } else {
          errorMessage = (error as Error).message;
          console.error("An error occurred while trying to get your preferences", error)
        }
        enqueueSnackbar(`An error occurred while trying to get your preferences: ${errorMessage}`, { variant: "error" });
      } finally {
        setIsPostLoginLoading(false);
      }
    },
    [navigate, enqueueSnackbar, updateUserPreferences]
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
