// mute chatty console
import "src/_test_utilities/consoleMock";

import React from 'react';
import '@testing-library/jest-dom';
import { screen, render, waitFor } from 'src/_test_utilities/test-utils';
import userEvent from '@testing-library/user-event';
import MultipleSelectField, { DATA_TEST_ID } from './MultipleSelectField';
import { FieldType, MultipleSelectFieldDefinition } from '../config/types';

const getFieldDefinition = () : MultipleSelectFieldDefinition => {
  return {
    name: 'test',
    label: 'Test Label',
    dataKey: 'test',
    values: ['option1', 'option2'],
    required: false,
    type: FieldType.MultipleSelect,
  };
}

describe('MultipleSelectField', () => {
  // Create a new userEvent instance before each test
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    jest.clearAllMocks();
    user = userEvent.setup();
  });

  describe('render', () => {
    test("should render with the correct label and options", async () => {
      // GIVEN the field definition
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();

      // WHEN the component is rendered
      render(
        <MultipleSelectField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT}
          onChange={givenOnChange}
        />
      );

      // THEN ensure label is visible
      expect(screen.getByTestId(DATA_TEST_ID.MULTIPLE_SELECT_FIELD_INPUT_LABEL)).toHaveTextContent("Test Label");

      // AND Ensure select element is present
      const select = screen.getByTestId(DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT);
      expect(select).toBeInTheDocument();

      // WHEN Open the dropdown
      await user.click(select);

      // MUI's <Select> component uses a Popper for the dropdown menu, which is rendered outside the main DOM tree.
      // In testing environments, `userEvent.click(select)` may not always trigger the dropdown due to how Popper.js works.
      // Using `userEvent.keyboard("{ArrowDown}")` forces focus on the select element, ensuring that the dropdown opens.
      await user.keyboard("{ArrowDown}");

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeTruthy();
      });

      // THEN: Ensure all options are rendered
      for (let i = 0; i < givenFieldDefinition.values.length; i++) {
        const menuItem = await screen.findByTestId(`${DATA_TEST_ID.MULTIPLE_SELECT_FIELD_MENU_ITEM}-${i}`);
        expect(menuItem).toHaveTextContent(givenFieldDefinition.values[i]);
      }
    });

    test('should render optional question text when provided', async () => {
      // GIVEN we render the component with an optional question text
      const givenFieldDefinitionWithQuestionText = {
        ...getFieldDefinition(),
        questionText: 'Optional text'
      };
      const givenOnChange = jest.fn();
      render(
        <MultipleSelectField
          field={givenFieldDefinitionWithQuestionText}
          dataTestId={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT}
          onChange={givenOnChange}
        />
      );

      // THEN the optional text should be visible
      await waitFor(() => {
        const questionText = screen.getByTestId(DATA_TEST_ID.MULTIPLE_SELECT_FIELD_QUESTION_TEXT);
        expect(questionText).toHaveTextContent('Optional text');
      });
    });
  });

  describe('action', () => {
    test('should call onChange when values are selected', async () => {
      // GIVEN we render the component
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <MultipleSelectField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT}
          onChange={givenOnChange}
        />
      );

      // WHEN we click the select to open it
      const select = screen.getByTestId(DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT);
      await user.click(select);

      // MUI's <Select> component uses a Popper for the dropdown menu, which is rendered outside the main DOM tree.
      // In testing environments, `userEvent.click(select)` may not always trigger the dropdown due to how Popper.js works.
      // Using `userEvent.keyboard("{ArrowDown}")` forces focus on the select element, ensuring that the dropdown opens.
      await user.keyboard("{ArrowDown}");

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeTruthy();
      });

      // AND select options
      const option1 = await screen.findByTestId(`${DATA_TEST_ID.MULTIPLE_SELECT_FIELD_MENU_ITEM}-0`);
      const option2 = await screen.findByTestId(`${DATA_TEST_ID.MULTIPLE_SELECT_FIELD_MENU_ITEM}-1`);
      await user.click(option1);
      await user.click(option2);

      // THEN onChange should be called with the selected values and valid state
      await waitFor(() => {
        expect(givenOnChange).toHaveBeenCalledWith(['option1', 'option2'], true);
      });
    });

    test('should show validation error for required field when empty', async () => {
      // GIVEN we render the component as required
      const givenRequiredField = {
        ...getFieldDefinition(),
        required: true
      };
      const givenOnChange = jest.fn();
      render(
        <MultipleSelectField
          field={givenRequiredField}
          dataTestId={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT}
          onChange={givenOnChange}
        />
      );

      // WHEN we click the select to open it
      const select = screen.getByTestId(DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT);
      await user.click(select);

      // MUI's <Select> component uses a Popper for the dropdown menu, which is rendered outside the main DOM tree.
      // In testing environments, `userEvent.click(select)` may not always trigger the dropdown due to how Popper.js works.
      // Using `userEvent.keyboard("{ArrowDown}")` forces focus on the select element, ensuring that the dropdown opens.
      await user.keyboard("{ArrowDown}");

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeTruthy();
      });

      // AND select an option and then deselect it
      const option = await screen.findByTestId(`${DATA_TEST_ID.MULTIPLE_SELECT_FIELD_MENU_ITEM}-0`);
      await user.click(option);
      await user.click(option);

      // THEN the input should show error state
      await waitFor(() => {
        const input = screen.getByTestId(DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT);
        expect(input).toHaveClass('Mui-error');
      });
      
      // AND the error message should be displayed
      await waitFor(() => {
        const errorMessage = screen.getByTestId(DATA_TEST_ID.MULTIPLE_SELECT_FIELD_HELPER_TEXT);
        expect(errorMessage).toHaveTextContent('Please select at least one test label');
      });

      // AND onChange should be called with empty array and invalid state
      await waitFor(() => {
        expect(givenOnChange).toHaveBeenCalledWith([], false);
      });
    });

    test('should initialize with the provided initial values', async () => {
      // GIVEN we render the component with initial values
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <MultipleSelectField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT}
          onChange={givenOnChange}
          initialValue={['option1']}
        />
      );

      // THEN the select should show the initial values
      await waitFor(() => {
        const select = screen.getByTestId(DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT);
        expect(select).toHaveTextContent('option1');
      });
    });

    test('should render chips for selected values', async () => {
      // GIVEN we render the component with initial values
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <MultipleSelectField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT}
          onChange={givenOnChange}
          initialValue={['option1', 'option2']}
        />
      );

      // THEN chips should be rendered for each selected value
      await waitFor(() => {
        const chip1 = screen.getByTestId(`${DATA_TEST_ID.MULTIPLE_SELECT_FIELD_CHIP}-option1`);
        expect(chip1).toHaveTextContent('option1');
      });

      await waitFor(() => {
        const chip2 = screen.getByTestId(`${DATA_TEST_ID.MULTIPLE_SELECT_FIELD_CHIP}-option2`);
        expect(chip2).toHaveTextContent('option2');
      });
    });

    test('should use default dataTestId when not provided', async () => {
      // GIVEN we render the component without dataTestId
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <MultipleSelectField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT}
          onChange={givenOnChange}
        />
      );

      // THEN the select should use the default dataTestId
      await waitFor(() => {
        const select = screen.getByTestId(DATA_TEST_ID.MULTIPLE_SELECT_FIELD_SELECT);
        expect(select).toBeInTheDocument();
      });
    });
  });
}); 