import { useContext, useState, useEffect } from "react";
import {
  Experience,
  SUMMARY_MAX_LENGTH
} from "src/experiences/experienceService/experiences.types";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import InlineEditField from "src/theme/InlineEditField/InlineEditField";
import RestoreIcon from "@mui/icons-material/Restore";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { ExperienceError } from "src/error/commonErrors";
import CustomLink from "src/theme/CustomLink/CustomLink";

export interface SummaryEditFieldProps {
  summary: string;
  experience_uuid: string;
  notifyOnChange: (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>, field: keyof Experience, maxLength?: number) => void;
  error?: string;
}

const uniqueId = "b1a6b2cd-cfac-46ff-9c35-0298d87def6b";

export const DATA_TEST_ID = {
  FORM_SUMMARY: `form-summary-${uniqueId}`,
  FORM_SUMMARY_RESTORE: `form-summary-restore-${uniqueId}`,
  FORM_SUMMARY_HELPER: `form-summary-error-${uniqueId}`,
};

const StyledCustomLink: React.FC<React.ComponentProps<typeof CustomLink>> = (props) => {
  const theme = useTheme();
  return (
    <CustomLink
      {...props}
      style={{
        display: "inline-flex",
        flexDirection: "row",
        gap: theme.spacing(theme.tabiyaSpacing.xs),
        verticalAlign: "bottom",
        ...props.style
      }}
    />
  );
};

export const SUMMARY_FIELD_NAME : keyof Experience = "summary";

const SummaryEditField: React.FC<Readonly<SummaryEditFieldProps>> = ({
  summary,
  experience_uuid,
  notifyOnChange,
  error,
}) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext)
  const { enqueueSnackbar } = useSnackbar();


  const [summaryValue, setSummaryValue] = useState(summary);
  const [isRestoring, setIsRestoring] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(error ?? null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const restoreToOriginalSummary = async () => {
      setIsRestoring(true);
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (!sessionId) {
        throw new Error("User has no sessions");
      }

      try {
        // get original version of summary
        const experienceService = ExperienceService.getInstance();
        const originalExperience = await experienceService.getUneditedExperience(sessionId, experience_uuid);
        setSummaryValue(originalExperience.summary ?? "");
        setSuccessText("Summary restored.")
        notifyOnChange({ target: { value: originalExperience.summary ?? "" } } as React.ChangeEvent<HTMLTextAreaElement>, SUMMARY_FIELD_NAME, SUMMARY_MAX_LENGTH);
        setTimeout(() => {
          setSuccessText(null);
        }, 3000); // Clear message after 3 seconds
      } catch (err) {
        console.error(new ExperienceError("Failed to restore summary:", err));
        enqueueSnackbar("Failed to restore summary. Please try again later.", { variant: "error" });
      } finally {
        setIsRestoring(false);
      }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setSummaryValue(event.target.value);
      notifyOnChange(event, SUMMARY_FIELD_NAME, SUMMARY_MAX_LENGTH);
  }
  // decide when to show error messages
  useEffect(() => {
    if (error) {
      setErrorText(error);
    } else {
      setErrorText(null);
    }
  }, [error, theme.palette.error.main]);


  return (
    <Box>
      <Box
        sx={{
          backgroundColor: theme.palette.grey[100],
          borderRadius: theme.fixedSpacing(theme.tabiyaRounding.sm),
          width: "100%",
        }}
      >
        {/* Toolbar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${theme.palette.grey[200]}`,
            padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
          }}
        >
          <Stack direction="row" spacing={1}>
            <StyledCustomLink
              onClick={restoreToOriginalSummary}
              disabled={!isOnline || isRestoring}
              data-testid={DATA_TEST_ID.FORM_SUMMARY_RESTORE}
              variant="caption"
            >
              <RestoreIcon /> Restore
            </StyledCustomLink>
            {/* Other buttons */}
          </Stack>
        </Box>

        {/* Text area */}
        <Box
          sx={{
            padding: theme.spacing(theme.tabiyaSpacing.sm),
          }}
        >
          <InlineEditField
            placeholder="Summary of experience"
            value={summaryValue}
            onChange={handleInputChange}
            multiline
            minRows={8}
            inputProps={{ maxLength: SUMMARY_MAX_LENGTH + 1 }} // +1 to allow the user to overflow and see the error
            sx={{
              border: 0,
              padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              fontSize: theme.typography.body2.fontSize,
              backgroundColor: "transparent",
              "& textarea": {
                padding: 0,
                resize: "none",
              },
            }}
            data-testid={DATA_TEST_ID.FORM_SUMMARY}
            error={!!error}
          />
        </Box>
      </Box>
    {( errorText || successText) && (
      <Typography
        variant="caption"
        color={errorText ? theme.palette.error.main : theme.palette.success.dark}
        data-testid={DATA_TEST_ID.FORM_SUMMARY_HELPER}
      >
        {errorText ?? successText}
      </Typography>
    )}
  </Box>
  );
};

export default SummaryEditField;
