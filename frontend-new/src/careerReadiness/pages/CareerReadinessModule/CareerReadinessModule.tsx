import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { routerPaths } from "src/app/routerPaths";
import CareerReadinessChat from "src/careerReadiness/components/CareerReadinessAgentMessage/CareerReadinessChat/CareerReadinessChat";
import CareerReadinessService from "src/careerReadiness/services/CareerReadinessService";
import type { ModuleDetail, ModuleSummary } from "src/careerReadiness/types";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import ModuleHandoffBanner from "src/home/components/ModuleHandoffBanner/ModuleHandoffBanner";
import { useNextModule } from "src/home/useNextModule";
import SubNavBar from "src/navigation/SubNavBar/SubNavBar";

const uniqueId = "e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b";

export const DATA_TEST_ID = {
  CAREER_READINESS_MODULE_CONTAINER: `career-readiness-module-container-${uniqueId}`,
};

const CareerReadinessModule: React.FC = () => {
  const navigate = useNavigate();
  const { moduleId } = useParams<{ moduleId: string }>();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [moduleDetail, setModuleDetail] = useState<ModuleDetail | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [moduleCompleted, setModuleCompleted] = useState(false);
  const [siblingModules, setSiblingModules] = useState<ModuleSummary[]>([]);
  const topLevelNextModule = useNextModule("job_readiness");

  const sortedSiblings = useMemo(
    () => [...siblingModules].sort((a, b) => a.sort_order - b.sort_order),
    [siblingModules]
  );

  const moduleNumber = useMemo(() => {
    if (!moduleDetail) return 0;
    const idx = sortedSiblings.findIndex((m) => m.id === moduleDetail.id);
    return idx >= 0 ? idx + 1 : moduleDetail.sort_order;
  }, [sortedSiblings, moduleDetail]);

  const nextCRModule = useMemo(() => {
    if (!moduleDetail) return null;
    return sortedSiblings.find((m) => m.sort_order > moduleDetail.sort_order) ?? null;
  }, [sortedSiblings, moduleDetail]);

  const handleModuleCompleted = useCallback(() => {
    enqueueSnackbar(t("careerReadiness.moduleComplete"), { variant: "success" });
    setModuleCompleted(true);
  }, [t, enqueueSnackbar]);

  const loadModuleAndConversation = useCallback(async () => {
    if (!moduleId) {
      navigate(routerPaths.CAREER_READINESS);
      return;
    }
    setConversationId(null);
    setModuleCompleted(false);
    const service = CareerReadinessService.getInstance();
    try {
      const [fetchedModule, moduleList] = await Promise.all([service.getModule(moduleId), service.listModules()]);
      setModuleDetail(fetchedModule);
      setSiblingModules(moduleList.modules);
      try {
        const existingId = fetchedModule.active_conversation_id;
        if (existingId) {
          setConversationId(existingId);
        } else {
          const res = await service.createConversation(fetchedModule.id);
          setConversationId(res.conversation_id);
        }
      } catch (convError) {
        console.error("Failed to start conversation");
      }
    } catch (e) {
      if (e instanceof RestAPIError && e.statusCode === StatusCodes.NOT_FOUND) {
        enqueueSnackbar(t("careerReadiness.moduleNotFound"), { variant: "warning" });
      } else {
        enqueueSnackbar((e as Error)?.message ?? t("careerReadiness.listError"), { variant: "error" });
      }
      navigate(routerPaths.CAREER_READINESS);
    }
  }, [moduleId, t, enqueueSnackbar, navigate]);

  useEffect(() => {
    void loadModuleAndConversation();
  }, [loadModuleAndConversation]);

  const subNavTitle = moduleDetail ? t("careerReadiness.subNavTitle", { number: moduleNumber }) : "";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      data-testid={DATA_TEST_ID.CAREER_READINESS_MODULE_CONTAINER}
    >
      {moduleDetail && (
        <Box sx={{ flexShrink: 0 }}>
          <SubNavBar
            title={subNavTitle}
            subtitle={moduleDetail.title}
            headerColor="secondary"
            labelAbove
            backLabelKey="careerReadiness.backToModules"
            backTo={routerPaths.CAREER_READINESS}
          />
        </Box>
      )}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {moduleId && (
          <CareerReadinessChat
            moduleId={moduleId}
            moduleTitle={moduleDetail?.title ?? ""}
            initialConversationId={conversationId}
            inputPlaceholder={moduleDetail?.input_placeholder ?? ""}
            onModuleCompleted={handleModuleCompleted}
          />
        )}
        {moduleCompleted && nextCRModule && (
          <ModuleHandoffBanner
            nextModuleLabel={nextCRModule.title}
            nextModuleRoute={`${routerPaths.CAREER_READINESS}/${nextCRModule.id}`}
          />
        )}
        {moduleCompleted && !nextCRModule && topLevelNextModule && (
          <ModuleHandoffBanner
            nextModuleLabel={t(topLevelNextModule.labelKey as any)}
            nextModuleRoute={topLevelNextModule.route}
          />
        )}
      </Box>
    </Box>
  );
};

export default CareerReadinessModule;
