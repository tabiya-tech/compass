// mock the console logs
import "src/_test_utilities/consoleMock";

import { renderHook, waitFor } from "@testing-library/react";
import AnalyticsService from "src/analytics/AnalyticsService";
import type { JobDemandStatsResponse } from "src/analytics/AnalyticsService.types";
import { useJobDemandStats } from "src/hooks/useJobDemandStats";

const SAMPLE: JobDemandStatsResponse = {
  total_jobs: 12,
  jobs_with_linked_skills: 9,
  top_skills_in_demand: [
    { skill_label: "Python", jobs_count: 5 },
    { skill_label: "SQL", jobs_count: 3 },
  ],
};

describe("useJobDemandStats", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns data and clears loading on success, forwarding limit + location + sector", async () => {
    // GIVEN the service resolves with stats
    const spy = jest.spyOn(AnalyticsService.getInstance(), "getJobDemandStats").mockResolvedValue(SAMPLE);

    // WHEN the hook is rendered with a limit, province and sector
    const { result } = renderHook(() => useJobDemandStats(10, "Lusaka", "ICT"));

    // THEN it starts loading, then resolves with the data and no error
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(SAMPLE);
    expect(result.current.error).toBeNull();
    // AND the limit, province and sector are forwarded to the service
    expect(spy).toHaveBeenCalledWith(10, "Lusaka", "ICT");
  });

  test("surfaces an Error and leaves data null on failure", async () => {
    // GIVEN the service rejects
    jest.spyOn(AnalyticsService.getInstance(), "getJobDemandStats").mockRejectedValue(new Error("boom"));

    // WHEN the hook is rendered
    const { result } = renderHook(() => useJobDemandStats());

    // THEN loading clears, error is set, data stays null
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeNull();
  });
});
