import { getBackendUrl } from "src/envService";
import { customFetch } from "src/utils/customFetch/customFetch";
import { Experience } from "src/experiences/experienceService/experiences.types";

export interface PublicReportData {
    user_id: string;
    experiences: Experience[];
    conversation_conducted_at: string | null;
}

export class PublicReportService {
    private static instance: PublicReportService;
    private readonly baseUrl: string;

    private constructor() {
        this.baseUrl = `${getBackendUrl()}/reports`;
    }

    public static getInstance(): PublicReportService {
        if (!PublicReportService.instance) {
            PublicReportService.instance = new PublicReportService();
        }
        return PublicReportService.instance;
    }

    public async getPublicReport(userId: string): Promise<PublicReportData> {
        const response = await customFetch(`${this.baseUrl}/${userId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            authRequired: false, // This is a public endpoint
            expectedStatusCode: 200,
            serviceName: "PublicReportService",
            serviceFunction: "getPublicReport",
            failureMessage: `Failed to fetch public report for user ${userId}`,
            expectedContentType: "application/json",
        });

        return (await response.json()) as PublicReportData;
    }
}
