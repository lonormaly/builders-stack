// The single public door for the web component layer.
// Tokens live behind the separate `@stack/ui/tokens` entry (framework-agnostic,
// safe for React Native) but are re-exported here for web convenience.

export { cn } from "./lib/cn";

export { Button, buttonVariants } from "./components/ui/button";
export type { ButtonProps } from "./components/ui/button";
export { Badge, badgeVariants } from "./components/ui/badge";
export type { BadgeProps } from "./components/ui/badge";
export { Input } from "./components/ui/input";
export { Label } from "./components/ui/label";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./components/ui/card";
export { ConsentBanner } from "./components/ui/consent-banner";
export type { ConsentBannerProps } from "./components/ui/consent-banner";
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";

export { tokens, colors, brand, spacing, radii, typography } from "./tokens/index";
export type { Tokens, ColorTheme, ColorRole } from "./tokens/index";
