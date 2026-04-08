import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, useTheme } from "@mui/material";
import { getBackendUrl } from "src/envService";
import type { SectorStaticData } from "./sectorStaticData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CriticalSkill {
  sector: string;
  occupation: string;
  zqf?: string;
  duration?: string;
  matched_programmes: string[];
}

interface Programme {
  name: string;
  qualification?: string;
  zqf?: string;
}

interface PriorityCurriculum {
  sector: string;
  occupation: string;
  status?: string;
}

interface SectorData {
  sector: string;
  institution_count: number;
  programme_count: number;
  critical_skills: CriticalSkill[];
  programmes: Programme[];
  priority_curriculum: PriorityCurriculum[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZQF_CONFIG = [
  { zqf: "1-2", label: "Skills Award", dur: "Short course" },
  { zqf: "3", label: "Certificate Level 3", dur: "1 year" },
  { zqf: "4", label: "Craft Certificate", dur: "2 years" },
  { zqf: "5", label: "Advanced Certificate", dur: "2.5 years" },
  { zqf: "6", label: "Diploma", dur: "3 years" },
];

const FILTER_ZQF_LEVELS = ["3", "4", "5", "6"];

const SECTION_IDS = ["sp-geo", "sp-programmes", "sp-demand", "sp-developing", "sp-consider"];
const SECTION_NAV_KEYS = [
  "knowledgeHub.navWhereJobs" as const,
  "knowledgeHub.navProgrammes" as const,
  "knowledgeHub.navCriticalSkills" as const,
  "knowledgeHub.navInDevelopment" as const,
  "knowledgeHub.navKeepInMind" as const,
];

// ─── Colours ──────────────────────────────────────────────────────────────────

const BLACK = "#1A1208";
const STONE = "#7D7469";
const SILVER = "#E1DFDD";
const CLOUD = "#F2F1F0";
const RUST = "#D44B1A";
const AMBER = "#E8A020";
const AMBER_LIGHT = "#fef6e4";
const WHITE = "#ffffff";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SectorProfileProps {
  staticData: SectorStaticData;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SectorProfile: React.FC<SectorProfileProps> = ({ staticData }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [data, setData] = useState<SectorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(0);
  const [zqfFilter, setZqfFilter] = useState<string>("all");

  // Refs for each section heading div, and the scrollable container
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const c = staticData.heroColor;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetch(`${getBackendUrl()}/teveta/sector/${staticData.sectorApiParam}`)
      .then((r) => r.json())
      .then((d: SectorData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [staticData.sectorApiParam]);

  // ── Scroll tracking ────────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const scrollPos = scrollTop + containerHeight / 3;
    const nearBottom = scrollTop + containerHeight >= container.scrollHeight - 50;

    if (nearBottom) {
      setActiveSection(SECTION_IDS.length - 1);
      return;
    }
    let idx = 0;
    sectionRefs.current.forEach((el, i) => {
      if (el && el.offsetTop <= scrollPos) idx = i;
    });
    setActiveSection(idx);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const criticalSkills = data?.critical_skills ?? [];
  const programmes = data?.programmes ?? [];
  const priorityCurriculum = data?.priority_curriculum ?? [];

  const filteredSkills =
    zqfFilter === "all" ? criticalSkills : criticalSkills.filter((s) => (s.zqf ?? "") === zqfFilter);

  const zqfCounts: Record<string, number> = {};
  criticalSkills.forEach((s) => {
    const z = s.zqf ?? "TBD";
    zqfCounts[z] = (zqfCounts[z] ?? 0) + 1;
  });

  const shortCourseCount = programmes.filter((p) => !p.zqf || p.zqf === "None").length;

  const ladderRows = ZQF_CONFIG.map((cfg) => {
    const levelProgs = programmes.filter((p) => p.zqf === cfg.zqf);
    if (levelProgs.length === 0) return null;
    const seen = new Set<string>();
    const uniqueNames: string[] = [];
    levelProgs.forEach((p) => {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        uniqueNames.push(p.name);
      }
    });
    uniqueNames.sort();
    return { ...cfg, names: uniqueNames };
  }).filter(Boolean) as ((typeof ZQF_CONFIG)[0] & { names: string[] })[];

  const devItems: string[] = [];
  const devSeen = new Set<string>();
  priorityCurriculum
    .filter((p) => p.status === "Develop")
    .forEach((p) => {
      if (p.occupation && !devSeen.has(p.occupation)) {
        devSeen.add(p.occupation);
        devItems.push(p.occupation);
      }
    });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    padding: "6px 14px",
    borderRadius: 999,
    border: `1.5px solid ${active ? RUST : SILVER}`,
    background: active ? RUST : WHITE,
    color: active ? WHITE : STONE,
    cursor: "pointer",
    transition: "all 0.15s ease",
  });

  const ladderLeftStyle = (rowIndex: number): React.CSSProperties => ({
    background: staticData.ladderColors[rowIndex] ?? staticData.heroColor,
    color: WHITE,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    width: 120,
    flexShrink: 0,
  });

  const considerBorderColor = (idx: number) => (idx % 2 === 0 ? c : RUST);

  const thStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: STONE,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "12px 14px 10px",
    textAlign: "left",
    borderBottom: `2px solid ${SILVER}`,
    background: WHITE,
    position: "sticky",
    top: 0,
    zIndex: 1,
  };

  const tdBase: React.CSSProperties = {
    padding: "9px 14px",
    borderBottom: `1px solid ${CLOUD}`,
    color: BLACK,
  };

  const countLabel =
    zqfFilter === "all"
      ? t("knowledgeHub.tableCountAll", { count: criticalSkills.length })
      : t("knowledgeHub.tableCountFiltered", { count: filteredSkills.length, level: zqfFilter });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Scrollable content (centred, matches ChatPage pattern) ── */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          // leave room for the absolute sidebar on md+ screens
          [theme.breakpoints.up("md")]: { paddingRight: "min(20rem, 25%)" },
        }}
      >
        <div
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            color: BLACK,
            padding: "24px 32px 48px",
            lineHeight: 1.5,
            boxSizing: "border-box",
          }}
        >
          {/* Loading skeleton */}
          {loading ? (
            <>
              <div
                style={{
                  background: c,
                  borderRadius: 16,
                  height: 180,
                  marginBottom: 32,
                  opacity: 0.3,
                }}
              />
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: CLOUD,
                    borderRadius: 14,
                    height: 120,
                    marginBottom: 20,
                    opacity: 0.5,
                  }}
                />
              ))}
            </>
          ) : (
            <>
              {/* ── Hero ── */}
              <div
                style={{
                  background: c,
                  borderRadius: 16,
                  padding: "36px 40px",
                  marginBottom: 32,
                  color: WHITE,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 32,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      opacity: 0.85,
                      marginBottom: 8,
                    }}
                  >
                    {t("knowledgeHub.prioritySector")}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                      fontSize: 40,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                      marginBottom: 10,
                    }}
                  >
                    {staticData.displayName}
                  </div>
                  <div style={{ fontSize: 15, opacity: 0.9, maxWidth: 540, lineHeight: 1.5 }}>
                    {staticData.heroText} <span style={{ color: WHITE }}>{staticData.heroHighlight}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "'Bricolage Grotesque', sans-serif",
                        fontSize: 32,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: WHITE,
                      }}
                    >
                      {staticData.avgEarnings}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.85,
                        marginTop: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        maxWidth: 150,
                      }}
                    >
                      {t("knowledgeHub.avgMonthlyEarnings")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "'Bricolage Grotesque', sans-serif",
                        fontSize: 32,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: WHITE,
                      }}
                    >
                      {criticalSkills.length > 0 ? criticalSkills.length : "—"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.85,
                        marginTop: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        maxWidth: 150,
                      }}
                    >
                      {t("knowledgeHub.criticalOccupations")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "'Bricolage Grotesque', sans-serif",
                        fontSize: 32,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: WHITE,
                      }}
                    >
                      {data ? data.programme_count : "—"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.85,
                        marginTop: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        maxWidth: 150,
                      }}
                    >
                      {t("knowledgeHub.tevetProgrammes")}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Where the jobs are ── */}
              <div
                id="sp-geo"
                style={{ marginBottom: 32 }}
                ref={(el) => {
                  sectionRefs.current[0] = el;
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 20,
                    fontWeight: 800,
                    color: BLACK,
                    marginBottom: 16,
                  }}
                >
                  {staticData.geoLabel}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div
                    style={{
                      background: WHITE,
                      border: `1px solid ${SILVER}`,
                      borderRadius: 14,
                      padding: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={`${process.env.PUBLIC_URL}/maps/${staticData.mapFile}`}
                      alt={staticData.mapAlt}
                      style={{ width: "100%", maxWidth: 380, height: "auto" }}
                    />
                  </div>
                  <div
                    style={{
                      background: WHITE,
                      border: `1px solid ${SILVER}`,
                      borderRadius: 14,
                      padding: "24px 28px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Bricolage Grotesque', sans-serif",
                        fontSize: 16,
                        fontWeight: 700,
                        color: BLACK,
                        marginBottom: 16,
                      }}
                    >
                      {t("knowledgeHub.keyEmployers")}
                    </div>
                    {staticData.employers.map((group, i) => (
                      <div key={i} style={{ marginBottom: i < staticData.employers.length - 1 ? 14 : 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: RUST,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: 4,
                          }}
                        >
                          {group.province}
                        </div>
                        <div style={{ fontSize: 14, color: BLACK, lineHeight: 1.6 }}>
                          {group.employers.map((emp, j) => (
                            <span key={j}>
                              {emp}
                              {j < group.employers.length - 1 && <br />}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── TEVET Programmes ── */}
              <div
                id="sp-programmes"
                style={{ marginBottom: 32 }}
                ref={(el) => {
                  sectionRefs.current[1] = el;
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 20,
                    fontWeight: 800,
                    color: BLACK,
                    marginBottom: 16,
                  }}
                >
                  {t("knowledgeHub.tevetAccreditedProgrammes", { sector: staticData.displayName })}
                </div>
                <p style={{ fontSize: 14, color: STONE, marginBottom: 14, marginTop: 0 }}>
                  {data
                    ? t("knowledgeHub.accreditedProgrammesCount", {
                        count: data.programme_count,
                        institutions: data.institution_count,
                        suffix: staticData.programmeSubtitleSuffix,
                      })
                    : t("knowledgeHub.loadingProgrammes")}
                </p>

                {ladderRows.length > 0 && (
                  <div style={{ border: `1px solid ${SILVER}`, borderRadius: 14, overflow: "hidden" }}>
                    {ladderRows.map((row, rowIdx) => (
                      <div
                        key={row.zqf}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "120px 1fr",
                          borderBottom: rowIdx < ladderRows.length - 1 ? `1px solid ${SILVER}` : "none",
                        }}
                      >
                        <div style={ladderLeftStyle(rowIdx)}>
                          <div
                            style={{
                              fontFamily: "'Bricolage Grotesque', sans-serif",
                              fontSize: 18,
                              fontWeight: 800,
                              lineHeight: 1,
                            }}
                          >
                            ZQF {row.zqf}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{row.dur}</div>
                        </div>
                        <div style={{ background: WHITE, padding: "14px 18px" }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: RUST,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              marginBottom: 6,
                            }}
                          >
                            {row.label} ({row.names.length} programmes)
                          </div>
                          <ul
                            style={{
                              listStyle: "none",
                              padding: 0,
                              margin: 0,
                              columnCount: 2,
                              columnGap: 16,
                            }}
                          >
                            {row.names.map((name) => (
                              <li
                                key={name}
                                style={{
                                  fontSize: 13,
                                  color: BLACK,
                                  lineHeight: 1.4,
                                  padding: "2px 0",
                                  breakInside: "avoid",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: 5,
                                    height: 5,
                                    borderRadius: "50%",
                                    background: c,
                                    flexShrink: 0,
                                  }}
                                />
                                {name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {shortCourseCount > 0 && (
                  <p style={{ marginTop: 12, fontSize: 14, color: BLACK, fontWeight: 500 }}>
                    {t("knowledgeHub.shortCoursesNote", { count: shortCourseCount })}
                  </p>
                )}
              </div>

              {/* ── Critical Skills ── */}
              <div
                id="sp-demand"
                style={{ marginBottom: 32 }}
                ref={(el) => {
                  sectionRefs.current[2] = el;
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 20,
                    fontWeight: 800,
                    color: BLACK,
                    marginBottom: 16,
                  }}
                >
                  {t("knowledgeHub.criticalSkillsLabel", { sector: staticData.displayName })}
                </div>

                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                  <button style={filterBtnStyle(zqfFilter === "all")} onClick={() => setZqfFilter("all")}>
                    {t("knowledgeHub.filterAll", { count: criticalSkills.length })}
                  </button>
                  {FILTER_ZQF_LEVELS.filter((z) => zqfCounts[z]).map((z) => (
                    <button key={z} style={filterBtnStyle(zqfFilter === z)} onClick={() => setZqfFilter(z)}>
                      {t("knowledgeHub.filterZqf", { level: z, count: zqfCounts[z] })}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    background: WHITE,
                    border: `1px solid ${SILVER}`,
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ maxHeight: 420, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>{t("knowledgeHub.tableOccupation")}</th>
                          <th style={thStyle}>{t("knowledgeHub.tableZqf")}</th>
                          <th style={thStyle}>{t("knowledgeHub.tableDuration")}</th>
                          <th style={{ ...thStyle, textAlign: "center" }}>{t("knowledgeHub.tableTevet")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSkills.map((skill, i) => (
                          <tr key={i}>
                            <td style={{ ...tdBase, fontWeight: 500 }}>{skill.occupation}</td>
                            <td
                              style={{
                                ...tdBase,
                                color: STONE,
                                fontFamily: "'Bricolage Grotesque', sans-serif",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {skill.zqf || "TBD"}
                            </td>
                            <td style={{ ...tdBase, color: STONE, whiteSpace: "nowrap" }}>{skill.duration || "TBD"}</td>
                            <td style={{ ...tdBase, textAlign: "center" }}>
                              {skill.matched_programmes && skill.matched_programmes.length > 0 ? (
                                <span style={{ color: c, fontSize: 22, fontWeight: 700 }}>✓</span>
                              ) : (
                                <span style={{ color: STONE, fontStyle: "italic", fontSize: 13 }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: STONE,
                      padding: "8px 14px",
                      borderTop: `1px solid ${CLOUD}`,
                      background: WHITE,
                    }}
                  >
                    {countLabel}
                  </div>
                </div>
              </div>

              {/* ── Programmes in development ── */}
              <div
                id="sp-developing"
                style={{ marginBottom: 32 }}
                ref={(el) => {
                  sectionRefs.current[3] = el;
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 20,
                    fontWeight: 800,
                    color: BLACK,
                    marginBottom: 16,
                  }}
                >
                  {t("knowledgeHub.newProgrammesDev")}
                </div>
                <p style={{ fontSize: 14, color: STONE, marginBottom: 10, marginTop: 0 }}>
                  {t("knowledgeHub.newProgrammesDevDesc")}
                </p>
                {devItems.length > 0 && (
                  <div
                    style={{
                      background: AMBER_LIGHT,
                      border: `1px solid ${AMBER}`,
                      borderRadius: 14,
                      padding: "18px 24px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#7a5200",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 8,
                      }}
                    >
                      {t("knowledgeHub.devOccupationsLabel")}
                    </div>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        columnCount: 3,
                        columnGap: 16,
                      }}
                    >
                      {devItems.map((item) => (
                        <li
                          key={item}
                          style={{
                            fontSize: 13,
                            color: BLACK,
                            lineHeight: 1.4,
                            padding: "2px 0",
                            breakInside: "avoid",
                          }}
                        >
                          <span style={{ color: "#7a5200", fontSize: 10 }}>◇ </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ── Things to keep in mind ── */}
              <div
                id="sp-consider"
                style={{ marginBottom: 32 }}
                ref={(el) => {
                  sectionRefs.current[4] = el;
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 20,
                    fontWeight: 800,
                    color: BLACK,
                    marginBottom: 16,
                  }}
                >
                  {t("knowledgeHub.keepInMind")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {staticData.considerations.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        borderLeft: `3px solid ${considerBorderColor(i)}`,
                        padding: "12px 16px",
                        background: WHITE,
                        borderRadius: "0 10px 10px 0",
                      }}
                    >
                      <h4
                        style={{
                          fontFamily: "'Bricolage Grotesque', sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                          color: BLACK,
                          margin: "0 0 4px",
                        }}
                      >
                        {item.title}
                      </h4>
                      <p style={{ fontSize: 13, color: STONE, lineHeight: 1.5, margin: 0 }}>{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Sources ── */}
              <div
                style={{
                  fontSize: 11,
                  color: STONE,
                  marginTop: 36,
                  paddingTop: 14,
                  borderTop: `1px solid ${SILVER}`,
                  lineHeight: 1.6,
                }}
              >
                {staticData.sources}
              </div>
            </>
          )}
        </div>
      </Box>

      {/* ── Absolute right sidebar (matches ChatPage pattern) ── */}
      <Box
        component="aside"
        aria-label="Page sections"
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: "100%",
          maxWidth: "min(20rem, 25%)",
          overflowY: "auto",
          flexDirection: "column",
          borderLeft: `1px solid ${theme.palette.divider}`,
          display: { xs: "none", md: "flex" },
          alignItems: "flex-start",
          justifyContent: "flex-start",
          padding: "32px 16px 0",
        }}
      >
        {!loading &&
          SECTION_IDS.map((id, i) => {
            const isPassed = i < activeSection;
            const isActive = i === activeSection;
            const isLast = i === SECTION_IDS.length - 1;
            return (
              <a
                key={id}
                href={`#${id}`}
                style={{ textDecoration: "none", width: "100%" }}
                onClick={(e) => {
                  e.preventDefault();
                  const el = sectionRefs.current[i];
                  const container = scrollContainerRef.current;
                  if (el && container) {
                    container.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 16 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: isActive || isPassed ? c : SILVER,
                      transform: isActive ? "scale(1.3)" : "scale(1)",
                      transition: "background 0.2s, transform 0.2s",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? c : isPassed ? BLACK : STONE,
                      whiteSpace: "nowrap",
                      transition: "color 0.2s",
                    }}
                  >
                    {t(SECTION_NAV_KEYS[i])}
                  </span>
                </div>
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      height: 32,
                      background: isPassed ? c : SILVER,
                      transition: "background 0.2s",
                      marginLeft: 5,
                    }}
                  />
                )}
              </a>
            );
          })}
      </Box>
    </Box>
  );
};

export default SectorProfile;
