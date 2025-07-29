import { Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useRef } from "react";
import { action } from "@storybook/addon-actions";

interface ScreeningPageProps {
  email?: string;
  externalUserId?: string;
  showSnackbar?: boolean;
  autoLogin?: boolean;
}

const ScreeningPage: React.FC<ScreeningPageProps> = ({ 
  email = "test@example.com", 
  externalUserId = "test-user-123",
  showSnackbar = false,
  autoLogin = false
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Simulate the screening page behavior
    if (showSnackbar) {
      setTimeout(() => {
        const snackbar = document.getElementById("snackbar-notification");
        if (snackbar) {
          snackbar.className = "show";
          setTimeout(() => {
            snackbar.className = snackbar.className.replace("show", "");
          }, 5000);
        }
      }, 2000);
    }

    if (autoLogin) {
      // Simulate auto-login behavior
      setTimeout(() => {
        action("Auto login triggered")();
      }, 1000);
    }
  }, [showSnackbar, autoLogin]);

  // Create the URL with query parameters
  const screeningUrl = `/screening.html?email=${encodeURIComponent(email)}&externalUserId=${encodeURIComponent(externalUserId)}`;

  return (
    <div style={{ width: "100%", height: "100vh", border: "1px solid #ccc" }}>
      <iframe
        ref={iframeRef}
        src={screeningUrl}
        title="Screening Page"
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
};

const meta: Meta<typeof ScreeningPage> = {
  title: "Pages/Screening",
  component: ScreeningPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
# Screening Page

This is the screening page that users see when they click on the email link to participate in the study.

## Features

- **Email Verification**: Validates email and externalUserId parameters
- **User Consent**: Asks users if they have time to participate
- **Firebase Authentication**: Handles user login with Firebase
- **Group Assignment**: Assigns users to control or treatment groups
- **Chat Integration**: Redirects to the main chat application

## URL Parameters

- \`email\`: User's email address
- \`externalUserId\`: External user identifier

## States

1. **Initial Question**: Asks if user has time to participate
2. **User Busy**: Shows when user doesn't have time
3. **Wait Moment**: Loading state during API calls
4. **Chat Container**: Main application iframe
5. **Error States**: Invalid parameters, server errors

## Configuration

The page requires several configuration values:
- RCT_BACKEND_API_URL
- RCT_BACKEND_API_KEY  
- RCT_FIREBASE_API_KEY
- CONTROL_GROUP_REDIRECT_LINK

These are loaded from the screening config bucket.
        `,
      },
    },
  },
  argTypes: {
    email: {
      control: "text",
      description: "Email address for the screening flow",
    },
    externalUserId: {
      control: "text", 
      description: "External user ID for the screening flow",
    },
    showSnackbar: {
      control: "boolean",
      description: "Whether to show the snackbar notification",
    },
    autoLogin: {
      control: "boolean",
      description: "Whether to simulate auto-login behavior",
    },
  },
  args: {
    email: "test@example.com",
    externalUserId: "test-user-123",
    showSnackbar: false,
    autoLogin: false,
  },
};

export default meta;

type Story = StoryObj<typeof ScreeningPage>;

export const Default: Story = {
  args: {
    email: "test@example.com",
    externalUserId: "test-user-123",
  },
};
