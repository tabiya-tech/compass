import React, { startTransition, useContext, useMemo } from "react";
import { Box, Container, useTheme } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MarkdownReader from "src/knowledgeHub/components/MarkdownReader";
import SectorProfile from "src/knowledgeHub/components/SectorProfile";
import SECTOR_DATA from "src/knowledgeHub/components/SectorProfile/sectorStaticData";
import { getDocumentById } from "src/knowledgeHub/documentLoader";
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

  const document = useMemo(() => {
    if (!documentId) return null;
    return getDocumentById(documentId);
  }, [documentId]);

  if (!document) {
    return <ErrorPage errorMessage={t("knowledgeHub.documentNotFound")} />;
  }

  const sectorStaticData = documentId ? SECTOR_DATA[documentId] : undefined;

  if (sectorStaticData) {
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
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="100%"
      data-testid={DATA_TEST_ID.KNOWLEDGE_HUB_DOCUMENT_CONTAINER}
    >
      <Container
        maxWidth={false}
        disableGutters
        sx={{
          flex: 1,
          maxWidth: "var(--layout-content-max-width)",
          mx: "auto",
          px: "var(--layout-gutter-x)",
          pt: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          overflowY: "auto",
        }}
      >
        <Box
          data-testid={DATA_TEST_ID.KNOWLEDGE_HUB_DOCUMENT_CONTENT}
          sx={{
            backgroundColor: theme.palette.background.paper,
            borderRadius: theme.fixedSpacing(theme.tabiyaRounding.md),
          }}
        >
          <MarkdownReader content={document.content} />
        </Box>
      </Container>
    </Box>
  );
};

export default KnowledgeHubDocument;
