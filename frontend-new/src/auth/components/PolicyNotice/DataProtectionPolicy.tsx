import React from "react";
import { Container, Box, Button, Typography, useTheme, styled } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import { LanguageOutlined } from "@mui/icons-material";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

const uniqueId = "1dee3ba4-1853-40c6-aaad-eeeb0e94788d";

const HiglightedSpan = styled("span")(({ theme }) => ({
  backgroundColor: theme.palette.tabiyaYellow.light,
}));

export const DATA_TEST_ID = {
  DPA_CONTAINER: `dpa-container-${uniqueId}`,
  LOGO: `dpa-logo-${uniqueId}`,
  TITLE: `dpa-title-${uniqueId}`,
  AGREEMENT_BODY: `dpa-agreement-body-${uniqueId}`,
  DPA: `dpa-form-${uniqueId}`,
  LANGUAGE_SELECTOR: `dpa-language-selector-${uniqueId}`,
  ACCEPT_DPA_BUTTON: `dpa-accept-button-${uniqueId}`,
};

const DataProtectionAgreement: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const { enqueueSnackbar } = useSnackbar();

  const handleAcceptedDPA = () => {
    enqueueSnackbar("Data Protection Agreement Accepted", { variant: "success" });
    navigate(routerPaths.ROOT);
  };

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.DPA_CONTAINER}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        m={4}
        height={"80%"}
      >
        <Box display="flex" flexDirection="row" justifyContent="center" alignItems="center">
          <img
            src={`${process.env.PUBLIC_URL}/logo.svg`}
            alt="Logo"
            style={{ maxWidth: "60%", margin: "10%" }}
            data-testid={DATA_TEST_ID.LOGO}
          />
          <PrimaryIconButton
            sx={{
              color: theme.palette.common.black,
              alignSelf: "flex-start",
              justifySelf: "flex-end",
              margin: theme.tabiyaSpacing.lg,
            }}
            data-testid={DATA_TEST_ID.LANGUAGE_SELECTOR}
            title={"Language Selector"}
          >
            <LanguageOutlined />
          </PrimaryIconButton>
        </Box>
        <Typography variant="h4" gutterBottom data-testid={DATA_TEST_ID.TITLE}>
          Thank you for using Tabiya Compass.
        </Typography>
        <Typography variant="body2" gutterBottom data-testid={DATA_TEST_ID.AGREEMENT_BODY}>
          We created this AI tool for you with care to help you and other young people like you explore their skills and
          discover new opportunities.
          <br />
          <br />
          <HiglightedSpan>Please use AI responsibly!</HiglightedSpan>
          <br />
          <br />
          AI technology is new and far from perfect. It doesn't understand context like humans do.
          <br />
          <br />
          Always double-check any important information and avoid sharing personal data.
          <br />
          <br />
          Help us keep all AI interactions safe and positive! 😊
          <br />
          <br />
          Are you ready to start?
        </Typography>

        <Button
          fullWidth
          variant="contained"
          color="primary"
          style={{ marginTop: 16 }}
          data-testid={DATA_TEST_ID.ACCEPT_DPA_BUTTON}
          onClick={handleAcceptedDPA}
        >
          Sure, I am ready.
        </Button>
      </Box>
    </Container>
  );
};

export default DataProtectionAgreement;
