'use client';
import Image from 'next/image';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/Form';
import { Input } from '@/components/ui/Input';
import { loginSchema, LoginSchemaType } from '@/utils/validations';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import routePaths from '@/lib/routePaths';
import { PasswordInput } from '@/components/ui/PasswordInput';

export const LoginForm = ({ className, ...props }: React.ComponentProps<'div'>) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginSchemaType>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginSchemaType) => {
    try {
      setIsLoading(true);

      const response = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (response?.error) {
        toast.error('Invalid credentials. Please try again.');
        return;
      }

      if (response?.ok) {
        toast.success('Logged in successfully!');

        router.push(routePaths.HomeScreen);
        router.refresh();
      }
    } catch (error) {
      console.error('Login error', error);
      toast.error('Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('grid p-0 md:grid-cols-2 gap-6 w-full', className)} {...props}>
      <div className="relative flex flex-col justify-center items-center">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5 p-6 md:p-8 w-full md:max-w-[90%] lg:max-w-[75%] xl:max-w-[60%]"
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col">
                <h1 className="text-xl md:text-3xl font-bold leading-normal">Sign in</h1>
                <p className="text-muted-foreground text-balance text-sm md:text-base">
                  Log in to unlock tailored content and stay connected with your community.
                </p>
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Password" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <div className="bg-muted relative h-[95vh] w-full rounded-xl overflow-hidden hidden md:block">
        <div className="absolute inset-0">
          <Image src="/images/login.png" alt="Login Image" fill priority className="object-cover" />
        </div>
        <div className="text-white absolute bottom-10 lg:bottom-20 left-12 right-12">
          <h1 className="text-[26px] font-semibold mb-1">Welcome to Your Lighting Design Studio</h1>
          <p>
            Upload your floor plan and quickly generate lighting & control packages ready for
            sourcing. Our AI co-pilot applies the best of lighting designer practices to make
            recommendations for your unique spaces.
          </p>
          <p className="mb-2">
            Select, modify with drag-and-drop, and directly export schedules and control plans.
          </p>
          <p>
            No complex software. No steep learning curve. Just fast, visual planning for architects
            and designers.
          </p>
        </div>
      </div>
    </div>
  );
};
