import { useMutation } from '@tanstack/react-query';
import { usersService } from '@/services/userService';
import { UpdateUserData } from '@/types/interfaces';
import { toast } from 'sonner';

export const useUser = () => {
  const updateUser = useMutation({
    mutationFn: ({ id, userData }: { id: string; userData: UpdateUserData }) =>
      usersService.updateUser(id, userData),
    onSuccess: () => {
      toast.success('User updated successfully');
    },
  });

  return {
    updateUser,
  };
};
