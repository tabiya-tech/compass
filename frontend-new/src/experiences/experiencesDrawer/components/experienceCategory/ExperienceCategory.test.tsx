// mute the console
import "src/_test_utilities/consoleMock";

import ExperienceCategory from "src/experiences/experiencesDrawer/components/experienceCategory/ExperienceCategory";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { fireEvent } from "@testing-library/react";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { DATA_TEST_ID as EXPERIENCES_DRAWER_CONTENT_TEST_ID, MENU_ITEM_ID } from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";

// mock the ContextMenu
jest.mock("src/theme/ContextMenu/ContextMenu", () => {
  const actual = jest.requireActual("src/theme/ContextMenu/ContextMenu");
  return {
    __esModule: true,
    default: jest.fn(({ items, notifyOnClose }: { items: MenuItemConfig[]; notifyOnClose: () => void }) => (
      <div data-testid={actual.DATA_TEST_ID.MENU}>
        {items.map((item) => (
          <div key={item.id} data-testid={item.id} onClick={item.action}>
            {item.text}
          </div>
        ))}
        <button data-testid="close-menu-button" onClick={notifyOnClose}>
          Close
        </button>
      </div>
    )),
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

describe("ExperienceCategory", () => {
  const defaultProps = {
    icon: <div>Test Icon</div>,
    title: "Test Category",
    experiences: [],
    onEditExperience: jest.fn(),
    onDeleteExperience: jest.fn(),
    onRestoreToOriginalExperience: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should render ExperienceCategory correctly with no experiences", () => {
    // GIVEN the ExperienceCategory component with no experiences
    const givenExperienceCategory = <ExperienceCategory {...defaultProps} />;

    // WHEN the component is rendered
    render(givenExperienceCategory);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND no experience content to be rendered
    expect(screen.queryByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_CONTENT_CONTAINER)).not.toBeInTheDocument();
  });

  test("should render experiences when provided", () => {
    // GIVEN some experiences that have been processed
    const givenExperiences = mockExperiences.map((experience) => ({
      ...experience,
      exploration_phase: DiveInPhase.PROCESSED,
    }));
    // AND the ExperienceCategory component
    const givenExperienceCategory = (
      <ExperienceCategory
        {...defaultProps}
        experiences={givenExperiences}
      />
    );

    // WHEN the component is rendered
    render(givenExperienceCategory);

    // THEN expect the experiences to be rendered
    const experienceContainers = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_CONTENT_CONTAINER);
    expect(experienceContainers).toHaveLength(givenExperiences.length);
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should call onEditExperience when edit button is clicked", () => {
    // GIVEN some experiences that have been processed
    const givenExperiences = mockExperiences.map((experience) => ({
      ...experience,
      exploration_phase: DiveInPhase.PROCESSED,
    }));
    // AND the ExperienceCategory component
    const givenExperienceCategory = (
      <ExperienceCategory
        {...defaultProps}
        experiences={givenExperiences}
      />
    );

    // WHEN the component is rendered
    render(givenExperienceCategory);
    // AND the more button is clicked for the first experience
    const moreButtons = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
    fireEvent.click(moreButtons[0]);
    // AND the edit button is clicked
    const editButton = screen.getAllByTestId(MENU_ITEM_ID.EDIT)[0];
    fireEvent.click(editButton);

    // THEN expect onEditExperience to have been called with the correct experience
    expect(defaultProps.onEditExperience).toHaveBeenCalledWith(givenExperiences[0]);
  });

  test("should call onDeleteExperience when delete button is clicked", () => {
    // GIVEN some experiences that have been processed
    const givenExperiences = mockExperiences.map((experience) => ({
      ...experience,
      exploration_phase: DiveInPhase.PROCESSED,
    }));
    // AND the ExperienceCategory component
    const givenExperienceCategory = (
      <ExperienceCategory
        {...defaultProps}
        experiences={givenExperiences}
      />
    );

    // WHEN the component is rendered
    render(givenExperienceCategory);
    // AND the more button is clicked for the first experience
    const moreButtons = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
    fireEvent.click(moreButtons[0]);
    // AND the delete button is clicked
    const deleteButton = screen.getAllByTestId(MENU_ITEM_ID.DELETE)[0];
    fireEvent.click(deleteButton);

    // THEN expect onDeleteExperience to have been called with the correct experience
    expect(defaultProps.onDeleteExperience).toHaveBeenCalledWith(givenExperiences[0]);
  });

  test("should call onRestoreToOriginalExperience when restore to original button is clicked", () => {
    // GIVEN some experiences that have been processed
    const givenExperiences = mockExperiences.map((experience) => ({
      ...experience,
      exploration_phase: DiveInPhase.PROCESSED,
    }));
    // AND the ExperienceCategory component
    const givenExperienceCategory = (
      <ExperienceCategory
        {...defaultProps}
        experiences={givenExperiences}
      />
    );

    // WHEN the component is rendered
    render(givenExperienceCategory);
    // AND the more button is clicked for the first experience
    const moreButtons = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
    fireEvent.click(moreButtons[0]);
    // AND the restore to original button is clicked
    const restoreToOriginalButton = screen.getAllByTestId(MENU_ITEM_ID.RESTORE_TO_ORIGINAL)[0];
    fireEvent.click(restoreToOriginalButton);

    // THEN expect onRestoreToOriginalExperience to have been called with the correct experience
    expect(defaultProps.onRestoreToOriginalExperience).toHaveBeenCalledWith(givenExperiences[0]);
  });

  test("should not show context menu for non-processed experiences", () => {
    // GIVEN some experiences that have not been processed
    const givenExperiences = mockExperiences.map((experience) => ({
      ...experience,
      exploration_phase: DiveInPhase.NOT_STARTED,
    }));
    // AND the ExperienceCategory component
    const givenExperienceCategory = (
      <ExperienceCategory
        {...defaultProps}
        experiences={givenExperiences}
      />
    );

    // WHEN the component is rendered
    render(givenExperienceCategory);

    // THEN expect no more buttons to be rendered
    expect(screen.queryByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)).not.toBeInTheDocument();
  });
}); 