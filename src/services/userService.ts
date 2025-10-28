import axiosInstance from '@/lib/axios';
import { UpdateUserData, User } from '@/types/interfaces';

class UsersService {
  private baseUrl = '/api/user';

  async updateUser(id: string, userData: UpdateUserData): Promise<User> {
    const { data } = await axiosInstance.put<{ user: User }>(`${this.baseUrl}/${id}`, userData);
    return data.user;
  }
}

export const usersService = new UsersService();
