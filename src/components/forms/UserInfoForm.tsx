'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
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
import { Card } from '@/components/ui/Card';
import { UserInfoSchemaType, userInfoSchema } from '@/utils/validations';
import { useUser } from '@/hooks/useUser';

const UserInfoForm = () => {
  const { data: session, update } = useSession();
  const { updateUser } = useUser();

  const [isLoading, setIsLoading] = useState(false); // ✅ Local loading state

  const form = useForm<UserInfoSchemaType>({
    resolver: zodResolver(userInfoSchema),
    defaultValues: {
      username: '',
      email: '',
    },
  });

  // Set form values once session is loaded
  useEffect(() => {
    // console.log("i am session data",session)

    if (session?.user) {
      form.reset({
        username: session.user.name || '',
        email: session.user.email || '',
      });
    }
  }, [session, form]);

  function onSubmit(values: UserInfoSchemaType) {
    try {
      if (!session?.user?.id) {
        toast.error('User not found.');
        return;
      }
      setIsLoading(true); // ✅ Start loading
      updateUser.mutate(
        {
          id: session.user.id,
          userData: { name: values.username },
        },
        {
          onSuccess: async () => {
            await update({ name: values.username }); // ✅ refresh session data
          },
          onSettled: () => {
            setIsLoading(false); // ✅ correct place
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
        <h1 className="text-xl font-semibold">Basic Information</h1>
        <p className="text-muted-foreground text-base font-normal">
          View and update your card details here.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex gap-4 px-6 mb-6 ">
            <div className="w-[50%]">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="w-[50%]">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} className="bg-light-gray" disabled />
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

export default UserInfoForm;
