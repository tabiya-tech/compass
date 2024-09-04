import { Box, Typography } from "@mui/material";

const uniqueId = "37d307ae-4f1e-4d8d-bafe-fd642f8af4ab";
export const DATA_TEST_ID = {
  INTERNAL_ERROR_CONTAINER: `internal-error-${uniqueId}}`,
  INTERNAL_ERROR_ILLUSTRATION: `internal-error-illustration-${uniqueId}}`,
  INTERNAL_ERROR_MESSAGE: `internal-error-message-${uniqueId}`,
};

const InternalError = () => {
  return (
    <Box
      flex={1}
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
      display="flex"
      data-testid={DATA_TEST_ID.INTERNAL_ERROR_CONTAINER}
    >
      <img src="/logo.svg" alt="internal error" width="250px" data-testid={DATA_TEST_ID.INTERNAL_ERROR_ILLUSTRATION} />
      <Typography variant="h2" data-testid={DATA_TEST_ID.INTERNAL_ERROR_MESSAGE}>
        500 Error - Internal Server Error
      </Typography>
    </Box>
  );
};

export default InternalError;
