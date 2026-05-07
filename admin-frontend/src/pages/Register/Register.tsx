import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { getDarkLogoUrl } from "src/envService";
import InstitutionAutocomplete from "src/pages/Users/components/InstitutionAutocomplete";
import { HttpError } from "src/pages/Users/usersService";
import { CreateRegistrationRequest, RegistrationRoleRequest, registrationsService } from "./registrationsService";
import { usePublicInstitutionOptions } from "./usePublicInstitutionOptions";

const uniqueId = "register-page-9b3d5f7a-2c4e-4d6f-8a0b-1c3e5d7f9a0c";

export const DATA_TEST_ID = {
  REGISTER_PAGE_CONTAINER: `${uniqueId}-container`,
  REGISTER_PAGE_LOGO: `${uniqueId}-logo`,
  REGISTER_PAGE_TITLE: `${uniqueId}-title`,
  REGISTER_PAGE_EMAIL: `${uniqueId}-email`,
  REGISTER_PAGE_NAME: `${uniqueId}-name`,
  REGISTER_PAGE_ROLE: `${uniqueId}-role`,
  REGISTER_PAGE_SUBMIT: `${uniqueId}-submit`,
  REGISTER_PAGE_SUCCESS: `${uniqueId}-success`,
};

const ROLE_LABELS: Record<RegistrationRoleRequest, string> = {
  [RegistrationRoleRequest.ADMIN]: "Cross-institution admin",
  [RegistrationRoleRequest.INSTITUTION_STAFF]: "Instructor",
};

const Register: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { options, loading: institutionsLoading, error: institutionsError } = usePublicInstitutionOptions();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<RegistrationRoleRequest>(RegistrationRoleRequest.INSTITUTION_STAFF);
  const [institutionId, setInstitutionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preferredSrc = getDarkLogoUrl() || `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload: CreateRegistrationRequest = {
      email: email.trim(),
      name: name.trim(),
      requested_role: role,
      ...(role === RegistrationRoleRequest.INSTITUTION_STAFF && institutionId ? { institution_id: institutionId } : {}),
    };

    setSubmitting(true);
    try {
      await registrationsService.submit(payload);
      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof HttpError && err.status === 409) {
        setError(t("register.errors.alreadyExists", "An active registration already exists for this email."));
      } else {
        setError(t("register.errors.generic", "Failed to submit registration. Please try again."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isValid =
    email.trim() !== "" &&
    name.trim() !== "" &&
    (role !== RegistrationRoleRequest.INSTITUTION_STAFF || institutionId.trim() !== "");

  return (
    <Container maxWidth="sm" data-testid={DATA_TEST_ID.REGISTER_PAGE_CONTAINER}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Box
          sx={{
            padding: theme.spacing(4),
            width: "100%",
            borderRadius: theme.tabiyaRounding.sm,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "center", marginBottom: theme.tabiyaSpacing.lg }}>
            <Box
              component="img"
              src={preferredSrc}
              alt={t("register.logoAlt", "Logo")}
              data-testid={DATA_TEST_ID.REGISTER_PAGE_LOGO}
              sx={{ height: 64, width: "auto", maxWidth: "100%" }}
            />
          </Box>

          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            textAlign="center"
            data-testid={DATA_TEST_ID.REGISTER_PAGE_TITLE}
          >
            {t("register.title", "Request Access")}
          </Typography>

          {submitted ? (
            <Alert severity="success" sx={{ mt: 2 }} data-testid={DATA_TEST_ID.REGISTER_PAGE_SUCCESS}>
              {t(
                "register.success",
                "Thanks — we received your request. You'll get an email once a super admin reviews and approves your account."
              )}
            </Alert>
          ) : (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
                sx={{ marginBottom: theme.tabiyaSpacing.lg }}
              >
                {t(
                  "register.subtitle",
                  "Sign up as an instructor or cross-institution admin. A super admin will review your request."
                )}
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  label={t("register.email", "Email")}
                  type="email"
                  margin="normal"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  autoComplete="email"
                  data-testid={DATA_TEST_ID.REGISTER_PAGE_EMAIL}
                />
                <TextField
                  fullWidth
                  label={t("register.name", "Full name")}
                  margin="normal"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  data-testid={DATA_TEST_ID.REGISTER_PAGE_NAME}
                />

                <FormControl fullWidth margin="normal" required>
                  <InputLabel>{t("register.role", "Role")}</InputLabel>
                  <Select
                    value={role}
                    label={t("register.role", "Role")}
                    onChange={(e) => setRole(e.target.value as RegistrationRoleRequest)}
                    disabled={submitting}
                    data-testid={DATA_TEST_ID.REGISTER_PAGE_ROLE}
                  >
                    <MenuItem value={RegistrationRoleRequest.INSTITUTION_STAFF}>
                      {ROLE_LABELS[RegistrationRoleRequest.INSTITUTION_STAFF]}
                    </MenuItem>
                    <MenuItem value={RegistrationRoleRequest.ADMIN}>
                      {ROLE_LABELS[RegistrationRoleRequest.ADMIN]}
                    </MenuItem>
                  </Select>
                </FormControl>

                {role === RegistrationRoleRequest.INSTITUTION_STAFF && (
                  <InstitutionAutocomplete
                    value={institutionId}
                    onChange={setInstitutionId}
                    required
                    disabled={submitting}
                    options={options}
                    loading={institutionsLoading}
                    error={institutionsError}
                  />
                )}

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={submitting || !isValid}
                  sx={{ mt: 3, mb: 2, height: 48 }}
                  data-testid={DATA_TEST_ID.REGISTER_PAGE_SUBMIT}
                >
                  {submitting ? <CircularProgress size={24} color="inherit" /> : t("register.submit", "Submit request")}
                </Button>
              </Box>
            </>
          )}

          <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
            <Link component="button" type="button" onClick={() => navigate(routerPaths.LOGIN)}>
              {t("register.backToLogin", "Back to login")}
            </Link>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default Register;
