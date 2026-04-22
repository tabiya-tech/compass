import React from "react";
import { useTranslation } from "react-i18next";
import ErrorPage from "src/error/errorPage/ErrorPage";
import { isChunkLoadError } from "src/error/isChunkLoadError";
import { buildSupportReference } from "src/error/supportReference/supportReference";

interface AppErrorFallbackProps {
  error?: unknown;
}

export const AppErrorFallback: React.FC<AppErrorFallbackProps> = ({ error }) => {
  const { t } = useTranslation();
  const { copyPayload } = buildSupportReference({
    error,
    where: isChunkLoadError(error) ? "Application (chunk load)" : "Application",
    displayMessage: t("error.errorPage.defaultMessage"),
  });
  return (
    <ErrorPage
      errorMessage={t("error.errorPage.defaultMessage")}
      showRefreshButton={isChunkLoadError(error)}
      supportPayload={copyPayload}
    />
  );
};
