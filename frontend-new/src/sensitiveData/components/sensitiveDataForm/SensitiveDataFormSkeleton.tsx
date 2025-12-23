import { Box, Container, Skeleton, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";

const uniqueId = "ac78f5a9-ee1e-4735-841a-7f5e5939ea6b";

export const DATA_TEST_ID = {
  SENSITIVE_DATA_FORM_SKELETON: `sensitive-data-form-skeleton-${uniqueId}`,
};

const SensitiveDataFormSkeleton = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.SENSITIVE_DATA_FORM_SKELETON}>
      <AuthHeader title={"Loading form..."} subtitle={<></>} />
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
        width={"100%"}
        height={"100%"}
        sx={{
          paddingX: isMobile ? theme.fixedSpacing(theme.tabiyaSpacing.sm) : theme.spacing(0),
          paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.xl),
        }}
      >
        <Box display="flex" flexDirection="column" gap={1} width="100%">
          <Skeleton variant="text" sx={{ width: "90%" }} />
          <Skeleton variant="text" sx={{ width: "75%" }} />
          <Skeleton variant="text" sx={{ width: "80%" }} />
        </Box>
        <Box width={"100%"} display={"flex"} flexDirection={"column"} gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}>
          {/* Skeleton fields - showing 3 different types of fields */}
          <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
            {/* String field skeleton */}
            {Array.from({ length: 6 }).map((_, index) => (
              <Box display="flex" flexDirection="column" gap={1} key={index}>
                <Skeleton variant="rounded" width="100%" height={56} />
              </Box>
            ))}
          </Box>

          {/* Action buttons skeleton */}
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: theme.tabiyaSpacing.xl,
            }}
          >
            <Skeleton variant="text" width={80} height={40} />
            <Skeleton variant="rounded" width="70%" height={40} />
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default SensitiveDataFormSkeleton;
