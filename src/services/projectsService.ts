import { Project } from '@prisma/client';
import axiosInstance from '@/lib/axios';
import { CreateProjectData, UpdateProjectData } from '@/types/interfaces';

class ProjectsService {
  private baseUrl = '/api/projects';

  async getProjects(): Promise<Project[]> {
    const { data } = await axiosInstance.get<Project[]>(this.baseUrl);
    return data;
  }

  async getProject(id: string): Promise<Project> {
    const { data } = await axiosInstance.get<Project>(`${this.baseUrl}/${id}`);
    return data;
  }

  async createProject(projectData: CreateProjectData): Promise<Project> {
    const { data } = await axiosInstance.post<Project>(this.baseUrl, projectData);
    return data;
  }

  async updateProject(id: string, projectData: UpdateProjectData): Promise<Project> {
    const { data } = await axiosInstance.put<Project>(`${this.baseUrl}/${id}`, projectData);
    return data;
  }

  async deleteProject(id: string): Promise<{ message: string; id: string }> {
    const { data } = await axiosInstance.delete(`${this.baseUrl}/${id}`);
    return data;
  }
}

export const projectsService = new ProjectsService();
