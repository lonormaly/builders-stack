import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Project Aurora</CardTitle>
        <CardDescription>Ships to production this week.</CardDescription>
        <CardAction>
          <Badge variant="secondary">Beta</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        A quick summary of what changed and what to watch on rollout.
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost">Dismiss</Button>
        <Button>Open</Button>
      </CardFooter>
    </Card>
  ),
};

export const LoginForm: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your work email to continue.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" placeholder="name@example.com" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">Password</Label>
          <Input id="login-password" type="password" />
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Continue</Button>
      </CardFooter>
    </Card>
  ),
};
