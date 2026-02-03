import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:brightness-105 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:brightness-100 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
           // @replit: no hover, and add primary border
           "bg-primary text-primary-foreground border border-primary-border",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border-destructive-border",
        outline:
          // @replit Shows the background color of whatever card / sidebar / accent background it is inside of.
          // Inherits the current text color. Uses shadow-xs. no shadow on active
          // No hover state
          " border [border-color:var(--button-outline)] shadow-xs active:shadow-none ",
        secondary:
          // @replit border, no hover, no shadow, secondary border.
          "border bg-secondary text-secondary-foreground border border-secondary-border ",
        // @replit no hover, transparent border
        ghost: "border border-transparent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // @replit changed sizes
        default: "min-h-9 px-4 py-2 [&_svg]:h-4 [&_svg]:w-4",
        sm: "min-h-8 rounded-md px-3 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5",
        lg: "min-h-10 rounded-md px-8 text-base [&_svg]:h-5 [&_svg]:w-5",
        icon: "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingLabel?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingLabel = "Loading", children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    const isDisabled = Boolean(disabled || loading)
    const loaderSizeClass =
      size === "lg" ? "h-5 w-5" : size === "sm" ? "h-4 w-4" : size === "icon" ? "h-4 w-4" : "h-4 w-4"

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(!asChild ? { disabled: isDisabled } : { "aria-disabled": isDisabled })}
        aria-busy={loading || undefined}
        aria-label={loading ? loadingLabel : props["aria-label"]}
        {...props}
      >
        <span className={cn("inline-flex items-center justify-center gap-2", loading ? "opacity-0" : "")}>{children}</span>
        {loading ? (
          <span className="absolute inset-0 grid place-items-center">
            <Loader2 className={cn("animate-spin", loaderSizeClass)} aria-hidden="true" />
          </span>
        ) : null}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
