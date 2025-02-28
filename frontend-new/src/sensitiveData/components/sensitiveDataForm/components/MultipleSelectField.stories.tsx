import { Meta, StoryObj } from '@storybook/react';
import MultipleSelectField from './MultipleSelectField';
import { MultipleSelectFieldDefinition, FieldType } from 'src/sensitiveData/components/sensitiveDataForm/config/types';
import { action } from '@storybook/addon-actions';
import { Box } from '@mui/material';

// Create a wrapper component with fixed width
const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: '400px' }}>
    {children}
  </Box>
);

const meta: Meta<typeof MultipleSelectField> = {
  title: 'SensitiveData/Fields/MultipleField',
  component: MultipleSelectField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <FixedWidthWrapper>
        <Story />
      </FixedWidthWrapper>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MultipleSelectField>;

// Define field definitions for the mock config
const skillsField: MultipleSelectFieldDefinition = {
  name: 'skills',
  dataKey: 'skills',
  type: FieldType.MultipleSelect,
  label: 'Skills',
  required: true,
  values: [
    'JavaScript',
    'TypeScript',
    'React',
    'Angular',
    'Vue',
    'Node.js'
  ]
};

const languagesField: MultipleSelectFieldDefinition = {
  name: 'languages',
  dataKey: 'languages',
  type: FieldType.MultipleSelect,
  label: 'Languages',
  required: true,
  values: [
    'English',
    'Spanish',
    'French',
    'German',
    'Chinese',
    'Japanese'
  ]
};

export const Default: Story = {
  args: {
    field: skillsField,
    dataTestId: 'test-skills',
    initialValue: [],
    onChange: (values: string[]) => action('onChange')(values),
  },
};

export const WithInitialValues: Story = {
  args: {
    ...Default.args,
    initialValue: ['JavaScript', 'TypeScript'],
  },
};

export const NotRequired: Story = {
  args: {
    ...Default.args,
    field: {
      ...skillsField,
      required: false,
    },
  },
};

export const Languages: Story = {
  args: {
    field: languagesField,
    dataTestId: 'test-languages',
    initialValue: [],
    onChange: (values: string[]) => action('onChange')(values),
  },
}; 