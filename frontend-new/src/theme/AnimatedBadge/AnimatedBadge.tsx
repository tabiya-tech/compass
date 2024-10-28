import React from "react";
import { Badge, keyframes, styled } from "@mui/material";

const uniqueId = "a348462e-a393-4445-9a3b-c9603e878ce7";

export const DATA_TEST_ID = {
  ANIMATED_BADGE: `animated-badge-${uniqueId}`,
};

interface AnimatedBadgeProps {
  children: React.ReactNode;
  badgeContent: number;
  invisible: boolean;
}

const pulse = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 255, 145, 0.8);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 0 10px rgba(0, 255, 145, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 255, 145, 0);
  }
`;

const StyledBadgeContent = styled("span")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `${theme.fixedSpacing(theme.tabiyaSpacing.sm)} ${theme.fixedSpacing(theme.tabiyaSpacing.xs)}`,
  borderRadius: theme.tabiyaRounding.xl * 5, // xl wasn't quite big enough when badgeContent was 99+ and full was too big, 5 was picked arbitrarily
  fontSize: theme.typography.subtitle2.fontSize,
  minWidth: theme.fixedSpacing(theme.tabiyaSpacing.lg),
  height: theme.fixedSpacing(theme.tabiyaSpacing.lg),
  backgroundColor: theme.palette.primary.main,
  animation: `${pulse} 1.5s infinite`,
}));

const AnimatedBadge: React.FC<AnimatedBadgeProps> = ({ children, badgeContent, invisible }) => {
  const badgeDisplayContent = badgeContent > 99 ? "99+" : badgeContent;

  return (
    <Badge
      badgeContent={<StyledBadgeContent>{badgeDisplayContent}</StyledBadgeContent>}
      invisible={invisible}
      data-testid={DATA_TEST_ID.ANIMATED_BADGE}
    >
      {children}
    </Badge>
  );
};

export default AnimatedBadge;
