import React from "react";
import { useTranslation } from "react-i18next";
import { getProductName } from "src/envService";
import ErrorPage from "src/error/errorPage/ErrorPage";
import { isChunkLoadError } from "src/error/isChunkLoadError";
import { isConnectionError } from "src/error/restAPIError/isConnectionError";
import { buildSupportReference } from "src/error/supportReference/supportReference";

interface AppErrorFallbackProps {
  error?: unknown;
}

export const AppErrorFallback: React.FC<AppErrorFallbackProps> = ({ error }) => {
  const { t } = useTranslation();
  const appName = getProductName();
  const isConnectionFailure = isConnectionError(error);
  const errorMessage = isConnectionFailure
    ? t("common.errors.api.serverConnectionError")
    : t("error.errorPage.defaultMessage", { appName });
  const where = (() => {
    if (isChunkLoadError(error)) return "Application (chunk load)";
    if (isConnectionFailure) return "Application (connection)";
    return "Application";
  })();

  const { copyPayload } = buildSupportReference({
    error,
    where,
    displayMessage: errorMessage,
  });

  return (
    <ErrorPage
      errorMessage={errorMessage}
      showRefreshButton={isChunkLoadError(error) || isConnectionFailure}
      supportPayload={copyPayload}
    />
  );
};
