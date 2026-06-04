import React from "react";
import { Box, Card, CardActionArea, Typography, useTheme } from "@mui/material";
import { getDocumentIcon } from "src/knowledgeHub/iconRegistry";

interface DocumentMetadata {
  id: string;
  title: string;
  description: string;
  sector?: string;
  icon?: string;
}

const uniqueId = "c5e8f7a2-9b3d-4e6f-8a1c-2d5e7f9b3c4a";

export const DATA_TEST_ID = {
  DOCUMENT_CARD: `document-card-${uniqueId}`,
  DOCUMENT_CARD_TITLE: `document-card-title-${uniqueId}`,
  DOCUMENT_CARD_DESCRIPTION: `document-card-description-${uniqueId}`,
  DOCUMENT_CARD_ICON: `document-card-icon-${uniqueId}`,
};

export interface DocumentCardProps {
  document: DocumentMetadata;
  onClick: (id: string) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({ document, onClick }) => {
  const theme = useTheme();

  const handleClick = () => {
    onClick(document.id);
  };

  return (
    <Card
      sx={{
        borderRadius: theme.rounding(theme.tabiyaRounding.sm),
        border: `1px solid ${theme.palette.common.black}`,
        boxShadow: "none",
        height: "100%",
        position: "relative",
        "&:hover": {
          borderColor: theme.palette.primary.main,
          backgroundColor: `color-mix(in srgb, ${theme.palette.primary.light} 16%, transparent)`,
        },
      }}
      data-testid={DATA_TEST_ID.DOCUMENT_CARD}
    >
      <CardActionArea
        onClick={handleClick}
        disableRipple
        sx={{
          padding: theme.spacing(theme.tabiyaSpacing.lg),
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: theme.tabiyaSpacing.sm,
            width: "100%",
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              color: theme.palette.text.primary,
              padding: theme.spacing(theme.tabiyaSpacing.sm),
              borderRadius: theme.tabiyaRounding.sm,
              backgroundColor: "transparent",
            }}
            data-testid={DATA_TEST_ID.DOCUMENT_CARD_ICON}
          >
            {getDocumentIcon(document.icon || document.sector)}
          </Box>

          {/* Title */}
          <Typography
            variant="body1"
            color="text.primary"
            fontWeight="bold"
            data-testid={DATA_TEST_ID.DOCUMENT_CARD_TITLE}
          >
            {document.title}
          </Typography>

          {/* Description */}
          <Typography
            variant="body2"
            color="text.secondary"
            data-testid={DATA_TEST_ID.DOCUMENT_CARD_DESCRIPTION}
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {document.description}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default DocumentCard;
