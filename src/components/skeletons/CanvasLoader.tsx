import { SidebarInset } from '@/components/ui/Sidebar';

const CanvasLoader = () => {
  return (
    <SidebarInset className="h-[calc(100vh-88px)] overflow-hidden ml-6 mr-4 bg-[#F7F7F7]">
      <div className="h-full w-full flex justify-center items-center">
        <div className="w-[100%] h-[100%] bg-white shadow-lg rounded-[12px] border border-gray-300 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              <div className="text-gray-600 text-lg font-medium">Loading Canvas...</div>
              <div className="text-gray-400 text-sm">Preparing your workspace</div>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
};

export default CanvasLoader;
