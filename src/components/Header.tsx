import ProfileMenu from '@/components/ProfileMenu';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { FC } from 'react';
import { HeaderProps } from '@/types/interfaces';
import Link from 'next/link';

const Header: FC<HeaderProps> = ({ breadcrumbs }) => {
  return (
    <header className="flex justify-between items-center px-4 py-[10px] border-b">
      <div className="flex items-center gap-2">
        <div className="relative h-[44px] w-[44px]">
          <Image src="/images/ambial_logo.png" alt="" fill priority />
        </div>
        <div className="flex items-center gap-4">
          <div className="border h-[15px]"></div>
          {breadcrumbs.map((breadcrumb, index) => (
            <div key={index} className="flex gap-[10px] items-center">
              <Link
                href={index === 0 ? '/home' : index === 1 ? '#' : '#'}
                className="text-sm text-muted-foreground font-normal"
              >
                {breadcrumb}
              </Link>
              <ChevronRight className="text-muted-foreground h-6 w-6" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <ProfileMenu />
      </div>
    </header>
  );
};

export default Header;
