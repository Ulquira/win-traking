import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 font-sans',
  {
    variants: {
      variant: {
        default: 'bg-[#FF5A0A] text-white hover:bg-[#e04c06] shadow-[0px_4px_8px_rgba(255,90,10,0.24)]',
        secondary: 'bg-[#f2f2f2] text-[#0F090B] hover:bg-[#e8e7e8] shadow-[0px_4px_8px_rgba(0,0,0,0.1)] font-normal',
        outline: 'border border-[#FF5A0A] bg-transparent text-[#FF5A0A] hover:bg-[#FFF5F0]',
        destructive: 'bg-error text-white hover:bg-red-700',
        ghost: 'hover:bg-gray-100',
        link: 'text-[#FF5A0A] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-14 px-8 py-3 text-[20px] font-medium',
        sm: 'h-10 rounded-full px-6 text-[16px] font-medium',
        lg: 'h-16 rounded-full px-10 text-[20px] font-bold',
        icon: 'h-14 w-14',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
