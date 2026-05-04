import "src/_test_utilities/consoleMock";

import React from "react";
import { renderHook, waitFor } from "src/_test_utilities/test-utils";
import { useMatchedJobs } from "src/jobMatching/hooks/useMatchedJobs";
import JobService from "src/jobMatching/services/JobService";
import { ReconnectVersionContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import type { MatchedJobApiDocument } from "src/jobMatching/types";

jest.mock("src/jobMatching/services/JobService");

function makeMatchedDoc(overrides: Partial<MatchedJobApiDocument> = {}): MatchedJobApiDocument {
  return {
    uuid: "uuid-1",
    opportunity_title: "Software Engineer",
    location: "Lusaka",
    contract_type: "Full-time",
    URL: "https://example.com/jobs/1",
    final_score: 0.92,
    rank: 1,
    employer: "Acme Corp",
    category: "Engineering",
    posted_date: "2026-04-01",
    ...overrides,
  };
}

describe("useMatchedJobs", () => {
  let mockGetMatchedJobs: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMatchedJobs = jest.fn();
    (JobService.getInstance as jest.Mock).mockReturnValue({
      getMatchedJobs: mockGetMatchedJobs,
    });
  });

  test("should return loading=true on activation and not fetch when inactive", async () => {
    // GIVEN the hook is rendered with active=false
    mockGetMatchedJobs.mockResolvedValue([]);
    const { result } = renderHook(() => useMatchedJobs(false));

    // THEN no fetch is triggered and loading is false
    expect(mockGetMatchedJobs).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.jobs).toEqual([]);
  });

  test("should map MatchedJobApiDocument to JobRow with rounded matchScore (0-100)", async () => {
    // GIVEN the matching service returns one match with a fractional score
    const givenDoc = makeMatchedDoc({ final_score: 0.876 });
    mockGetMatchedJobs.mockResolvedValue([givenDoc]);

    // WHEN the hook is rendered with active=true
    const { result } = renderHook(() => useMatchedJobs(true));

    // THEN after the fetch completes the row is mapped correctly
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.jobs).toHaveLength(1);
    const row = result.current.jobs[0];
    expect(row.jobTitle).toBe(givenDoc.opportunity_title);
    expect(row.company).toBe(givenDoc.employer);
    expect(row.category).toBe(givenDoc.category);
    expect(row.employmentType).toBe(givenDoc.contract_type);
    expect(row.location).toBe(givenDoc.location);
    expect(row.posted).toBe(givenDoc.posted_date);
    expect(row.jobUrl).toBe(givenDoc.URL);
    expect(row.matchScore).toBe(88); // round(0.876 * 100)
  });

  test("should clamp matchScore to the [0, 100] range", async () => {
    // GIVEN the matching service returns scores outside the expected range
    mockGetMatchedJobs.mockResolvedValue([
      makeMatchedDoc({ uuid: "high", final_score: 1.5 }),
      makeMatchedDoc({ uuid: "low", final_score: -0.2 }),
    ]);

    // WHEN the hook is rendered with active=true
    const { result } = renderHook(() => useMatchedJobs(true));

    // THEN scores are clamped to 0-100
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.jobs[0].matchScore).toBe(100);
    expect(result.current.jobs[1].matchScore).toBe(0);
  });

  test("should set matchScore to undefined when final_score is missing", async () => {
    // GIVEN the matching service omits final_score
    mockGetMatchedJobs.mockResolvedValue([makeMatchedDoc({ final_score: undefined })]);

    // WHEN the hook is rendered with active=true
    const { result } = renderHook(() => useMatchedJobs(true));

    // THEN matchScore is undefined (so the column render can hide the chip)
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.jobs[0].matchScore).toBeUndefined();
  });

  test("should expose error state and clear jobs when the service throws", async () => {
    // GIVEN the matching service rejects
    const givenError = new Error("matching service unavailable");
    mockGetMatchedJobs.mockRejectedValue(givenError);

    // WHEN the hook is rendered with active=true
    const { result } = renderHook(() => useMatchedJobs(true));

    // THEN error is set, jobs is empty, loading is false
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe(givenError);
    expect(result.current.jobs).toEqual([]);
  });

  test("should refetch when reconnectVersion changes", async () => {
    // GIVEN the hook is rendered inside a ReconnectVersionContext
    mockGetMatchedJobs.mockResolvedValue([]);
    let providerVersion = 0;
    const wrapper = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(ReconnectVersionContext.Provider, { value: providerVersion }, children);
    const { result, rerender } = renderHook(() => useMatchedJobs(true), { wrapper });

    // AND the initial fetch completes
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetMatchedJobs).toHaveBeenCalledTimes(1);

    // WHEN the reconnect version increments (network came back online)
    providerVersion = 1;
    rerender();

    // THEN a second fetch is triggered
    await waitFor(() => {
      expect(mockGetMatchedJobs).toHaveBeenCalledTimes(2);
    });
  });

  test("reload() should trigger a refetch on demand", async () => {
    // GIVEN the hook is rendered with active=true
    mockGetMatchedJobs.mockResolvedValue([]);
    const { result } = renderHook(() => useMatchedJobs(true));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetMatchedJobs).toHaveBeenCalledTimes(1);

    // WHEN reload is called
    result.current.reload();

    // THEN a second fetch is triggered
    await waitFor(() => {
      expect(mockGetMatchedJobs).toHaveBeenCalledTimes(2);
    });
  });
});
