// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesDrawerContent, {
  DATA_TEST_ID,
  LoadingExperienceDrawerContent,
  MENU_ITEM_ID,
} from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";

// mock the ContextMenu
jest.mock("src/theme/ContextMenu/ContextMenu", () => {
  const actual = jest.requireActual("src/theme/ContextMenu/ContextMenu");
  return {
    __esModule: true,
    default: jest.fn(({ items }: { items: MenuItemConfig[] }) => (
      <div data-testid={actual.DATA_TEST_ID.MENU}>
        {items.map((item) => (
          <div key={item.id} data-testid={item.id} onClick={item.action}>
            {item.text}
          </div>
        ))}
        ;
      </div>
    )),
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

describe("ReportDrawerContent", () => {
  test("should render ExperiencesDrawerContent correctly", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} onEdit={jest.fn()} />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the report drawer content container to be in the document
    const reportDrawerContentContainer = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_CONTAINER);
    expect(reportDrawerContentContainer).toBeInTheDocument();
    // AND the report drawer content date to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_DATE)).toBeInTheDocument();
    // AND the report drawer content occupation to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_OCCUPATION)).toBeInTheDocument();
    // AND the report drawer content skills to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_SKILLS)).toBeInTheDocument();
    // AND the report drawer skills container to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_SKILLS_CONTAINER)).toBeInTheDocument();
    // AND the report drawer content experience summary to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_SUMMARY)).toBeInTheDocument();
    // AND the report drawer chips to be in the document
    const chips = screen.getAllByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CHIP);
    chips.forEach((chip) => expect(chip).toBeInTheDocument());
    // AND to match the snapshot
    expect(reportDrawerContentContainer).toMatchSnapshot();
  });

  test("should render ExperiencesDrawerContent skeleton correctly", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = <LoadingExperienceDrawerContent />;

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect no errors or warning to have occurred
    const loadingContainer = screen.getByTestId(DATA_TEST_ID.LOADING_EXPERIENCES_DRAWER_CONTENT_CONTAINER);
    expect(loadingContainer).toBeInTheDocument();

    // AND expect skeleton elements to be in the document
    const skeletonElement = screen.getAllByTestId("skeleton-text");
    expect(skeletonElement).toHaveLength(3);

    // AND to match the snapshot
    expect(loadingContainer).toMatchSnapshot();
  });

  test("should render edit button if experience exploration phase is PROCESSED", () => {
    // GIVEN the ExperiencesDrawerContent component with a PROCESSED experience
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent
        experience={{ ...mockExperiences[0], exploration_phase: DiveInPhase.PROCESSED }}
        onEdit={jest.fn()}
      />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the report drawer more button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)).toBeInTheDocument();
  });

  test.each([
    DiveInPhase.NOT_STARTED,
    DiveInPhase.EXPLORING_SKILLS,
    DiveInPhase.LINKING_RANKING,
  ])("should not render context menu button if experience exploration phase is %s", (phase) => {
    // GIVEN the ExperiencesDrawerContent component with a non-PROCESSED experience
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent
        experience={{ ...mockExperiences[0], exploration_phase: phase }}
        onEdit={jest.fn()}
      />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the report drawer more button to be in the document
    expect(screen.queryByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)).not.toBeInTheDocument();  })

  test("it should show No skills yet when there are no skills", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0], top_skills: [] }} onEdit={jest.fn()} />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect No skills yet to be in the document
    expect(screen.getByText("No skills discovered yet")).toBeInTheDocument();
  });

  test("should show skill description when chip is clicked", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} onEdit={jest.fn()} />
    );
    // AND the component is rendered
    render(givenReportDrawerContent);

    // WHEN the chip is clicked
    const chip = screen.getAllByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CHIP)[0];
    fireEvent.click(chip);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the popover to be in the document
    const popoverEl = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_POPOVER);
    expect(popoverEl).toBeInTheDocument();
    // AND the skill description to be in the document
    expect(screen.getByText(mockExperiences[0].top_skills[0].description)).toBeInTheDocument();
  });

  test("should close popover when clicked outside", async () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} onEdit={jest.fn()} />
    );
    // AND the component is rendered
    render(givenReportDrawerContent);
    // AND the chip is clicked
    const chip = screen.getAllByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CHIP)[0];
    fireEvent.click(chip);
    // AND the popover is open
    const popoverEl = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_POPOVER);
    expect(popoverEl).toBeVisible();

    // WHEN the user clicks outside the popover
    fireEvent.keyDown(popoverEl, { key: "Escape" });

    // THEN expect the popover to be invisible
    await waitFor(() => {
      expect(popoverEl).not.toBeInTheDocument();
    });
    // AND expect the skill description to not be in the document
    expect(screen.queryByText(mockExperiences[0].top_skills[0].description)).not.toBeInTheDocument();
  });

  test("should call onEdit when edit button is clicked", async () => {
    // GIVEN the ExperiencesDrawerContent component
    const onEditMock = jest.fn();
    // GIVEN some experiences that have been explored
    const givenExploredExperiences = mockExperiences[0]
    givenExploredExperiences.exploration_phase = DiveInPhase.PROCESSED;
    // AND the ExperiencesDrawer component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={givenExploredExperiences} onEdit={onEditMock} />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);
    // AND the more button is clicked to open the context menu
    const moreButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
    await userEvent.click(moreButton);
    // AND the edit button is clicked
    const editButton = screen.getByTestId(MENU_ITEM_ID.EDIT);
    await userEvent.click(editButton);

    // THEN expect onEdit to have been called with the correct experience
    expect(onEditMock).toHaveBeenCalledWith(mockExperiences[0]);
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
