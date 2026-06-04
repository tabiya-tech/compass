import React, { startTransition, useContext } from "react";
import { Box, Container, useTheme } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectorProfile from "src/knowledgeHub/components/SectorProfile";
import SECTOR_DATA from "src/knowledgeHub/components/SectorProfile/sectorStaticData";
import ErrorPage from "src/error/errorPage/ErrorPage";
import BackLink from "src/navigation/BackLink/BackLink";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { routerPaths } from "src/app/routerPaths";

const uniqueId = "d5e6f7a8-90bc-def1-2345-678901234567";

export const DATA_TEST_ID = {
  KNOWLEDGE_HUB_DOCUMENT_CONTAINER: `knowledge-hub-document-container-${uniqueId}`,
  KNOWLEDGE_HUB_DOCUMENT_BACK_BUTTON: `knowledge-hub-document-back-button-${uniqueId}`,
  KNOWLEDGE_HUB_DOCUMENT_CONTENT: `knowledge-hub-document-content-${uniqueId}`,
  KNOWLEDGE_HUB_DOCUMENT_ICON: `knowledge-hub-document-icon-${uniqueId}`,
};

const KnowledgeHubDocument: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const { t } = useTranslation();
  const isOnline = useContext(IsOnlineContext);

  const sectorStaticData = documentId ? SECTOR_DATA[documentId] : undefined;

  if (!sectorStaticData) {
    return <ErrorPage errorMessage={t("knowledgeHub.documentNotFound")} />;
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="100%"
      width="100%"
      data-testid={DATA_TEST_ID.KNOWLEDGE_HUB_DOCUMENT_CONTAINER}
    >
      <SectorProfile
        staticData={sectorStaticData}
        topContent={
          <Container maxWidth={false} disableGutters sx={{ pb: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
            <BackLink
              label={t("knowledgeHub.backToKnowledgeHub")}
              isOnline={isOnline}
              onClick={() => {
                startTransition(() => {
                  navigate(routerPaths.KNOWLEDGE_HUB);
                });
              }}
              dataTestId={DATA_TEST_ID.KNOWLEDGE_HUB_DOCUMENT_BACK_BUTTON}
              color={theme.palette.brandAction.main}
              sx={{ opacity: isOnline ? 1 : 0.5 }}
            />
          </Container>
        }
      />
    </Box>
  );
};

export default KnowledgeHubDocument;
