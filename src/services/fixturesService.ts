import axiosInstance from '@/lib/axios';
import { Fixture } from '@prisma/client';
import { CreateFixtureData } from '@/types/interfaces';

class FixturesService {
  private baseUrl = '/api/fixtures';

  async getFixtures(): Promise<Fixture[]> {
    const { data } = await axiosInstance.get<Fixture[]>(this.baseUrl);
    return data;
  }

  async createFixture(payload: CreateFixtureData): Promise<Fixture> {
    const { data } = await axiosInstance.post<Fixture>(this.baseUrl, payload);
    return data;
  }

  async updateFixture(id: string, payload: Partial<CreateFixtureData>): Promise<Fixture> {
    const { data } = await axiosInstance.patch<Fixture>(`${this.baseUrl}/${id}`, payload);
    return data;
  }

  async deleteFixture(id: string): Promise<void> {
    await axiosInstance.delete(`${this.baseUrl}/${id}`);
  }
}

export const fixturesService = new FixturesService();
