// components/skeletons/AppSidebarSkeleton.tsx
import React from 'react';
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@/components/ui/Sidebar';

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

const AppSidebarSkeleton = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const { state } = useSidebar();
  const isExpanded = state === 'expanded';

  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className="bg-white overflow-hidden ml-4 rounded-[12px] border border-light-gray"
    >
      <SidebarHeader
        className={`flex flex-col items-center border-b border-gray-100 ${isExpanded ? 'p-4' : 'p-2'}`}
      >
        <div className="flex items-center justify-between w-full mb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32 xl:w-48" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden px-2">
        <div
          className={`grid ${isExpanded ? 'grid-cols-2 gap-x-1 gap-y-1' : 'grid-cols-1 gap-x-2 gap-y-2'}`}
        >
          {Array.from({ length: 11 }).map((_, index) => (
            <div
              key={index}
              className="py-[4px] flex gap-1 flex-col items-center rounded-[4px] border border-light-gray opacity-50"
            >
              <div className={`relative px-2 ${isExpanded ? 'h-9 w-11' : 'h-5 w-6'}`}>
                <Skeleton className="w-full h-full" />
              </div>
              {isExpanded && <Skeleton className="h-4 w-16" />}
            </div>
          ))}
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebarSkeleton;
