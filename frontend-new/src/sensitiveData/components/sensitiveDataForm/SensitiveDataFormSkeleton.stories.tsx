import type { Meta, StoryObj } from '@storybook/react'
import SensitiveDataFormSkeleton from './SensitiveDataFormSkeleton'

const meta: Meta<typeof SensitiveDataFormSkeleton> = {
  title: 'SensitiveData/SensitiveDataFormSkeleton',
  component: SensitiveDataFormSkeleton,
  tags: ['autodocs'],
  argTypes: {},
}

export default meta

type Story = StoryObj<typeof SensitiveDataFormSkeleton>

export const Shown: Story = {
  args: {},
}