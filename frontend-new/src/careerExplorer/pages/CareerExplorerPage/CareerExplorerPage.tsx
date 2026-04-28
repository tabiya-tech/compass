import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ReconnectVersionContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import CareerExplorerChat from "src/careerExplorer/components/CareerExplorerChat/CareerExplorerChat";
import CareerExplorerService from "src/careerExplorer/services/CareerExplorerService";
import type { CareerExplorerMessage } from "src/careerExplorer/types";
import { isConnectionError } from "src/error/restAPIError/isConnectionError";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

const uniqueId = "career-explorer-page-001";
export const DATA_TEST_ID = {
  CONTAINER: `career-explorer-container-${uniqueId}`,
  MESSAGE_LIST: `career-explorer-messages-${uniqueId}`,
};

const CareerExplorerPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const reconnectVersion = useContext(ReconnectVersionContext);
  const previousReconnectVersionRef = useRef(reconnectVersion);
  const [messages, setMessages] = useState<CareerExplorerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const loadOrCreateConversation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await CareerExplorerService.getInstance().getOrCreateConversation();
      setMessages(res.messages);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrCreateConversation();
  }, [loadOrCreateConversation]);

  const hasError = Boolean(error);
  const isConnectionFailure = hasError && isConnectionError(error);
  const errorMessage = (() => {
    if (!hasError) return null;
    if (isConnectionFailure) return t("common.errors.api.serverConnectionError");
    return t("common.errors.api.unableToProcessRequest");
  })();

  useEffect(() => {
    const hasReconnected = reconnectVersion > previousReconnectVersionRef.current;
    if (hasReconnected && hasError) {
      void loadOrCreateConversation();
    }
    previousReconnectVersionRef.current = reconnectVersion;
  }, [reconnectVersion, hasError, loadOrCreateConversation]);

  return (
    <Box width="100%" height="100%" display="flex" flexDirection="column" data-testid={DATA_TEST_ID.CONTAINER}>
      {hasError && (
        <Box
          sx={{
            paddingX: theme.spacing(theme.tabiyaSpacing.md),
            pt: 1,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 2,
          }}
        >
          <Typography variant="body1" color="error.main">
            {errorMessage}
          </Typography>
          <PrimaryButton onClick={() => globalThis.location.reload()}>
            {t("error.errorPage.refreshButton")}
          </PrimaryButton>
        </Box>
      )}
      <Box
        sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        data-testid={DATA_TEST_ID.MESSAGE_LIST}
      >
        <CareerExplorerChat
          initialMessages={messages}
          placeholderKey="careerExplorer.placeholder"
          isLoading={loading}
        />
      </Box>
    </Box>
  );
};

export default CareerExplorerPage;
