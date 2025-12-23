// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import AnimatedDotBadge, { DATA_TEST_ID } from "src/theme/AnimatedDotBadge/AnimatedDotBadge";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";

describe("AnimatedDotBadge", () => {
  test("should render the dot when show is true", () => {
    // GIVEN show is true
    const givenShow = true;
    const givenTestId = "badge-icon";

    // WHEN the component is rendered
    render(
      <AnimatedDotBadge show={givenShow}>
        <BadgeOutlinedIcon data-testid={givenTestId} />
      </AnimatedDotBadge>
    );

    // THEN expect no errors or warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the badge to be displayed
    const badge = screen.getByTestId(DATA_TEST_ID.ANIMATED_DOT_BADGE);
    expect(badge).toBeInTheDocument();
    // AND the child to be rendered
    expect(screen.getByTestId(givenTestId)).toBeInTheDocument();
    // AND to match the snapshot
    expect(badge).toMatchSnapshot();
  });

  test("should render the badge as invisible when show is false", () => {
    // GIVEN show is false
    const givenShow = false;
    const givenTestId = "badge-icon";

    // WHEN the component is rendered
    render(
      <AnimatedDotBadge show={givenShow}>
        <BadgeOutlinedIcon data-testid={givenTestId} />
      </AnimatedDotBadge>
    );

    // THEN the badge wrapper renders
    const badge = screen.getByTestId(DATA_TEST_ID.ANIMATED_DOT_BADGE);
    expect(badge).toBeInTheDocument();
    // AND MUI applies an invisible class on the badge content element
    const badgeContent = badge.querySelector(".MuiBadge-badge") as HTMLElement | null;
    expect(badgeContent).not.toBeNull();
    expect(badgeContent!).toHaveClass("MuiBadge-invisible");
    // AND the child remains rendered
    expect(screen.getByTestId(givenTestId)).toBeInTheDocument();
  });
});
