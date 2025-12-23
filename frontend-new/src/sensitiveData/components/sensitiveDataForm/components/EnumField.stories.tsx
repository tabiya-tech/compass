import { Meta, StoryObj } from "@storybook/react";
import EnumField from "./EnumField";
import { EnumFieldDefinition, FieldType } from "src/sensitiveData/components/sensitiveDataForm/config/types";
import { action } from "@storybook/addon-actions";
import { Box } from "@mui/material";

// Create a wrapper component with fixed width
const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "400px" }}>{children}</Box>
);

const meta: Meta<typeof EnumField> = {
  title: "SensitiveData/Fields/EnumField",
  component: EnumField,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <FixedWidthWrapper>
        <Story />
      </FixedWidthWrapper>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EnumField>;

// Define field definitions for the mock config
const countyField: EnumFieldDefinition = {
  name: "county",
  dataKey: "county",
  type: FieldType.Enum,
  label: "County",
  required: true,
  values: ["County 1", "County 2", "County 3"],
};

const defaultField: EnumFieldDefinition = {
  name: "gender",
  dataKey: "gender",
  type: FieldType.Enum,
  label: "Gender",
  required: true,
  values: ["Male", "Female", "Other", "Prefer not to say"],
};

export const Default: Story = {
  args: {
    field: defaultField,
    dataTestId: "test-gender",
    initialValue: "",
    onChange: (value: string) => action("onChange")(value),
  },
};

export const WithInitialValue: Story = {
  args: {
    ...Default.args,
    initialValue: "Male",
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

export const County: Story = {
  args: {
    field: countyField,
    dataTestId: "test-county",
    initialValue: "",
    onChange: (value: string) => action("onChange")(value),
  },
};
