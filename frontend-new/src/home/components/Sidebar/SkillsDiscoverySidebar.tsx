import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import Sidebar from "src/theme/Sidebar/Sidebar";
import SidebarService from "src/home/components/Sidebar/SidebarService";
import type { SkillsData } from "src/home/components/Sidebar/SidebarService";
import ChatProgressBar from "src/chat/chatProgressbar/ChatProgressBar";
import { type CurrentPhase } from "src/chat/chatProgressbar/types";

const uniqueId = "b1c2d3e4-f5a6-7890-bcde-f12345678901";

export const DATA_TEST_ID = {
  SKILLS_DISCOVERY_SIDEBAR_CHIP: `skills-discovery-sidebar-chip-${uniqueId}`,
  SKILLS_DISCOVERY_SIDEBAR_EMPTY: `skills-discovery-sidebar-empty-${uniqueId}`,
  SKILLS_DISCOVERY_SIDEBAR_EXPAND_BUTTON: `skills-discovery-sidebar-expand-button-${uniqueId}`,
};

const COLLAPSE_AFTER = 8;

// Style guide tokens (hardcoded to avoid MUI theme indirection)
const TOKEN = {
  emerald: "#0A5C4A",
  stone: "#7D7469",
  black: "#1A1208",
  // tag--teal: custom tint from style guide (not --teal-light)
  tealBg: "#D8EFF0",
  tealText: "#0A5C4A", // emerald
  // tag--amber: custom tint from style guide
  amberBg: "#FAF0D8",
  amberText: "#1A1208", // black
};

const subsectionLabelSx = {
  fontSize: "11px",
  fontWeight: 600,
  color: TOKEN.stone,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  marginBottom: "10px",
};

const tagSx = (bg: string, color: string) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 12px",
  borderRadius: "12px", // --radius-lg
  fontSize: "0.875rem", // --text-sm
  fontWeight: 600,
  lineHeight: 1.2,
  backgroundColor: bg,
  color,
  cursor: "default" as const,
});

interface SkillsDiscoverySidebarProps {
  currentPhase: CurrentPhase;
  refreshToken?: number;
}

const SkillsDiscoverySidebar: React.FC<SkillsDiscoverySidebarProps> = ({ currentPhase, refreshToken = 0 }) => {
  const [data, setData] = useState<SkillsData | null>(null);
  const [programmeSkills, setProgrammeSkills] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    const [skillsData, progSkills] = await Promise.all([
      SidebarService.getInstance().getSkillsData(),
      SidebarService.getInstance().getProgrammeSkills(),
    ]);
    if (!cancelledRef.current) {
      setData(skillsData);
      setProgrammeSkills(progSkills);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load, refreshToken]);

  const workSkills = data?.skills ?? [];
  const hasMore = workSkills.length > COLLAPSE_AFTER;
  const visibleWorkSkills = hasMore && !expanded ? workSkills.slice(0, COLLAPSE_AFTER) : workSkills;
  const hasAnySkills = workSkills.length > 0 || programmeSkills.length > 0;

  return (
    <Sidebar title="Skills Identified" width={300}>
      {/* Progress bar */}
      <ChatProgressBar {...currentPhase} />

      {!hasAnySkills ? (
        /* Empty state */
        <Box
          data-testid={DATA_TEST_ID.SKILLS_DISCOVERY_SIDEBAR_EMPTY}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "8px",
            padding: "24px 8px",
            color: TOKEN.stone,
            fontSize: "11px",
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#F2F1F0", // --cloud
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: TOKEN.stone,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </Box>
          Skills will appear here as you chat with Njila.
        </Box>
      ) : (
        <>
          {/* Work & life skills */}
          {workSkills.length > 0 && (
            <Box>
              <Box sx={subsectionLabelSx}>From work &amp; life</Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {visibleWorkSkills.map((label, i) => (
                  <Box
                    key={i}
                    data-testid={DATA_TEST_ID.SKILLS_DISCOVERY_SIDEBAR_CHIP}
                    sx={tagSx(TOKEN.tealBg, TOKEN.tealText)}
                  >
                    {label}
                  </Box>
                ))}
              </Box>
              {hasMore && (
                <Box
                  component="button"
                  data-testid={DATA_TEST_ID.SKILLS_DISCOVERY_SIDEBAR_EXPAND_BUTTON}
                  onClick={() => setExpanded((prev) => !prev)}
                  sx={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    marginTop: "8px",
                    cursor: "pointer",
                    color: TOKEN.emerald,
                    fontSize: "11px",
                    fontWeight: 500,
                    textAlign: "left",
                    width: "fit-content",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {expanded ? "Show Less" : `See All ${workSkills.length} →`}
                </Box>
              )}
            </Box>
          )}

          {/* Programme skills */}
          {programmeSkills.length > 0 && (
            <Box>
              <Box sx={subsectionLabelSx}>From programme</Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {programmeSkills.map((label, i) => (
                  <Box key={i} sx={tagSx(TOKEN.amberBg, TOKEN.amberText)}>
                    {label}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </>
      )}
    </Sidebar>
  );
};

export default SkillsDiscoverySidebar;
