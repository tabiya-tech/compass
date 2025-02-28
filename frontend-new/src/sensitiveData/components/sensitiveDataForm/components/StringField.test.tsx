import React from 'react';
import '@testing-library/jest-dom';
import { screen, render, waitFor, fireEvent } from 'src/_test_utilities/test-utils';
import userEvent from '@testing-library/user-event';
import StringField, { DATA_TEST_ID } from './StringField';
import { FieldType, StringFieldDefinition } from '../config/types';

// Mock debounce to execute immediately
jest.mock('lodash.debounce', () => (fn: Function) => fn);

const getFieldDefinition = () : StringFieldDefinition => {
  return {
    name: 'test',
    label: 'Test Label',
    dataKey: 'test',
    required: false,
    type: FieldType.String,
    validation: {
      pattern: '^[A-Za-z\\s]{2,50}$',
      errorMessage: 'Test label should contain only letters and be 2-50 characters long'
    }
  };
}

describe('StringField', () => {
  // Create a new userEvent instance before each test
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    jest.clearAllMocks();
    user = userEvent.setup();
  });

  describe('render', () => {
    test("should render with the correct label and input", async () => {
      // GIVEN the field definition
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();

      // WHEN the component is rendered
      render(
        <StringField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.STRING_FIELD_INPUT}
          onChange={givenOnChange}
        />
      );

      // THEN ensure label is visible
      expect(screen.getByLabelText(givenFieldDefinition.label)).toBeInTheDocument();

      // AND ensure input is present
      const input = screen.getByTestId(DATA_TEST_ID.STRING_FIELD_INPUT);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('name', 'test');
    });

    test('should render optional question text when provided', async () => {
      // GIVEN we render the component with an optional question text
      const givenFieldDefinitionWithQuestionText = {
        ...getFieldDefinition(),
        questionText: 'Optional text'
      };
      const givenOnChange = jest.fn();
      render(
        <StringField
          field={givenFieldDefinitionWithQuestionText}
          dataTestId={DATA_TEST_ID.STRING_FIELD_INPUT}
          onChange={givenOnChange}
        />
      );

      // THEN the optional text should be visible
      await waitFor(() => {
        const questionText = screen.getByTestId(DATA_TEST_ID.STRING_FIELD_QUESTION_TEXT);
        expect(questionText).toHaveTextContent('Optional text');
      });
    });
  });

  describe('action', () => {
    test('should call onChange when the value changes', async () => {
      // GIVEN we render the component
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <StringField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.STRING_FIELD_INPUT}
          onChange={givenOnChange}
        />
      );

      // WHEN we type in the input
      const input = screen.getByTestId(DATA_TEST_ID.STRING_FIELD_INPUT);
      await user.type(input, 'John');

      // THEN onChange should be called with the new value and valid state
      await waitFor(() => {
        expect(givenOnChange).toHaveBeenCalledWith('John', true);
      });
    });

    test('should trim leading spaces from input', async () => {
      // GIVEN we render the component
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <StringField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.STRING_FIELD_INPUT}
          onChange={givenOnChange}
        />
      );

      // WHEN we type with leading spaces
      const input = screen.getByTestId(DATA_TEST_ID.STRING_FIELD_INPUT);
      await user.type(input, '   John   ');

      // THEN the input value should only have leading spaces trimmed
      expect(input).toHaveValue('John   ');

      // AND onChange should be called with the trimmed value
      await waitFor(() => {
        expect(givenOnChange).toHaveBeenCalledWith('John   ', true);
      });
    });

    test("should show validation error for required field when empty", async () => {
      // GIVEN a required field
      const field: StringFieldDefinition = {
        name: 'test',
        label: 'Test Label',
        required: true,
        type: FieldType.String,
        dataKey: 'test'
      };
      const givenOnChange = jest.fn();
      const givenDataTestId = 'test';

      // WHEN the field is rendered and cleared
      render(<StringField field={field} dataTestId={givenDataTestId} onChange={givenOnChange} />);
      const input = screen.getByTestId(givenDataTestId);
      // first set it to a valid value
      fireEvent.change(input, { target: { value: 'hello' } });
      // then clear it
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // THEN the error state should be shown
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
      
      // AND the error message should be displayed
      expect(screen.getByTestId(DATA_TEST_ID.STRING_FIELD_HELPER_TEXT)).toHaveTextContent('This field is required');
      
      // AND onChange should be called with empty value and invalid state
      expect(givenOnChange).toHaveBeenCalledWith('', false);
    });

    test('should show validation error when pattern validation fails', async () => {
      // GIVEN we render the component with validation
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <StringField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.STRING_FIELD_INPUT}
          onChange={givenOnChange}
        />
      );

      // WHEN we type an invalid value
      const input = screen.getByTestId(DATA_TEST_ID.STRING_FIELD_INPUT);
      await user.type(input, '123');
      await user.keyboard('{Enter}'); // Trigger validation

      // THEN the input should show error state
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.STRING_FIELD_INPUT)).toHaveAttribute('aria-invalid', 'true');
      });
      
      // AND the error message should be displayed
      await waitFor(() => {
        const errorMessage = screen.getByTestId(DATA_TEST_ID.STRING_FIELD_HELPER_TEXT);
        expect(errorMessage).toHaveTextContent('Test label should contain only letters and be 2-50 characters long');
      });

      // AND onChange should be called with invalid state
      await waitFor(() => {
        expect(givenOnChange).toHaveBeenCalledWith('123', false);
      });
    });

    test('should initialize with the provided initial value', async () => {
      // GIVEN we render the component with an initial value
      const givenFieldDefinition = getFieldDefinition();
      const givenOnChange = jest.fn();
      render(
        <StringField
          field={givenFieldDefinition}
          dataTestId={DATA_TEST_ID.STRING_FIELD_INPUT}
          onChange={givenOnChange}
          initialValue="John"
        />
      );

      // THEN the input should show the initial value
      await waitFor(() => {
        const input = screen.getByTestId(DATA_TEST_ID.STRING_FIELD_INPUT);
        expect(input).toHaveValue('John');
      });

      // AND onChange should not be called on mount
      expect(givenOnChange).not.toHaveBeenCalled();
    });

    test("should handle non-required fields correctly", async () => {
      // GIVEN a non-required field
      const field: StringFieldDefinition = {
        name: 'test',
        label: 'Test Label',
        required: false,
        type: FieldType.String,
        dataKey: 'test'
      };
      const givenOnChange = jest.fn();

      // WHEN the field is rendered and cleared
      render(<StringField field={field} dataTestId="test" onChange={givenOnChange} />);
      const input = screen.getByRole('textbox');
      // first set it to a valid value
      fireEvent.change(input, { target: { value: 'hello' } });
      // then clear it
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // THEN onChange should be called with empty value and valid state
      await waitFor(() => {
        expect(givenOnChange).toHaveBeenCalledWith('', true);
      }, { timeout: 300 }); // Wait for debounced validation
    });
  });
}); 