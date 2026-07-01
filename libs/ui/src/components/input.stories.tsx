import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "./ui/input";
import { Label } from "./ui/label";

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "name@example.com" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { "aria-invalid": true } };

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" {...args} />
    </div>
  ),
};
