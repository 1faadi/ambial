import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsService } from '@/services/projectsService';
import { CreateProjectData, Project, UpdateProjectData } from '@/types/interfaces';

// Query keys
const PROJECTS_QUERY_KEY = 'projects';
const PROJECT_QUERY_KEY = (id: string) => ['project', id];

export function useProjects() {
  const queryClient = useQueryClient();

  // Get all projects
  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: [PROJECTS_QUERY_KEY],
    queryFn: () => projectsService.getProjects(),
  });

  // Get a single project
  const useProject = (id: string) => {
    return useQuery({
      queryKey: PROJECT_QUERY_KEY(id),
      queryFn: () => projectsService.getProject(id),
      enabled: !!id,
    });
  };

  // Create project mutation
  const createProject = useMutation({
    mutationFn: (data: CreateProjectData) => projectsService.createProject(data),
    onSuccess: newProject => {
      queryClient.setQueryData([PROJECTS_QUERY_KEY], (oldData: Project[]) =>
        oldData ? [...oldData, newProject] : [newProject]
      );
    },
  });

  // Update project mutation
  const updateProject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectData }) =>
      projectsService.updateProject(id, data),
    onSuccess: updatedProject => {
      queryClient.setQueryData([PROJECTS_QUERY_KEY], (oldData: Project[]) => {
        if (!oldData) return oldData;
        // Remove the existing project (if present)
        const otherProjects = oldData.filter(project => project.id !== updatedProject.id);

        // Find the existing project to compare
        const existingProject = oldData.find(project => project.id === updatedProject.id);

        let newProject: Project;

        if (existingProject) {
          if (existingProject.name !== updatedProject.name) {
            // Only update the name
            newProject = {
              ...existingProject,
              name: updatedProject.name,
              updatedAt: updatedProject.updatedAt,
            };
          } else {
            // Replace the whole object
            newProject = updatedProject;
          }
        } else {
          // Project was not in list — treat as new
          newProject = updatedProject;
        }

        // Add updated project to the front
        return [newProject, ...otherProjects];
      });

      // Update the individual project cache
      queryClient.setQueryData(PROJECT_QUERY_KEY(updatedProject.id), updatedProject);
    },
  });

  // Delete project mutation
  const deleteProject = useMutation({
    mutationFn: (id: string) => projectsService.deleteProject(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData([PROJECTS_QUERY_KEY], (oldData: Project[]) =>
        oldData ? oldData.filter(project => project.id !== deletedId) : []
      );
      queryClient.removeQueries({ queryKey: PROJECT_QUERY_KEY(deletedId) });
    },
  });

  const resetQuery = (id: string) => {
    queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEY(id) });
  };

  return {
    // Queries
    projects,
    isLoadingProjects,
    useProject,
    resetQuery,

    // Mutations
    createProject: createProject.mutateAsync,
    isCreatingProject: createProject.isPending,
    createProjectError: createProject.error,

    updateProject: updateProject.mutateAsync,
    isUpdatingProject: updateProject.isPending,
    updateProjectError: updateProject.error,

    deleteProject: deleteProject.mutateAsync,
    isDeletingProject: deleteProject.isPending,
    deleteProjectError: deleteProject.error,
  };
}
