import * as React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'destructive' | 'success';
}

/**
 * Submission-level feedback banner — used for API-response errors that
 * aren't tied to a single field (e.g. "Unable to evaluate this lead right
 * now"). Field-level errors use FieldError instead.
 */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'destructive', children, ...props }, ref) => {
    const Icon = variant === 'success' ? CheckCircle2 : AlertTriangle;
    return (
      <div
        ref={ref}
        role={variant === 'destructive' ? 'alert' : 'status'}
        className={cn(
          'flex items-start gap-2.5 rounded-md border px-4 py-3 text-sm',
          variant === 'destructive' && 'border-destructive/30 bg-destructive/10 text-destructive',
          variant === 'success' && 'border-success/30 bg-success/10 text-success',
          className,
        )}
        {...props}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>{children}</div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';

export { Alert };
