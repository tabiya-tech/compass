import React, { useMemo } from "react";
import { Box, Container, useTheme } from "@mui/material";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MarkdownReader from "src/knowledgeHub/components/MarkdownReader";
import SectorProfile from "src/knowledgeHub/components/SectorProfile";
import SECTOR_DATA from "src/knowledgeHub/components/SectorProfile/sectorStaticData";
import { getDocumentById } from "src/knowledgeHub/documentLoader";
import ErrorPage from "src/error/errorPage/ErrorPage";

const uniqueId = "d5e6f7a8-90bc-def1-2345-678901234567";

export const DATA_TEST_ID = {
  KNOWLEDGE_HUB_DOCUMENT_CONTAINER: `knowledge-hub-document-container-${uniqueId}`,
  KNOWLEDGE_HUB_DOCUMENT_BACK_BUTTON: `knowledge-hub-document-back-button-${uniqueId}`,
  KNOWLEDGE_HUB_DOCUMENT_CONTENT: `knowledge-hub-document-content-${uniqueId}`,
  KNOWLEDGE_HUB_DOCUMENT_ICON: `knowledge-hub-document-icon-${uniqueId}`,
};

const KnowledgeHubDocument: React.FC = () => {
  const theme = useTheme();
  const { documentId } = useParams<{ documentId: string }>();
  const { t } = useTranslation();

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
      <Box display="flex" height="100%" overflow="hidden" data-testid={DATA_TEST_ID.KNOWLEDGE_HUB_DOCUMENT_CONTAINER}>
        <SectorProfile staticData={sectorStaticData} />
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
        maxWidth="md"
        sx={{
          flex: 1,
          padding: theme.spacing(theme.tabiyaSpacing.lg),
          paddingTop: theme.spacing(theme.tabiyaSpacing.md),
          overflowY: "auto",
        }}
      >
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          <Box
            data-testid={DATA_TEST_ID.KNOWLEDGE_HUB_DOCUMENT_CONTENT}
            sx={{
              backgroundColor: theme.palette.background.paper,
              borderRadius: theme.fixedSpacing(theme.tabiyaRounding.md),
            }}
          >
            <MarkdownReader content={document.content} />
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default KnowledgeHubDocument;
