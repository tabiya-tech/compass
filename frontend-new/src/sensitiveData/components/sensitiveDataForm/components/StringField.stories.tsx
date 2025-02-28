import { Meta, StoryObj } from '@storybook/react';
import StringField from './StringField';
import { FieldType, StringFieldDefinition } from 'src/sensitiveData/components/sensitiveDataForm/config/types';

const meta: Meta<typeof StringField> = {
  title: 'SensitiveData/Fields/StringField',
  component: StringField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StringField>;

const defaultField: StringFieldDefinition = {
  name: 'firstName',
  dataKey: 'firstName',
  type: FieldType.String,
  label: 'First Name',
  required: true,
  validation: {
    pattern: '^[A-Za-z\\s]{2,50}$',
    errorMessage: 'First name should contain only letters and be 2-50 characters long'
  }
};

export const Default: Story = {
  args: {
    field: defaultField,
    dataTestId: 'test-first-name',
    initialValue: '',
    onChange: (value: string) => console.log('Value changed:', value),
  },
};

export const WithInitialValue: Story = {
  args: {
    ...Default.args,
    initialValue: 'John',
  },
};

export const WithValidation: Story = {
  args: {
    ...Default.args,
    field: {
      ...defaultField,
      validation: {
        pattern: '^[A-Za-z]{3,10}$',
        errorMessage: 'Must be 3-10 letters only'
      }
    },
  },
};

export const NotRequired: Story = {
  args: {
    ...Default.args,
    field: {
      ...defaultField,
      required: false,
    },
  },
};

export const NumberField: Story = {
  args: {
    field: {
      name: 'age',
      dataKey: 'age',
      type: FieldType.String,
      label: 'Age',
      required: true,
      validation: {
        pattern: '^(1[8-9]|[2-9][0-9]|1[0-1][0-9]|120)$',
        errorMessage: 'Please enter a valid age between 18 and 120'
      }
    } as StringFieldDefinition,
    dataTestId: 'test-age',
    initialValue: '',
    onChange: (value: string) => console.log('Value changed:', value),
  },
};

export const EmailField: Story = {
  args: {
    field: {
      name: 'email',
      dataKey: 'email',
      type: FieldType.String,
      label: 'Email Address',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        errorMessage: 'Please enter a valid email address'
      }
    } as StringFieldDefinition,
    dataTestId: 'test-email',
    initialValue: '',
    onChange: (value: string) => console.log('Value changed:', value),
  },
};

export const PhoneField: Story = {
  args: {
    field: {
      name: 'phoneNumber',
      dataKey: 'phoneNumber',
      type: FieldType.String,
      label: 'Phone Number',
      required: true,
      validation: {
        pattern: '^\\+?[0-9]{10,15}$',
        errorMessage: 'Please enter a valid phone number (10-15 digits, may start with +)'
      }
    } as StringFieldDefinition,
    dataTestId: 'test-phone',
    initialValue: '',
    onChange: (value: string) => console.log('Value changed:', value),
  },
}; 