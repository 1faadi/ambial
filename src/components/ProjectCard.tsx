import React, { useState } from 'react';
import Image from 'next/image';
import { EllipsisVertical, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { RxEyeOpen } from 'react-icons/rx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import DeleteConfirmationDialog from '@/components/dialogs/DeleteConfirmationDialog';
import { useRouter } from 'next/navigation';
import { ProjectCardProps } from '@/types/interfaces';
import { getRelativeTime } from '@/lib/utils';
import { useProjects } from '@/hooks/useProjects';
import { toast } from 'sonner';
import routePaths from '@/lib/routePaths';

const ProjectCard = ({ project }: ProjectCardProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const { deleteProject, isDeletingProject } = useProjects();

  const handleCardClick = () => {
    router.push(`${routePaths.DashboardScreen}/${project.id}`);
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteProject(project.id);
      toast.success('Project deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete project');
      console.error('Error deleting project:', error);
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden cursor-pointer" onClick={handleCardClick}>
        {/* Dropdown Menu */}
        <div className="absolute right-5 top-1 z-10 opacity-0 group-hover:opacity-100">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                className="cursor-pointer rounded-md shadow-lg p-2 bg-white"
                onClick={e => e.stopPropagation()}
              >
                <EllipsisVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="absolute top-2">
              <DropdownMenuItem
                onClick={e => {
                  e.stopPropagation();
                  handleCardClick();
                }}
              >
                <RxEyeOpen className="mr-2 h-4 w-4" />
                <span>View</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteClick();
                }}
                className="flex items-center gap-2"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Image Section */}
        <div className="px-[33px] pt-[24px] bg-light-gray">
          <div className="relative h-[250px] w-full">
            <Image src={project.thumbnail ?? '/images/house-map.png'} alt="" fill priority />
          </div>
        </div>

        {/* Text Content */}
        <div className="px-6 py-6 space-y-2">
          <p className="text-base font-medium line-clamp-2 leading-5 min-h-[2.5rem] text-ellipsis">
            {project.name}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {'Last Edit: ' + getRelativeTime(project.updatedAt)}
          </p>
        </div>
      </Card>

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDelete={handleDeleteConfirm}
        isLoading={isDeletingProject}
      />
    </>
  );
};

export default ProjectCard;
