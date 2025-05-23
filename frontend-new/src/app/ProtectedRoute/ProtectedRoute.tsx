import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import authStateService from "src/auth/services/AuthenticationState.service";
import { isAcceptedTCValid, isSensitiveDataValid } from "src/app/ProtectedRoute/util";
import { SensitivePersonalDataRequirement } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { lazyWithPreload } from "src/utils/preloadableComponent/PreloadableComponent";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const user = authStateService.getInstance().getUser();
  const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

  const targetPath = useLocation().pathname;

  // Preload the SensitiveDataForm component if the user has a sensitive data requirement
  // This is a good opportunity to preload the component since we already know by this point whether the user needs to provide sensitive data
  // By the time the user navigates to the sensitive data page, the component will be preloaded
  // if for any reason the component is not preloaded, the user will experience a slight delay when navigating to the sensitive data page
  useEffect(() => {
    const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();
    if (
      userPreferences &&
      userPreferences.sensitive_personal_data_requirement !== SensitivePersonalDataRequirement.NOT_AVAILABLE &&
      !userPreferences.has_sensitive_personal_data
    ) {
      console.debug("Preloading SensitiveDataForm");
      const LazyLoadedSensitiveDataForm = lazyWithPreload(
        () => import("src/sensitiveData/components/sensitiveDataForm/SensitiveDataForm")
      );
      LazyLoadedSensitiveDataForm.preload().then(() => {
        console.debug("SensitiveDataForm preloaded");
      });
    }
    console.debug("Preloading Chat");
    const LazyLoadedChat = lazyWithPreload(() => import("src/chat/Chat"));
    LazyLoadedChat.preload().then(() => {
      console.debug("Chat preloaded");
    });
  }, []);

  if (targetPath === routerPaths.VERIFY_EMAIL) {
    console.debug("redirecting from /verify --> /verify because no one cares");
    return <>{children}</>;
  }

  if (!user || !userPreferences) {
    if (targetPath === routerPaths.LOGIN || targetPath === routerPaths.REGISTER || targetPath === routerPaths.LANDING) {
      console.debug("redirecting from landing/login/register --> landing/login/register because no user");
      return <>{children}</>;
    }
    console.debug("redirecting from ? --> /landing because no user");
    return <Navigate to={routerPaths.LANDING} />;
  }

  //--- by now we know we have a user and some preferences

  if (targetPath === routerPaths.CONSENT) {
    if (isAcceptedTCValid(userPreferences)) {
      console.debug("redirecting from /dpa --> /home because prefs.accepted");
      return <Navigate to={routerPaths.ROOT} />;
    }
    console.debug("redirecting from /dpa --> /dpa because no prefs.accepted");
    return <>{children}</>;
  }

  if (targetPath === routerPaths.SENSITIVE_DATA) {
    if (isSensitiveDataValid(userPreferences)) {
      console.debug("redirecting from /sensitive --> /home because the user is not required to provide sensitive data");
      return <Navigate to={routerPaths.ROOT} />;
    }
  }

  // Redirect from auth-related paths to root when all conditions are met
  if (targetPath === routerPaths.LOGIN || targetPath === routerPaths.REGISTER || targetPath === routerPaths.LANDING) {
    if (isAcceptedTCValid(userPreferences) && isSensitiveDataValid(userPreferences)) {
      console.debug("redirecting from auth path --> /home because all conditions are met");
      return <Navigate to={routerPaths.ROOT} />;
    }
  }

  if (targetPath !== routerPaths.CONSENT) {
    if (!isAcceptedTCValid(userPreferences)) {
      console.debug("redirecting from ? --> /dpa because no prefs.accepted");
      return <Navigate to={routerPaths.CONSENT} />;
    }
  }

  if (targetPath !== routerPaths.SENSITIVE_DATA) {
    if (!isSensitiveDataValid(userPreferences)) {
      console.debug("redirecting to /sensitive-data because user needs to provide sensitive data");
      return <Navigate to={routerPaths.SENSITIVE_DATA} />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
