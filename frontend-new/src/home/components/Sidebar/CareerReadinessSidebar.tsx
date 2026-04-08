import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import Sidebar from "src/theme/Sidebar/Sidebar";
import SidebarService from "src/home/components/Sidebar/SidebarService";
import type { ObjectivesData, ObjectiveItem } from "src/home/components/Sidebar/SidebarService";

const uniqueId = "d3e4f5a6-b7c8-9012-defa-345678901234";

export const DATA_TEST_ID = {
  CAREER_READINESS_SIDEBAR_PROGRESS_BAR: `career-readiness-sidebar-progress-bar-${uniqueId}`,
  CAREER_READINESS_SIDEBAR_PROGRESS_FILL: `career-readiness-sidebar-progress-fill-${uniqueId}`,
  CAREER_READINESS_SIDEBAR_OBJECTIVE: `career-readiness-sidebar-objective-${uniqueId}`,
  CAREER_READINESS_SIDEBAR_OBJECTIVE_INDICATOR: `career-readiness-sidebar-objective-indicator-${uniqueId}`,
};

const POLL_INTERVAL_MS = 30_000;

interface ObjectiveRowProps {
  objective: ObjectiveItem;
  accentColor: string;
}

const ObjectiveRow: React.FC<ObjectiveRowProps> = ({ objective, accentColor }) => {
  const theme = useTheme();
  const isDone = objective.status === "done";
  const isActive = objective.status === "active";

  return (
    <Box
      data-testid={DATA_TEST_ID.CAREER_READINESS_SIDEBAR_OBJECTIVE}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
        padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs)} ${theme.fixedSpacing(theme.tabiyaSpacing.sm)}`,
        marginLeft: `-${theme.fixedSpacing(theme.tabiyaSpacing.sm)}`,
        marginRight: `-${theme.fixedSpacing(theme.tabiyaSpacing.sm)}`,
        borderRadius: theme.rounding(theme.tabiyaRounding.xs * 1.5),
        backgroundColor: isActive ? `${accentColor}14` : "transparent",
        ...theme.typography.caption,
        color: isDone || isActive ? theme.palette.common.black : theme.palette.text.secondary,
        lineHeight: 1.5,
      }}
    >
      <Box
        data-testid={DATA_TEST_ID.CAREER_READINESS_SIDEBAR_OBJECTIVE_INDICATOR}
        sx={{
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          border: `2px solid ${isDone || isActive ? accentColor : theme.palette.divider}`,
          backgroundColor: isDone ? accentColor : "transparent",
          flexShrink: 0,
          marginTop: "2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isDone && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </Box>
      {objective.label}
    </Box>
  );
};

const CareerReadinessSidebar: React.FC = () => {
  const theme = useTheme();
  const [data, setData] = useState<ObjectivesData | null>(null);
  const cancelledRef = useRef(false);

  const accentColor = theme.palette.warning.main;

  const load = useCallback(async () => {
    const result = await SidebarService.getInstance().getObjectivesData();
    if (!cancelledRef.current) setData(result);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(timer);
    };
  }, [load]);

  const objectives = data?.objectives ?? [];
  const completedCount = objectives.filter((o) => o.status === "done").length;
  const progressPct = objectives.length > 0 ? Math.round((completedCount / objectives.length) * 100) : 0;

  return (
    <Sidebar title="Learning Objectives" width={300}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.5) }}>
        <Box
          data-testid={DATA_TEST_ID.CAREER_READINESS_SIDEBAR_PROGRESS_BAR}
          sx={{
            height: "4px",
            borderRadius: theme.rounding(theme.tabiyaRounding.full),
            backgroundColor: theme.palette.grey[100],
            overflow: "hidden",
          }}
        >
          <Box
            data-testid={DATA_TEST_ID.CAREER_READINESS_SIDEBAR_PROGRESS_FILL}
            sx={{
              height: "100%",
              width: `${progressPct}%`,
              backgroundColor: accentColor,
              transition: "width 0.5s ease",
            }}
          />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.xxs) }}>
          {objectives.map((obj, i) => (
            <ObjectiveRow key={obj.id ?? i} objective={obj} accentColor={accentColor} />
          ))}
        </Box>
      </Box>
    </Sidebar>
  );
};

export default CareerReadinessSidebar;
