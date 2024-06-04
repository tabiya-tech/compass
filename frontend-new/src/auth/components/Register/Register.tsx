import React, { useContext, useState } from "react";
import { Container, Box, TextField, Button, Typography, Link, useTheme } from "@mui/material";
import { AuthContext } from "src/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import { LanguageOutlined } from "@mui/icons-material";
import IDPAuth from "src/auth/components/IDPAuth/IDPAuth";

const uniqueId = "ab02918f-d559-47ba-9662-ea6b3a3606d0";

export const DATA_TEST_ID = {
  REGISTER_CONTAINER: `register-container-${uniqueId}`,
  LOGO: `register-logo-${uniqueId}`,
  TITLE: `register-title-${uniqueId}`,
  SUBTITLE: `register-subtitle-${uniqueId}`,
  FORM: `register-form-${uniqueId}`,
  NAME_INPUT: `register-name-input-${uniqueId}`,
  EMAIL_INPUT: `register-email-input-${uniqueId}`,
  PASSWORD_INPUT: `register-password-input-${uniqueId}`,
  REGISTER_BUTTON: `register-button-${uniqueId}`,
  FORGOT_PASSWORD_LINK: `register-forgot-password-link-${uniqueId}`,
  REGISTER_USING: `register-using-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  LOGIN_LINK: `register-login-link-${uniqueId}`,
  LANGUAGE_SELECTOR: `register-language-selector-${uniqueId}`,
};

const Register: React.FC = () => {
  const theme = useTheme();

  const [, setName] = useState(""); // we will need this later
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { register } = useContext(AuthContext);

  const navigate = useNavigate();
  const handleRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    register(
      email,
      password,
      (user) => {
        navigate(routerPaths.ROOT);
      },
      (error) => {
        console.error(error);
      }
    );
  };

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.REGISTER_CONTAINER}>
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
          Welcome to Compass!
        </Typography>
        <Typography variant="body2" gutterBottom data-testid={DATA_TEST_ID.SUBTITLE}>
          We need some information to get started
        </Typography>
        <Box component="form" mt={2} onSubmit={handleRegister} data-testid={DATA_TEST_ID.FORM}>
          <TextField
            fullWidth
            label="Name"
            variant="outlined"
            margin="normal"
            required
            onChange={(e) => setName(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.NAME_INPUT }}
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            variant="outlined"
            margin="normal"
            required
            onChange={(e) => setEmail(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_INPUT }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            margin="normal"
            required
            onChange={(e) => setPassword(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.PASSWORD_INPUT }}
          />
          <Button
            fullWidth
            variant="contained"
            color="primary"
            style={{ marginTop: 16 }}
            type="submit"
            data-testid={DATA_TEST_ID.REGISTER_BUTTON}
          >
            Register
          </Button>
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          mt={(theme) => theme.tabiyaSpacing.lg}
          data-testid={DATA_TEST_ID.FIREBASE_AUTH_CONTAINER}
        >
          <Typography variant="body2" mt={2} data-testid={DATA_TEST_ID.REGISTER_USING}>
            Or register using
          </Typography>
          <Box mt={2} width="100%">
            <IDPAuth />
          </Box>
        </Box>
        <Typography variant="body2" mt={2} data-testid={DATA_TEST_ID.LOGIN_LINK}>
          Already have an account? <Link href="/login">Login</Link>
        </Typography>
      </Box>
    </Container>
  );
};

export default Register;
