import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@mui/material";
import { applicationTheme, ThemeMode } from "src/theme/applicationTheme/applicationTheme";
import BucketLevel, { DATA_TEST_ID } from "./BucketLevel";

describe("BucketLevel", () => {
  const theme = applicationTheme(ThemeMode.LIGHT);

  test("should render bucket with correct fill level", () => {
    // GIVEN a fill level of 75%
    const fillLevel = 75;

    // WHEN the component is rendered
    render(
      <ThemeProvider theme={theme}>
        <BucketLevel fillLevel={fillLevel} />
      </ThemeProvider>
    );

    // THEN the percentage text should be visible
    expect(screen.getByTestId(DATA_TEST_ID.BUCKET_LEVEL_TEXT)).toHaveTextContent("75%");
    // AND the container should be present
    expect(screen.getByTestId(DATA_TEST_ID.BUCKET_LEVEL_CONTAINER)).toBeInTheDocument();
  });

  test("should call onClick when clicked and not disabled", () => {
    // GIVEN a click handler
    const handleClick = jest.fn();

    // WHEN the component is rendered and clicked
    render(
      <ThemeProvider theme={theme}>
        <BucketLevel fillLevel={50} onClick={handleClick} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.BUCKET_LEVEL_CONTAINER));

    // THEN the click handler should be called
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("should not call onClick when disabled", () => {
    // GIVEN a click handler and disabled state
    const handleClick = jest.fn();

    // WHEN the component is rendered with disabled prop and clicked
    render(
      <ThemeProvider theme={theme}>
        <BucketLevel fillLevel={50} onClick={handleClick} disabled />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.BUCKET_LEVEL_CONTAINER));

    // THEN the click handler should not be called
    expect(handleClick).not.toHaveBeenCalled();
  });

  test("should clamp fill level between 0 and 100", () => {
    // GIVEN fill levels outside the valid range
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <BucketLevel fillLevel={150} />
      </ThemeProvider>
    );

    // THEN the percentage should be clamped to 100%
    expect(screen.getByTestId(DATA_TEST_ID.BUCKET_LEVEL_TEXT)).toHaveTextContent("100%");

    // WHEN the fill level is negative
    rerender(
      <ThemeProvider theme={theme}>
        <BucketLevel fillLevel={-50} />
      </ThemeProvider>
    );

    // THEN the percentage should be clamped to 0%
    expect(screen.getByTestId(DATA_TEST_ID.BUCKET_LEVEL_TEXT)).toHaveTextContent("0%");
  });
}); 