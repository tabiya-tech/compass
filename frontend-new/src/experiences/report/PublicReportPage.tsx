import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { PublicReportData, PublicReportService } from "./publicReportService";
import SkillReportPDF from "./reportPdf/SkillReportPDF";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import ErrorPage from "src/error/errorPage/ErrorPage";
import { useTranslation } from "react-i18next";

const PublicReportPage: React.FC = () => {
    const { userid } = useParams<{ userid: string }>();
    const location = useLocation();
    const [reportData, setReportData] = useState<PublicReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    useEffect(() => {
        if (userid) {
            const searchParams = new URLSearchParams(location.search);
            const token = searchParams.get("token");

            PublicReportService.getInstance()
                .getPublicReport(userid, token)
                .then((data) => {
                    setReportData(data);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error(err);
                    setError(t("error.errorPage.defaultMessage"));
                    setLoading(false);
                });
        }
    }, [userid, location.search, t]);

    if (loading) return <Backdrop isShown={loading} transparent={true} />;

    if (error || !reportData) {
        return <ErrorPage errorMessage={error || t("error.errorPage.notFound")} />;
    }

    return (
        <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}>
            <div style={{
                padding: "1rem 2rem",
                backgroundColor: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                zIndex: 10
            }}>
                <h1 style={{ margin: 0, fontSize: "1.25rem", color: "#333", fontWeight: 600 }}>
                    {t("experiences.report.skillsReportTitle") || "CV Report"}
                </h1>
                <PDFDownloadLink
                    document={
                        <SkillReportPDF
                            name=""
                            email=""
                            phone=""
                            address=""
                            experiences={reportData.experiences}
                            conversationConductedAt={reportData.conversation_conducted_at}
                        />
                    }
                    fileName={`cv-report-${userid}.pdf`}
                    style={{
                        textDecoration: "none",
                        padding: "8px 16px",
                        color: "#fff",
                        backgroundColor: "#007bff",
                        borderRadius: "4px",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        transition: "background-color 0.2s"
                    }}
                >
                    {t("common.buttons.download")}
                </PDFDownloadLink>
            </div>
            <div style={{ flex: 1, backgroundColor: "#525659", padding: "20px", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: "1000px", height: "100%", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", borderRadius: "4px", overflow: "hidden" }}>
                    <PDFViewer style={{ width: "100%", height: "100%", border: "none" }}>
                        <SkillReportPDF
                            name=""
                            email=""
                            phone=""
                            address=""
                            experiences={reportData.experiences}
                            conversationConductedAt={reportData.conversation_conducted_at}
                        />
                    </PDFViewer>
                </div>
            </div>
        </div>
    );
};

export default PublicReportPage;
