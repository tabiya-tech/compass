import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Chip,
  useTheme,
  useMediaQuery,
  Divider,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import type { JobRow } from "src/jobMatching/types";

interface JobDetailModalProps {
  job: JobRow | null;
  open: boolean;
  onClose: () => void;
}

const capitalize = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, open, onClose }) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((t: Theme) => t.breakpoints.down("sm"));

  if (!job) return null;

  const handleApply = () => {
    if (job.jobUrl) window.open(job.jobUrl, "_blank", "noopener,noreferrer");
  };

  const padding = isSmallMobile
    ? theme.fixedSpacing(theme.tabiyaSpacing.md)
    : theme.fixedSpacing(theme.tabiyaSpacing.lg);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          display: "flex",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          padding,
          borderRadius: theme.rounding(theme.tabiyaRounding.md),
        },
      }}
    >
      {/* Title row */}
      <DialogTitle sx={{ padding: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography variant="h6" component="div" color="primary" fontWeight={700}>
            {capitalize(job.jobTitle)}
          </Typography>
          {job.company && (
            <Typography variant="body2" color="text.secondary" mt={theme.fixedSpacing(theme.tabiyaSpacing.xxs)}>
              {capitalize(job.company)}
            </Typography>
          )}
        </Box>
        <PrimaryIconButton
          title="Close"
          onClick={onClose}
          sx={{ color: theme.palette.common.black, flexShrink: 0, mt: -0.5 }}
        >
          <CloseIcon />
        </PrimaryIconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ padding: 0 }}>
        {/* Meta pills */}
        <Box
          display="flex"
          flexWrap="wrap"
          gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
          mb={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        >
          {job.employmentType && (
            <Chip
              label={capitalize(job.employmentType)}
              size="small"
              sx={{
                backgroundColor: theme.palette.primary.light,
                color: theme.palette.common.black,
                border: `1px solid ${theme.palette.primary.main}`,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
          )}
          {job.location && (
            <Chip
              label={capitalize(job.location)}
              size="small"
              variant="outlined"
              sx={{ fontSize: "0.75rem", borderColor: theme.palette.primary.main, color: theme.palette.primary.main }}
            />
          )}
          {job.posted && (
            <Chip label={`Posted ${job.posted}`} size="small" variant="outlined" sx={{ fontSize: "0.75rem" }} />
          )}
        </Box>

        {/* Category */}
        {job.category && (
          <Typography variant="body2" color="text.secondary" mb={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <Box component="span" fontWeight={700} color="text.primary">
              Category:{" "}
            </Box>
            {capitalize(job.category)}
          </Typography>
        )}

        {/* Match score */}
        {job.matchScore != null && (
          <Typography variant="body2" color="text.secondary" mb={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <Box component="span" fontWeight={700} color="text.primary">
              Match Score:{" "}
            </Box>
            {job.matchScore}%
          </Typography>
        )}

        {/* Skills */}
        {job.skills && job.skills.length > 0 && (
          <>
            <Divider sx={{ my: theme.fixedSpacing(theme.tabiyaSpacing.sm) }} />
            <Typography
              variant="body2"
              fontWeight={700}
              color="text.primary"
              mb={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
            >
              Extracted Skills ({job.skills.length})
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
              {job.skills.map((skill) => (
                <Chip
                  key={skill}
                  label={capitalize(skill)}
                  size="small"
                  sx={{
                    backgroundColor: "transparent",
                    border: `1px solid ${theme.palette.primary.main}`,
                    color: theme.palette.primary.main,
                    borderRadius: theme.rounding(theme.tabiyaRounding.xs),
                    fontSize: "0.75rem",
                  }}
                />
              ))}
            </Box>
          </>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ padding: 0 }}>
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        <PrimaryButton onClick={handleApply} disabled={!job.jobUrl}>
          Apply Now
        </PrimaryButton>
      </DialogActions>
    </Dialog>
  );
};

export default JobDetailModal;
