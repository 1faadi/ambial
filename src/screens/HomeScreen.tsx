'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import FileUploadDialog from '@/components/dialogs/FileUploadDialog';
import ProjectCard from '@/components/ProjectCard';
import { useProjects } from '@/hooks/useProjects';
import ProjectCardSkeleton from '@/components/skeletons/ProjectCardSkeleton';
import { Project } from '@/types/interfaces';
import Header from '@/components/Header';
import { clearPixelToFeetRatio, clearShapeSizes } from '@/store/slices/canvasSlice';
import { useDispatch } from 'react-redux';

const HomeScreen = () => {
  const [visibleCount, setVisibleCount] = useState(6);
  const { projects, isLoadingProjects } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(clearPixelToFeetRatio());
    dispatch(clearShapeSizes());
  }, []);

  useEffect(() => {
    if (!isLoadingProjects) {
      const filteredTempProjects = projects!.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProjects(filteredTempProjects);
    }
  }, [projects, searchTerm, isLoadingProjects]);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 6);
  };

  return (
    <div>
      <Header breadcrumbs={['Home']} />
      <div className="md:px-14 2xl:px-20 max-w-[1800px] mx-auto">
        {' '}
        <div className="px-4 py-8">
          <div className="flex flex-col justify-center text-center gap-[34px]">
            <h1 className="text-[26px] md:text-[40px] font-bold leading-none">
              Professional-Grade Lighting Plans for Your Floor Plans
            </h1>
            <p className="text-muted-foreground text-sm md:text-base font-normal">
              Upload a Image of floor Plan, drag and drop lighting elements, and export your design
              in minutes
            </p>
            <div className="px-3 py-3 flex gap-2 items-center w-full max-w-[730px] mx-auto border rounded-md">
              <Search className="h-[18px] w-[18px] text-muted-foreground" />
              <input
                disabled={isLoadingProjects}
                type="search"
                placeholder="Search"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent outline-none border-none focus:ring-0"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <h2 className="text-[20px] md:text-[30px] font-semibold">Recent Items</h2>
            <FileUploadDialog />
          </div>

          {isLoadingProjects ? (
            <div className="py-4">
              <div className="grid gap-x-16 gap-y-[34px] grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <ProjectCardSkeleton key={index} />
                ))}
              </div>
            </div>
          ) : filteredProjects && filteredProjects.length > 0 ? (
            <div className="py-4">
              <div className="grid gap-x-16 gap-y-[34px] grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.slice(0, visibleCount).map((project, index) => (
                  <ProjectCard key={index} project={project} />
                ))}
              </div>

              {visibleCount < filteredProjects.length && (
                <div className="pt-[34px] flex justify-center items-center">
                  <Button className="px-6 py-5 cursor-pointer" onClick={handleLoadMore}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="flex flex-col items-center text-center space-y-2">
                <Image src="/svg/box.svg" alt="box" priority height={162} width={141} />
                <p className="text-muted-foreground text-base md:text-xl">No items are found</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
