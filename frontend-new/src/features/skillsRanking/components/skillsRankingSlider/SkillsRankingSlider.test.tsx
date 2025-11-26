// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import SkillsRankingSlider from "src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider";

// Mock MUI Slider
jest.mock("@mui/material", () => {
  const actual = jest.requireActual("@mui/material");
  return {
    ...actual,
    Slider: ({ value, onChange, disabled, valueLabelDisplay, valueLabelFormat, ...rest }: any) => (
      <div>
        <input
          type="range"
          data-testid={rest["data-testid"]}
          aria-label={rest["aria-label"]}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e as any, Number(e.target.value))}
        />
        {valueLabelDisplay !== "off" && valueLabelFormat && (
          <span data-testid="value-label">{valueLabelFormat(value)}</span>
        )}
      </div>
    ),
  };
});

describe("SkillsRankingSlider", () => {
  test("should render with initial value", () => {
    // GIVEN initial value
    const givenValue = 30;
    const mockOnChange = jest.fn();

    // WHEN rendering the slider
    render(
      <SkillsRankingSlider
        value={givenValue}
        onChange={mockOnChange}
        data-testid="skills-ranking-slider"
        aria-label="skills slider"
      />
    );

    // THEN expect input present with a given value
    const slider = screen.getByTestId("skills-ranking-slider") as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.value).toBe(String(givenValue));
  });

  test("should call onChange when value changes", () => {
    // GIVEN slider
    const mockOnChange = jest.fn();
    render(
      <SkillsRankingSlider
        value={0}
        onChange={mockOnChange}
        data-testid="skills-ranking-slider"
        aria-label="skills slider"
      />
    );
    const slider = screen.getByTestId("skills-ranking-slider") as HTMLInputElement;

    // WHEN changing the value
    fireEvent.change(slider, { target: { value: "75" } });

    // THEN expect onChange to be called with number
    expect(mockOnChange).toHaveBeenCalled();
    const lastCallArgs = mockOnChange.mock.calls.at(-1);
    expect(lastCallArgs?.[1]).toBe(75);
  });

  test("should render disabled slider when disabled prop true", () => {
    // GIVEN disabled slider
    render(
      <SkillsRankingSlider
        value={10}
        onChange={jest.fn()}
        disabled
        data-testid="skills-ranking-slider"
        aria-label="skills slider"
      />
    );

    // WHEN querying element
    const slider = screen.getByTestId("skills-ranking-slider") as HTMLInputElement;

    // THEN expect disabled attribute
    expect(slider.disabled).toBe(true);
  });

  test("should format the value label using valueLabelFormat when value > 0", () => {
    // GIVEN slider with value 25
    render(
      <SkillsRankingSlider
        value={25}
        onChange={jest.fn()}
        data-testid="skills-ranking-slider"
        aria-label="skills slider"
      />
    );

    // WHEN querying the value label
    const label = screen.getByTestId("value-label");

    // THEN label displays the formatted percentage
    expect(label).toBeInTheDocument();
    expect(label.textContent).toBe("25%");
  });
});
