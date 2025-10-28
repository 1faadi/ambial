import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card } from '@/components/ui/Card';
import { Upload, MessageCircleWarning, CirclePlus, CircleX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadProjectSchema, UploadProjectFormData } from '@/utils/validations';
import { useDispatch } from 'react-redux';
import { setFileState } from '@/store/slices/fileSlice';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/hooks/useProjects';
import { toast } from 'sonner';
import routePaths from '@/lib/routePaths';

const FileUploadDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const { createProject, isCreatingProject } = useProjects();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(uploadProjectSchema),
    defaultValues: {
      projectName: '',
      file: null,
    },
  });

  const selectedFile = watch('file');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setValue('file', file, { shouldValidate: true });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setValue('file', e.target.files[0], { shouldValidate: true });
    }
  };

  const onSubmit = async (data: UploadProjectFormData) => {
    try {
      setIsUploading(true);

      // Create the project first

      if (data.file) {
        const reader = new FileReader();
        reader.onloadend = async e => {
          const response = await createProject({
            name: data.projectName,
          });
          dispatch(
            setFileState({
              file: e.target?.result as string,
              fileName: data.projectName,
            })
          );
          toast.success('Project created successfully');
          router.push(`${routePaths.DashboardScreen}/${response.id}`);
          reset();
          setIsOpen(false);
        };
        reader.readAsDataURL(data.file);
      }
    } catch (error) {
      toast.error('Failed to create project');
      console.error('Error creating project:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form when dialog is closed (either by X icon or Cancel button)
      reset();
      setDragActive(false);
    }
    setIsOpen(open);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button className="cursor-pointer">
            <CirclePlus />
            Create
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="px-6 pt-6">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold leading-none">
                  Create a new project
                </DialogTitle>
                <DialogDescription className="text-base text-muted-foreground">
                  Drag and drop files to create a new project
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-3">
                <div className="grid gap-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    placeholder="New Building Project Architecture Plan"
                    className="w-full"
                    {...register('projectName')}
                  />
                  {errors.projectName && (
                    <p className="text-sm text-red-500">{errors.projectName.message}</p>
                  )}
                </div>
                <div className="mt-2">
                  <div
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer transition ${
                      dragActive
                        ? 'border-blue-400 bg-blue-50'
                        : errors.file
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('fileUpload')?.click()}
                  >
                    <div className="flex flex-col items-center text-center pointer-events-none">
                      <div className="mb-4 h-13 w-13 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                        <Upload className="h-6 w-6 text-[#737373]" />
                      </div>
                      {selectedFile && selectedFile instanceof File ? (
                        <div>
                          <p className="mb-1 text-sm font-medium text-green-600">
                            {selectedFile.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="mb-1 text-sm font-medium">Drop a image file</p>
                          <p className="text-sm font-medium">
                            <span className="text-muted-foreground">or</span>, click to browse{' '}
                            <span className="text-muted-foreground">(4MB max)</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      id="fileUpload"
                      type="file"
                      accept=".png,.jpg,.jpeg"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                  {errors.file && (
                    <p className="text-sm text-red-500 mt-2">{errors.file.message}</p>
                  )}
                </div>
              </div>
            </div>
            {!isUploading ? (
              <div className="bg-[#F5F5F5] p-6">
                <DialogFooter className="w-full flex justify-between sm:justify-between">
                  <div className="flex gap-2 items-center">
                    <MessageCircleWarning className="h-[16px] w-[16px] text-[#737373]" />
                    <p className="text-muted-foreground text-sm">Need Help?</p>
                  </div>
                  <div className="space-x-[10px]">
                    <Button
                      className="cursor-pointer"
                      variant="outline"
                      type="button"
                      onClick={handleCancel}
                      disabled={isCreatingProject}
                    >
                      Cancel
                    </Button>
                    <Button className="cursor-pointer" type="submit" disabled={isCreatingProject}>
                      {isCreatingProject ? 'Creating...' : 'Continue'}
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            ) : (
              <div className="p-6">
                <Card className="p-4 gap-2">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <h2 className="font-semibold text-xs">Creating Project...</h2>
                      <p className="text-[#6D6D6D] text-xs">Please wait</p>
                    </div>
                    <CircleX className="h-5 w-5 fill-red-200 text-red-600" />
                  </div>
                  <Progress value={65} className="h-4" />
                </Card>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FileUploadDialog;
