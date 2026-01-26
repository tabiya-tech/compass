import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  TextField,
  Typography,
  LinearProgress,
  Alert,
  Paper,
  Stack,
  useTheme,
  AlertTitle,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import WarningIcon from "@mui/icons-material/Warning";
import JSZip from "jszip";
import { pdf } from "@react-pdf/renderer";
import { BulkDownloadReportsService, BulkReportData } from "./bulkDownloadReportsService";
import SkillReportPDF from "./reportPdf/SkillReportPDF";
import SkillReportDocx from "./reportDocx/SkillReportDocx";
import { saveAs } from "src/experiences/saveAs";
import { globalAssetPreloader } from "./assetPreloader";
import { setGlobalAssetCache } from "./util";
import ErrorPage from "src/error/errorPage/ErrorPage";
import LanguageContextMenu from "src/i18n/languageContextMenu/LanguageContextMenu";

type DownloadStatus = "idle" | "preloading" | "streaming" | "generating" | "zipping" | "complete" | "error";

interface DownloadProgress {
  total: number;
  processed: number;
  status: DownloadStatus;
  errorMessage?: string;
}

type FileFormat = "pdf" | "docx" | "both";

const BulkDownloadReportPage: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const { t } = useTranslation();

  const searchParams = new URLSearchParams(location.search);
  const urlToken = searchParams.get("token") || "";
  const [startedBefore, setStartedBefore] = useState<string>("");
  const [startedAfter, setStartedAfter] = useState<string>("");
  const [fileFormat, setFileFormat] = useState<FileFormat>("both");
  const [progress, setProgress] = useState<DownloadProgress>({
    total: 0,
    processed: 0,
    status: "idle",
  });

  const handleDownload = async () => {
    try {
      // Step 1: Preload all assets once
      setProgress({
        total: 0,
        processed: 0,
        status: "preloading",
      });

      await globalAssetPreloader.preloadAllAssets();

      // Set the global cache so all getBase64Image calls use preloaded assets
      setGlobalAssetCache(globalAssetPreloader.getCache());

      console.log(`Preloaded ${globalAssetPreloader.cacheSize} assets for bulk download`);

      // Step 2: Start streaming and processing
      setProgress({
        total: 0,
        processed: 0,
        status: "streaming",
      });

      const zip = new JSZip();
      let totalReports = 0;
      let processedReports = 0;
      // Helper function to process a batch of reports in parallel
      const processBatch = async (batch: BulkReportData[]) => {
        const batchPromises = batch.map(async (report) => {
          const fileBaseName = report.registration_code || report.user_id;

          const filePromises = [];

          // Generate PDF
          if (fileFormat === "pdf" || fileFormat === "both") {
            const pdfPromise = (async () => {
              try {
                const pdfDoc = (
                  <SkillReportPDF
                    name=""
                    email=""
                    phone=""
                    address=""
                    experiences={report.experiences}
                    conversationConductedAt={report.conversation_conducted_at}
                  />
                );
                const pdfBlob = await pdf(pdfDoc).toBlob();
                zip.file(`${fileBaseName}.pdf`, pdfBlob);
              } catch (error) {
                console.error(`Error generating PDF for ${fileBaseName}:`, error);
              }
            })();
            filePromises.push(pdfPromise);
          }

          // Generate DOCX
          if (fileFormat === "docx" || fileFormat === "both") {
            const docxPromise = (async () => {
              try {
                const docxBlob = await SkillReportDocx({
                  name: "",
                  email: "",
                  phone: "",
                  address: "",
                  experiences: report.experiences,
                  conversationConductedAt: report.conversation_conducted_at,
                });
                zip.file(`${fileBaseName}.docx`, docxBlob);
              } catch (error) {
                console.error(`Error generating DOCX for ${fileBaseName}:`, error);
              }
            })();
            filePromises.push(docxPromise);
          }

          // Wait for both PDF and DOCX to complete for this report
          await Promise.all(filePromises);

          // Update progress
          processedReports++;
          setProgress((prev) => ({
            ...prev,
            total: totalReports,
            processed: processedReports,
            status: "generating",
          }));
        });

        // Wait for all reports in this batch to be processed
        await Promise.all(batchPromises);
      };

      // Stream and process reports in parallel
      const service = BulkDownloadReportsService.getInstance();
      await service.streamReports(
        urlToken.trim(),
        {
          started_before: startedBefore ? new Date(startedBefore).toISOString() : undefined,
          started_after: startedAfter ? new Date(startedAfter).toISOString() : undefined,
          page_size: 20,
        },
        async (batch) => {
          // Process this batch immediately as it arrives
          totalReports += batch.length;
          setProgress((prev) => ({
            ...prev,
            total: totalReports,
            processed: processedReports,
            status: "generating",
          }));
          await processBatch(batch);
        },
        (count) => {
          // Update total count as batches arrive
          totalReports = count;
          setProgress((prev) => ({
            ...prev,
            total: totalReports,
            processed: processedReports,
            status: processedReports > 0 ? "generating" : "streaming",
          }));
        }
      );

      if (totalReports === 0) {
        setProgress({
          total: 0,
          processed: 0,
          status: "error",
          errorMessage: t("experiences.report.bulkDownload.errors.noReports"),
        });
        return;
      }

      // Step 3: Create and download zip file
      setProgress({
        total: totalReports,
        processed: processedReports,
        status: "zipping",
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const timestamp = new Date().toISOString().split("T")[0];
      saveAs(zipBlob, `brujula-reports-${timestamp}.zip`);

      setProgress({
        total: totalReports,
        processed: processedReports,
        status: "complete",
      });
    } catch (error) {
      console.error("Error downloading reports:", error);
      setProgress({
        total: 0,
        processed: 0,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      // Always clear the global cache when done
      setGlobalAssetCache(null);
    }
  };

  const getProgressPercentage = () => {
    if (progress.total === 0) return 0;
    return (progress.processed / progress.total) * 100;
  };

  const getStatusMessage = () => {
    switch (progress.status) {
      case "idle":
        return "";
      case "preloading":
        return t("experiences.report.bulkDownload.status.preloading");
      case "streaming":
        return t("experiences.report.bulkDownload.status.streaming", { count: progress.total });
      case "generating":
        return t("experiences.report.bulkDownload.status.generating", {
          processed: progress.processed,
          total: progress.total,
        });
      case "zipping":
        return t("experiences.report.bulkDownload.status.zipping");
      case "complete":
        return t("experiences.report.bulkDownload.status.complete", { count: progress.total });
      case "error":
        return t("experiences.report.bulkDownload.status.error", { message: progress.errorMessage });
      default:
        return "";
    }
  };

  const isDownloading =
    progress.status === "preloading" ||
    progress.status === "streaming" ||
    progress.status === "generating" ||
    progress.status === "zipping";

  if (!urlToken) {
    return <ErrorPage errorMessage={t("experiences.report.bulkDownload.errors.unAuthorizedAccess")} />;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 600,
          width: "100%",
          padding: (sx) => sx.spacing(4),
          position: "relative",
        }}
      >
        {/* Language Selector in top-right corner */}
        <Box sx={{ position: "absolute", top: (sx) => sx.fixedSpacing(2), right: (sx) => sx.fixedSpacing(2) }}>
          <LanguageContextMenu removeMargin />
        </Box>

        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          align="center"
          sx={{ fontWeight: 600, mb: theme.spacing(3) }}
        >
          {t("experiences.report.bulkDownload.title")}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: theme.spacing(3) }}>
          {t("experiences.report.bulkDownload.description")}
        </Typography>

        {/* Security Warning about token in URL */}
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: theme.spacing(2) }}>
          <AlertTitle>{t("experiences.report.bulkDownload.security.warning.title")}</AlertTitle>
          {t("experiences.report.bulkDownload.security.warning.message")}
        </Alert>

        <Stack spacing={3} gap={2}>
          {/* Date Filters */}
          <TextField
            label={t("experiences.report.bulkDownload.dateFilters.startedAfter.label")}
            type="datetime-local"
            value={startedAfter}
            onChange={(e) => setStartedAfter(e.target.value)}
            fullWidth
            disabled={isDownloading}
            InputLabelProps={{ shrink: true }}
            helperText={t("experiences.report.bulkDownload.dateFilters.startedAfter.helperText")}
          />

          <TextField
            label={t("experiences.report.bulkDownload.dateFilters.startedBefore.label")}
            type="datetime-local"
            value={startedBefore}
            onChange={(e) => setStartedBefore(e.target.value)}
            fullWidth
            disabled={isDownloading}
            InputLabelProps={{ shrink: true }}
            helperText={t("experiences.report.bulkDownload.dateFilters.startedBefore.helperText")}
          />

          {/* File Format Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("experiences.report.bulkDownload.fileFormat.label")}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant={fileFormat === "pdf" ? "contained" : "outlined"}
                onClick={() => setFileFormat("pdf")}
                disabled={isDownloading}
                size="small"
              >
                {t("experiences.report.bulkDownload.fileFormat.pdfOnly")}
              </Button>
              <Button
                variant={fileFormat === "docx" ? "contained" : "outlined"}
                onClick={() => setFileFormat("docx")}
                disabled={isDownloading}
                size="small"
              >
                {t("experiences.report.bulkDownload.fileFormat.docxOnly")}
              </Button>
              <Button
                variant={fileFormat === "both" ? "contained" : "outlined"}
                onClick={() => setFileFormat("both")}
                disabled={isDownloading}
                size="small"
              >
                {t("experiences.report.bulkDownload.fileFormat.both")}
              </Button>
            </Stack>
          </Box>

          {/* Download Button */}
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={isDownloading}
            fullWidth
          >
            {isDownloading
              ? t("experiences.report.bulkDownload.buttons.downloading")
              : t("experiences.report.bulkDownload.buttons.download")}
          </Button>

          {/* Progress */}
          {progress.status !== "idle" && (
            <Box>
              {isDownloading && <LinearProgress variant="determinate" value={getProgressPercentage()} sx={{ mb: 1 }} />}
              <Alert
                severity={progress.status === "error" ? "error" : progress.status === "complete" ? "success" : "info"}
              >
                {getStatusMessage()}
              </Alert>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default BulkDownloadReportPage;
