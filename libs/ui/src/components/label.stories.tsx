import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "./ui/label";
import { Input } from "./ui/input";

const meta = {
  title: "Components/Label",
  component: Label,
  tags: ["autodocs"],
  args: { children: "Email address" },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithControl: Story = {
  render: (args) => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="name" {...args}>
        Full name
      </Label>
      <Input id="name" placeholder="Ada Lovelace" />
    </div>
  ),
};
