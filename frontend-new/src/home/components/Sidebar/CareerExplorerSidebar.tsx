import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { getProductName } from "src/envService";
import Sidebar from "src/theme/Sidebar/Sidebar";
import SidebarService from "src/home/components/Sidebar/SidebarService";
import type { SectorData, SectorItem } from "src/home/components/Sidebar/SidebarService";

const uniqueId = "c2d3e4f5-a6b7-8901-cdef-234567890123";

export const DATA_TEST_ID = {
  CAREER_EXPLORER_SIDEBAR_SECTOR_CARD: `career-explorer-sidebar-sector-card-${uniqueId}`,
  CAREER_EXPLORER_SIDEBAR_SECTOR_NAME: `career-explorer-sidebar-sector-name-${uniqueId}`,
  CAREER_EXPLORER_SIDEBAR_SECTOR_SALARY: `career-explorer-sidebar-sector-salary-${uniqueId}`,
  CAREER_EXPLORER_SIDEBAR_SECTOR_DESCRIPTION: `career-explorer-sidebar-sector-description-${uniqueId}`,
  CAREER_EXPLORER_SIDEBAR_EMPTY: `career-explorer-sidebar-empty-${uniqueId}`,
};

interface SectorCardProps {
  sector: SectorItem;
  accentColor: string;
}

const SectorCard: React.FC<SectorCardProps> = ({ sector, accentColor }) => {
  const theme = useTheme();
  const salaryRange = sector.salaryRange?.trim();
  const shouldShowSalaryRange = Boolean(salaryRange && salaryRange !== "—");

  return (
    <Box
      data-testid={DATA_TEST_ID.CAREER_EXPLORER_SIDEBAR_SECTOR_CARD}
      sx={{
        paddingTop: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.25),
        paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.25),
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.xs * 1.5),
          marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.xs),
          flexWrap: "wrap",
        }}
      >
        <Box component="span" sx={{ fontSize: "16px", lineHeight: 1 }}>
          {sector.emoji}
        </Box>
        <Box
          component="span"
          data-testid={DATA_TEST_ID.CAREER_EXPLORER_SIDEBAR_SECTOR_NAME}
          sx={{ ...theme.typography.body2, fontWeight: 700, color: theme.palette.common.black }}
        >
          {sector.name}
        </Box>
        {shouldShowSalaryRange && (
          <Box
            component="span"
            data-testid={DATA_TEST_ID.CAREER_EXPLORER_SIDEBAR_SECTOR_SALARY}
            sx={{
              ...theme.typography.caption,
              fontWeight: 700,
              padding: `1px ${theme.fixedSpacing(theme.tabiyaSpacing.sm)}`,
              borderRadius: theme.rounding(theme.tabiyaRounding.full),
              border: `1px solid ${accentColor}40`,
              backgroundColor: `${accentColor}0F`,
              color: accentColor,
              whiteSpace: "nowrap",
            }}
          >
            {salaryRange}
          </Box>
        )}
      </Box>
      <Typography
        data-testid={DATA_TEST_ID.CAREER_EXPLORER_SIDEBAR_SECTOR_DESCRIPTION}
        sx={{
          ...theme.typography.caption,
          color: theme.palette.text.secondary,
          lineHeight: 1.5,
        }}
      >
        {sector.description}
      </Typography>
    </Box>
  );
};

interface CareerExplorerSidebarProps {
  refreshToken?: number;
}

const CareerExplorerSidebar: React.FC<CareerExplorerSidebarProps> = ({ refreshToken = 0 }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const appName = getProductName();
  const [data, setData] = useState<SectorData | null>(null);
  const cancelledRef = useRef(false);

  const accentColor = theme.palette.primary.main;

  const load = useCallback(async () => {
    const result = await SidebarService.getInstance().getSectorData();
    if (!cancelledRef.current) setData(result);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load, refreshToken]);

  const sectors = data?.sectors ?? [];

  return (
    <Sidebar title={t("home.sidebar.careerExplorer.title")}>
      {sectors.length === 0 ? (
        <Box
          data-testid={DATA_TEST_ID.CAREER_EXPLORER_SIDEBAR_EMPTY}
          sx={{
            ...theme.typography.caption,
            lineHeight: 1.5,
            color: theme.palette.text.secondary,
          }}
        >
          {t("home.sidebar.careerExplorer.emptyState", { appName })}
        </Box>
      ) : (
        <Box>
          {sectors.map((sector, i) => (
            <SectorCard key={sector.id ?? i} sector={sector} accentColor={accentColor} />
          ))}
        </Box>
      )}
    </Sidebar>
  );
};

export default CareerExplorerSidebar;
