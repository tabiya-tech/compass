import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import React from "react";
import userEvent from "@testing-library/user-event";
import { useNavigate } from "react-router-dom";
import { render, screen, within } from "src/_test_utilities/test-utils";
import CareerReadinessProgressBanner, { DATA_TEST_ID } from "./CareerReadinessProgressBanner";
import { routerPaths } from "src/app/routerPaths";
import type { ModuleSummary } from "src/careerReadiness/types";

// mock the router
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    __esModule: true,
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
    NavLink: jest.fn().mockImplementation(() => {
      return <></>;
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

const makeModule = (id: string, status: ModuleSummary["status"], sortOrder: number): ModuleSummary => ({
  id,
  title: `Module ${id}`,
  description: "",
  icon: "",
  status,
  sort_order: sortOrder,
  input_placeholder: "",
});

describe("CareerReadinessProgressBanner", () => {
  test("shows completed/total text and renders segments in sort_order", () => {
    // GIVEN unsorted modules where two are completed
    const modules = [
      makeModule("m3", "NOT_STARTED", 3),
      makeModule("m1", "COMPLETED", 1),
      makeModule("m2", "COMPLETED", 2),
    ];

    // WHEN the banner is rendered
    render(<CareerReadinessProgressBanner modules={modules} />);

    // THEN the container and completed-of-total text are shown
    expect(screen.getByTestId(DATA_TEST_ID.PROGRESS_BANNER)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.PROGRESS_REMAINING)).toHaveTextContent("2 of 3 modules");

    // AND progress segments follow sort_order
    const segments = within(screen.getByTestId(DATA_TEST_ID.PROGRESS_BANNER))
      .getAllByTestId(new RegExp(`^${DATA_TEST_ID.PROGRESS_BAR_SEGMENT}-`))
      .map((el) => el.getAttribute("data-testid"));

    expect(segments).toEqual([
      `${DATA_TEST_ID.PROGRESS_BAR_SEGMENT}-m1`,
      `${DATA_TEST_ID.PROGRESS_BAR_SEGMENT}-m2`,
      `${DATA_TEST_ID.PROGRESS_BAR_SEGMENT}-m3`,
    ]);
  });

  test("shows up-next and continue button for the first non-completed module", async () => {
    // GIVEN modules where the first non-completed one is in progress
    const modules = [
      makeModule("m1", "COMPLETED", 1),
      makeModule("m2", "IN_PROGRESS", 2),
      makeModule("m3", "NOT_STARTED", 3),
    ];

    // WHEN the banner is rendered
    render(<CareerReadinessProgressBanner modules={modules} />);

    // THEN up-next points to that first non-completed module
    expect(screen.getByText("Up next:")).toBeInTheDocument();
    expect(screen.getByText("Module m2")).toBeInTheDocument();
    const continueCta = screen.getByTestId(DATA_TEST_ID.CONTINUE_BUTTON);
    expect(continueCta).toHaveTextContent("Continue: Module m2");

    await userEvent.click(continueCta);
    expect(useNavigate()).toHaveBeenCalledWith(`${routerPaths.CAREER_READINESS}/m2`);

    // AND all segments have the correct styles
    expect(screen.getByTestId(`${DATA_TEST_ID.PROGRESS_BAR_SEGMENT}-m2`)).toHaveStyle({ opacity: 0.55 });
    expect(screen.getByTestId(`${DATA_TEST_ID.PROGRESS_BAR_SEGMENT}-m3`)).toHaveStyle({ opacity: 1 });
  });

  test("falls back to first module for up-next when all modules are completed", () => {
    // GIVEN all modules are completed
    const modules = [makeModule("m1", "COMPLETED", 1), makeModule("m2", "COMPLETED", 2)];

    // WHEN the banner is rendered
    render(<CareerReadinessProgressBanner modules={modules} />);

    // THEN progress text shows all modules completed
    expect(screen.getByTestId(DATA_TEST_ID.PROGRESS_REMAINING)).toHaveTextContent("2 of 2 modules");

    // AND the UI falls back to the first module for up-next and continue text
    expect(screen.getByText("Up next:")).toBeInTheDocument();
    expect(screen.getByText("Module m1")).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CONTINUE_BUTTON)).toHaveTextContent("Continue: Module m1");
  });

  test("handles empty modules list", () => {
    // GIVEN no modules

    // WHEN the banner is rendered
    render(<CareerReadinessProgressBanner modules={[]} />);

    // THEN completed-of-total is zero, and no CTA/up-next is shown
    expect(screen.getByTestId(DATA_TEST_ID.PROGRESS_REMAINING)).toHaveTextContent("0 of 0 modules");
    expect(screen.queryByTestId(DATA_TEST_ID.CONTINUE_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByText("Up next:")).not.toBeInTheDocument();
  });
});
