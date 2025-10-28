'use client';
import { AppSidebar } from '@/components/AppSidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/Sidebar';
import { CanvasProvider } from '@/context/canvasContext';
import { RulerProvider } from '@/context/rulerContext';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-screen bg-[#F7F7F7]">
      <CanvasProvider>
        <RulerProvider>
          <DashboardHeader />
          <div className="flex-1 overflow-hidden ">
            <SidebarProvider>
              <AppSidebar />

              {children}
            </SidebarProvider>
          </div>
        </RulerProvider>
      </CanvasProvider>
    </div>
  );
}
