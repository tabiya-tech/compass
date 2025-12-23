// mute chatty console
import "src/_test_utilities/consoleMock";

import React from "react";
import "@testing-library/jest-dom";
import { screen, render, waitFor } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import EnumField, { DATA_TEST_ID } from "./EnumField";
import { FieldType, EnumFieldDefinition } from "../config/types";

const getFieldDefinition = (): EnumFieldDefinition => {
  return {
    name: "test",
    label: "Test Label",
    dataKey: "test",
    values: ["option1", "option2"],
    required: false,
    type: FieldType.Enum,
  };
};

describe("EnumField", () => {
  // Create a new userEvent instance before each test
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    jest.clearAllMocks();
    user = userEvent.setup();
  });

  describe("render", () => {
    test("should render with the correct label and options", async () => {
      // GIVEN the field definition
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();

      // WHEN the component is rendered
      render(
        <EnumField field={givenFieldDefinition} dataTestId={DATA_TEST_ID.ENUM_FIELD_SELECT} onChange={givenOnChange} />
      );

      // THEN ensure label is visible
      expect(screen.getByTestId(DATA_TEST_ID.ENUM_FIELD_INPUT_LABEL)).toHaveTextContent("Test Label");

      // AND Ensure select element is present
      const select = screen.getByTestId(DATA_TEST_ID.ENUM_FIELD_SELECT);
      expect(select).toBeInTheDocument();

      // WHEN Open the dropdown
      await userEvent.click(select);

      // MUI's <Select> component uses a Popper for the dropdown menu, which is rendered outside the main DOM tree.
      // In testing environments, `userEvent.click(select)` may not always trigger the dropdown due to how Popper.js works.
      // Using `userEvent.keyboard("{ArrowDown}")` forces focus on the select element, ensuring that the dropdown opens.
      await userEvent.keyboard("{ArrowDown}");

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeTruthy();
      });

      // THEN: Ensure all options are rendered
      for (let i = 0; i < givenFieldDefinition.values.length; i++) {
        const menuItem = await screen.findByTestId(`${DATA_TEST_ID.ENUM_FIELD_MENU_ITEM}-${i}`);
        expect(menuItem).toHaveTextContent(givenFieldDefinition.values[i]);
      }
    });

    test("should render optional question text when provided", async () => {
      // GIVEN we render the component with an optional question text
      const givenFieldDefinitionWithQuestionText = {
        ...getFieldDefinition(),
        questionText: "Optional text",
      };
      const givenOnChange = jest.fn();
      render(
        <EnumField
          field={givenFieldDefinitionWithQuestionText}
          dataTestId={DATA_TEST_ID.ENUM_FIELD_SELECT}
          onChange={givenOnChange}
        />
      );

      // THEN the optional text should be visible
      await waitFor(() => {
        const questionText = screen.getByTestId(DATA_TEST_ID.ENUM_FIELD_QUESTION_TEXT);
        expect(questionText).toHaveTextContent("Optional text");
      });
    });
  });

  describe("action", () => {
    test("should call onChange when a value is selected", async () => {
      // GIVEN we render the component
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <EnumField field={givenFieldDefinition} dataTestId={DATA_TEST_ID.ENUM_FIELD_SELECT} onChange={givenOnChange} />
      );

      // WHEN we click the select to open it
      const select = screen.getByTestId(DATA_TEST_ID.ENUM_FIELD_SELECT);
      await user.click(select);

      // MUI's <Select> component uses a Popper for the dropdown menu, which is rendered outside the main DOM tree.
      // In testing environments, `userEvent.click(select)` may not always trigger the dropdown due to how Popper.js works.
      // Using `userEvent.keyboard("{ArrowDown}")` forces focus on the select element, ensuring that the dropdown opens.
      await userEvent.keyboard("{ArrowDown}");

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeTruthy();
      });

      // AND select an option
      const option = await screen.findByTestId(`${DATA_TEST_ID.ENUM_FIELD_MENU_ITEM}-0`);
      await user.click(option);

      // THEN onChange should be called with the selected value and valid state
      await waitFor(() => {
        expect(givenOnChange).toHaveBeenCalledWith("option1", true);
      });
    });

    test("should initialize with the provided initial value", async () => {
      // GIVEN we render the component with an initial value
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <EnumField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.ENUM_FIELD_SELECT}
          onChange={givenOnChange}
          initialValue="option1"
        />
      );

      // THEN the select should show the initial value
      await waitFor(() => {
        const select = screen.getByTestId(DATA_TEST_ID.ENUM_FIELD_SELECT);
        expect(select).toHaveTextContent("option1");
      });
    });

    test("should allow clearing the selection for non-required fields", async () => {
      // GIVEN we render the component with an initial value
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <EnumField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.ENUM_FIELD_SELECT}
          onChange={givenOnChange}
          initialValue="option1"
        />
      );

      // WHEN we click the clear button
      const clearButton = await screen.findByTestId(DATA_TEST_ID.ENUM_FIELD_CLEAR_BUTTON);
      await user.click(clearButton);

      // THEN onChange should be called with empty string and valid state
      await waitFor(() => {
        expect(givenOnChange).toHaveBeenCalledWith("", true);
      });

      // AND the select should be empty
      await waitFor(() => {
        const select = screen.getByTestId(DATA_TEST_ID.ENUM_FIELD_SELECT);
        expect(select).toHaveTextContent(givenFieldDefinition.label);
      });
    });
  });
});
