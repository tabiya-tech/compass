import React from "react";
import { Badge, keyframes, styled } from "@mui/material";

const uniqueId = "c3f4e2d0-7b4b-4f2f-9c29-7f2e0b9a8a10";

export const DATA_TEST_ID = {
  ANIMATED_DOT_BADGE: `animated-dot-badge-${uniqueId}`,
};

interface AnimatedDotBadgeProps {
  children: React.ReactNode;
  show: boolean;
}

const pulse = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 255, 145, 0.7);
  }
  50% {
    transform: scale(1.15);
    box-shadow: 0 0 0 6px rgba(0, 255, 145, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 255, 145, 0);
  }
`;

const Dot = styled("span")(({ theme }) => ({
  display: "inline-block",
  width: theme.fixedSpacing(theme.tabiyaSpacing.sm),
  height: theme.fixedSpacing(theme.tabiyaSpacing.sm),
  borderRadius: "50%",
  backgroundColor: theme.palette.primary.main,
  animation: `${pulse} 1.4s infinite`,
}));

const AnimatedDotBadge: React.FC<AnimatedDotBadgeProps> = ({ children, show }) => {
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      badgeContent={<Dot />}
      invisible={!show}
      data-testid={DATA_TEST_ID.ANIMATED_DOT_BADGE}
    >
      {children}
    </Badge>
  );
};

export default AnimatedDotBadge;


