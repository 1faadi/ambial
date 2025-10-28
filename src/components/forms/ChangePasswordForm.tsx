'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/Form';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Card } from '@/components/ui/Card';
import { changePasswordSchema, ChangePasswordSchemaType } from '@/utils/validations';
import { useUser } from '@/hooks/useUser';
import { useSession } from 'next-auth/react';

const ChangePasswordForm = () => {
  const { data: session } = useSession();
  const { updateUser } = useUser();
  const [isLoading, setIsLoading] = useState(false); // ✅ Local loading state

  const form = useForm<ChangePasswordSchemaType>({
    resolver: zodResolver(changePasswordSchema),
  });

  function onSubmit(values: ChangePasswordSchemaType) {
    try {
      if (!session?.user?.id) {
        toast.error('User not found.');
        return;
      }

      const { newpassword } = values;

      setIsLoading(true);

      updateUser.mutate(
        {
          id: session.user.id,
          userData: { password: newpassword },
        },
        {
          onSettled: () => {
            setIsLoading(false);
          },
          onSuccess: () => {
            form.reset(); // Optional: reset the form after success
          },
        }
      );
    } catch (error) {
      console.error('Form submission error', error);
      toast.error('Failed to submit the form. Please try again.');
    }
  }

  return (
    <Card className="border border-light-gray">
      <div className="space-y-1 p-6">
        <h1 className="text-xl font-semibold">Change Password</h1>
        <p className="text-muted-foreground text-base font-normal">
          update your password to keep secure your account
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex gap-4 px-6 mb-6 ">
            <div className="w-[50%]">
              <FormField
                control={form.control}
                name="newpassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="w-[50%]">
              <FormField
                control={form.control}
                name="confirmpassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="confirm password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <hr className="border border-light-gray" />
          <div className="py-4 pr-6 flex justify-end">
            <Button
              className="cursor-pointer"
              type="submit"
              disabled={isLoading || !form.formState.isDirty}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
};

export default ChangePasswordForm;
