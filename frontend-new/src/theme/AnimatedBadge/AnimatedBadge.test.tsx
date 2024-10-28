// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import AnimatedBadge, { DATA_TEST_ID } from "src/theme/AnimatedBadge/AnimatedBadge";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";

describe("AnimatedBadge", () => {
  test("should render the badge with provided content", () => {
    // GIVEN the badge content
    const givenBadgeContent = 2;

    // WHEN the component is rendered
    render(
      <AnimatedBadge badgeContent={givenBadgeContent} invisible={false}>
        <BadgeOutlinedIcon data-testid="badge-icon" />
      </AnimatedBadge>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND expect the badge to be displayed
    const badge = screen.getByTestId(DATA_TEST_ID.ANIMATED_BADGE);
    expect(badge).toBeInTheDocument();
    // AND expect the badge icon to be displayed
    expect(screen.getByTestId("badge-icon")).toBeInTheDocument();
    // AND expect the badge content to be displayed
    expect(screen.getByText(givenBadgeContent)).toBeInTheDocument();
    // AND to match the snapshot
    expect(badge).toMatchSnapshot();
  });

  test("should render the badge for a large number", () => {
    // GIVEN the badge content
    const givenBadgeContent = 100;

    // WHEN the component is rendered
    render(
      <AnimatedBadge badgeContent={givenBadgeContent} invisible={false}>
        <BadgeOutlinedIcon data-testid="badge-icon" />
      </AnimatedBadge>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND expect the badge to be displayed
    const badge = screen.getByTestId(DATA_TEST_ID.ANIMATED_BADGE);
    expect(badge).toBeInTheDocument();
    // AND expect the badge icon to be displayed
    expect(screen.getByTestId("badge-icon")).toBeInTheDocument();
    // AND expect the badge content to be displayed
    expect(screen.getByText("99+")).toBeInTheDocument();
    // AND to match the snapshot
    expect(badge).toMatchSnapshot();
  });

  test("should render the badge as invisible", () => {
    // GIVEN the badge content
    const givenBadgeContent = 2;
    // AND the badge is invisible
    const givenInvisible = true;

    // WHEN the component is rendered
    render(
      <AnimatedBadge badgeContent={givenBadgeContent} invisible={givenInvisible}>
        <BadgeOutlinedIcon data-testid="badge-icon" />
      </AnimatedBadge>
    );

    // THEN expect badge to be displayed
    const badge = screen.getByTestId(DATA_TEST_ID.ANIMATED_BADGE);
    expect(badge).toBeInTheDocument();
    // AND the badge icon to be displayed
    expect(screen.getByTestId("badge-icon")).toBeInTheDocument();
    // AND the badge content to be hidden
    expect(screen.queryByText(givenBadgeContent)).not.toBeInTheDocument();
  });
});
