'use client';

import * as React from 'react';
import { Input } from '@/components/ui/Input';
import { Eye, EyeOff } from 'lucide-react';

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(({ type, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-2 top-2 text-muted-foreground"
      >
        {visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
