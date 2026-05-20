import React, { startTransition, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, InputAdornment, TextField, Typography, useTheme } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getFaqDocument, type FaqSection } from "src/faq/faqDocumentLoader";
import HighlightedMarkdown from "src/faq/components/HighlightedMarkdown";
import FaqAccordionItem from "src/faq/components/FaqAccordionItem";
import FaqTableOfContents from "src/faq/components/FaqTableOfContents";
import FaqChecklist from "src/faq/components/FaqChecklist";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { routerPaths } from "src/app/routerPaths";
import BackLink from "src/navigation/BackLink/BackLink";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { getFaqTutorialVideoUrl } from "src/envService";

const uniqueId = "f6b1d3a8-9c47-4e5f-a2d1-7b9e8c4f2a13";

export const DATA_TEST_ID = {
  FAQ_PAGE_CONTAINER: `faq-page-container-${uniqueId}`,
  FAQ_PAGE_TITLE: `faq-page-title-${uniqueId}`,
  FAQ_PAGE_LEDE: `faq-page-lede-${uniqueId}`,
  FAQ_PAGE_SEARCH: `faq-page-search-${uniqueId}`,
  FAQ_PAGE_BACK_LINK: `faq-page-back-link-${uniqueId}`,
  FAQ_PAGE_TUTORIAL: `faq-page-tutorial-${uniqueId}`,
  FAQ_PAGE_SECTION: `faq-page-section-${uniqueId}`,
  FAQ_PAGE_NO_RESULTS: `faq-page-no-results-${uniqueId}`,
  FAQ_PAGE_PROGRESS_BAR: `faq-page-progress-bar-${uniqueId}`,
};

const containsQuery = (haystack: string, needle: string): boolean => haystack.toLowerCase().includes(needle);

const isChecklistSection = (section: FaqSection): boolean => section.isStatic && /checklist/i.test(section.title);

const FAQ_TUTORIAL_VIDEO_FALLBACK_URL =
  "https://player.vimeo.com/video/1193881841?h=8ee6f6190d&title=0&byline=0&portrait=0";

const FAQPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOnline = useContext(IsOnlineContext);
  const user = authenticationStateService.getInstance().getUser();

  const { title, sections } = useMemo(() => getFaqDocument(), []);

  const [searchInput, setSearchInput] = useState("");
  const normalizedQuery = searchInput.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tutorialUnavailable = !isOnline;

  useEffect(() => {
    if (!tutorialUnavailable) return;

    // Pause playback when we go offline.
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ method: "pause" }), "https://player.vimeo.com");
  }, [tutorialUnavailable]);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(sections.length > 0 ? sections[0].id : null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Track scroll progress (0..1) across the document.
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const totalScrollable = Math.max(docHeight - winHeight, 1);
      const ratio = Math.max(0, Math.min(1, scrollTop / totalScrollable));
      setScrollProgress(ratio);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Track which section is currently in view to highlight the matching TOC entry.
  useEffect(() => {
    const observed = Object.values(sectionRefs.current).filter(Boolean) as HTMLElement[];
    if (observed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);
        if (visible.length > 0) {
          setActiveSectionId((visible[0].target as HTMLElement).id);
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    observed.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const filteredSections = useMemo<FaqSection[]>(() => {
    if (!isSearching) return sections;
    return sections
      .map((section) => {
        if (section.isStatic) {
          // Keep static sections
          const haystack = `${section.title}\n${section.staticMarkdown ?? ""}`;
          return containsQuery(haystack, normalizedQuery) ? section : null;
        }
        const items = section.items.filter((item) =>
          containsQuery(`${item.question}\n${item.answerMarkdown}`, normalizedQuery)
        );
        return items.length > 0 ? { ...section, items } : null;
      })
      .filter((s): s is FaqSection => s !== null);
  }, [sections, normalizedQuery, isSearching]);

  const totalMatches = useMemo(() => {
    if (!isSearching) return 0;
    return filteredSections.reduce((acc, section) => acc + (section.isStatic ? 1 : section.items.length), 0);
  }, [filteredSections, isSearching]);

  const noResults = isSearching && totalMatches === 0;

  return (
    <Box
      component="main"
      data-testid={DATA_TEST_ID.FAQ_PAGE_CONTAINER}
      sx={{
        minHeight: "100vh",
        backgroundColor: theme.palette.containerBackground.main,
      }}
    >
      <Box
        component="header"
        sx={{
          backgroundColor: theme.palette.common.white,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            maxWidth: "var(--layout-content-max-width)",
            margin: "0 auto",
            padding: { xs: "28px 16px 28px", md: "36px 32px 36px" },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: theme.fixedSpacing(theme.tabiyaSpacing.xl),
            alignItems: "flex-start",
          }}
        >
          <Box sx={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <BackLink
              label={user ? t("home.backToDashboard") : t("common.buttons.goBack")}
              isOnline={isOnline}
              onClick={() => {
                startTransition(() => {
                  navigate(routerPaths.ROOT);
                });
              }}
              dataTestId={DATA_TEST_ID.FAQ_PAGE_BACK_LINK}
              color={theme.palette.brandAction.main}
              sx={{
                marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.xl),
                opacity: isOnline ? 1 : 0.5,
              }}
            />
            <Typography
              variant="h1"
              data-testid={DATA_TEST_ID.FAQ_PAGE_TITLE}
              sx={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: theme.palette.common.black,
                marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
              }}
            >
              {title}
            </Typography>
            <Typography
              data-testid={DATA_TEST_ID.FAQ_PAGE_LEDE}
              sx={{
                fontSize: "1.0625rem",
                lineHeight: 1.5,
                color: theme.palette.text.secondary,
                maxWidth: "640px",
              }}
            >
              {t("faq.lede")}
            </Typography>
            <Box sx={{ maxWidth: 480, marginTop: theme.fixedSpacing(theme.tabiyaSpacing.xl) }}>
              <TextField
                fullWidth
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("faq.searchPlaceholder")}
                inputProps={{ "aria-label": t("faq.searchAriaLabel") }}
                data-testid={DATA_TEST_ID.FAQ_PAGE_SEARCH}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchInput ? (
                    <InputAdornment position="end">
                      <PrimaryIconButton
                        onClick={() => setSearchInput("")}
                        title={t("faq.clearSearch")}
                        aria-label={t("faq.clearSearch")}
                      >
                        <CloseIcon />
                      </PrimaryIconButton>
                    </InputAdornment>
                  ) : null,
                  sx: {
                    fontSize: "0.9375rem",
                    backgroundColor: theme.palette.common.white,
                    borderRadius: "10px",
                  },
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: theme.palette.primary.main },
                    "&:hover fieldset": { borderColor: theme.palette.primary.main },
                    "&.Mui-focused fieldset": { borderColor: theme.palette.primary.main },
                  },
                }}
              />
            </Box>
          </Box>

          <Box
            data-testid={DATA_TEST_ID.FAQ_PAGE_TUTORIAL}
            sx={{
              flex: "1 1 0",
              minWidth: 0,
              width: { xs: "100%", md: "auto" },
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <Typography
              component="p"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: theme.palette.brandAction.main,
                marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              }}
            >
              {t("faq.tutorialEyebrow")}
            </Typography>
            <Typography
              component="h2"
              sx={{
                fontFamily: theme.typography.fontFamily,
                fontSize: { xs: "1.25rem", md: "1.375rem" },
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                color: theme.palette.common.black,
                marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
              }}
            >
              {t("faq.tutorialHeading")}
            </Typography>
            <Box
              sx={{
                position: "relative",
                width: { xs: "100%", sm: "80%", md: "100%" },
                alignSelf: { xs: "center", sm: "start", md: "stretch" },
                aspectRatio: "16 / 9",
                borderRadius: "10px",
                overflow: "hidden",
                boxSizing: "border-box",
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.containerBackground.main,
              }}
            >
              <Box
                component="iframe"
                ref={iframeRef}
                src={getFaqTutorialVideoUrl() || FAQ_TUTORIAL_VIDEO_FALLBACK_URL}
                title={t("faq.tutorialIframeTitle")}
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
              {tutorialUnavailable && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.70)",
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      color: theme.palette.common.white,
                      textAlign: "center",
                      padding: theme.fixedSpacing(theme.tabiyaSpacing.md),
                    }}
                  >
                    {t("faq.tutorialUnavailableOffline")}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Scroll progress bar */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: theme.zIndex.appBar,
          height: "4px",
          backgroundColor: theme.palette.containerBackground.main,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            backgroundColor: theme.palette.divider,
            opacity: 0.45,
          }}
        />
        <Box
          role="progressbar"
          aria-valuenow={Math.round(scrollProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("faq.scrollProgressLabel")}
          data-testid={DATA_TEST_ID.FAQ_PAGE_PROGRESS_BAR}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `max(80px, ${scrollProgress * 100}%)`,
            backgroundColor: theme.palette.brandAction.main,
            borderRadius: "0 2px 2px 0",
            transition: "width 80ms linear",
          }}
        />
      </Box>

      <Box
        sx={{
          maxWidth: "var(--layout-content-max-width)",
          margin: "0 auto",
          padding: { xs: "32px 16px 64px", md: "48px 32px 96px" },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "240px 1fr" },
          gap: { xs: 4, md: 7 },
          alignItems: "start",
        }}
      >
        <FaqTableOfContents sections={sections} activeSectionId={activeSectionId} onLinkClick={setActiveSectionId} />

        <Box sx={{ minWidth: 0, maxWidth: "880px" }}>
          {noResults && (
            <Box
              data-testid={DATA_TEST_ID.FAQ_PAGE_NO_RESULTS}
              sx={{
                padding: "24px 0",
                color: theme.palette.text.secondary,
                fontSize: "0.875rem",
                borderTop: `1px solid ${theme.palette.divider}`,
              }}
            >
              {t("faq.noResults")}
            </Box>
          )}

          {filteredSections.map((section) => (
            <Box
              key={section.id}
              id={section.id}
              ref={(el: HTMLElement | null) => {
                sectionRefs.current[section.id] = el;
              }}
              component="section"
              data-testid={DATA_TEST_ID.FAQ_PAGE_SECTION}
              sx={{ marginBottom: "64px", scrollMarginTop: "24px" }}
            >
              <Typography
                component="h2"
                sx={{
                  fontFamily: theme.typography.h4.fontFamily,
                  fontSize: { xs: "1.375rem", md: "1.5rem" },
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                  color: theme.palette.common.black,
                  paddingBottom: "16px",
                  borderBottom: `2px solid ${theme.palette.divider}`,
                  marginBottom: "16px",
                }}
              >
                <Box component="span" sx={{ color: theme.palette.brandAction.main, marginRight: "6px" }}>
                  {section.number}.
                </Box>
                {section.title}
              </Typography>

              {section.isStatic ? (
                isChecklistSection(section) ? (
                  <FaqChecklist markdown={section.staticMarkdown ?? ""} query={normalizedQuery} />
                ) : (
                  <Box sx={{ paddingTop: 1 }}>
                    <HighlightedMarkdown content={section.staticMarkdown ?? ""} query={normalizedQuery} />
                  </Box>
                )
              ) : (
                <Box>
                  {section.items.map((item) => (
                    <FaqAccordionItem key={item.id} item={item} query={normalizedQuery} forceOpen={isSearching} />
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default FAQPage;
