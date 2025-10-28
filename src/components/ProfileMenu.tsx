'use client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu';
import { signOut } from 'next-auth/react';
import ProfileAvatar from './ProfileAvatar';
import { useRouter } from 'next/navigation';
import {
  AlignEndVertical,
  AlignVerticalDistributeCenter,
  LogOut,
  UserRoundPen,
} from 'lucide-react';

import { useState } from 'react';

interface ProfileMenuProps {
  onSave?: () => Promise<void>;
}

const ProfileMenu = ({ onSave }: ProfileMenuProps) => {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const runWithSave = async (next: () => Promise<void> | void) => {
    if (isPending) return;
    try {
      setIsPending(true);
      if (onSave) {
        await onSave();
      }
      await Promise.resolve(next());
    } finally {
      setIsPending(false);
    }
  };

  const handleLogout = async () => {
    await runWithSave(() => signOut({ redirect: true, callbackUrl: '/' }));
  };
  const handleAccountSetting = () => {
    runWithSave(() => {
      router.push('/account-setting');
    });
  };
  const handleFixtureLibrary = () => {
    runWithSave(() => {
      router.push('/fixture-library');
    });
  };

  const handleMixLibrary = () => {
    runWithSave(() => {
      router.push('/mix-library');
    });
  };

  return (
    <div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger>
          <ProfileAvatar />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={handleFixtureLibrary}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors"
            disabled={isPending}
          >
            <AlignEndVertical className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Fixture Library</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleMixLibrary}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors"
            disabled={isPending}
          >
            <AlignVerticalDistributeCenter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Mix Library</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleAccountSetting}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors"
            disabled={isPending}
          >
            <UserRoundPen className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Account Settings</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors"
            disabled={isPending}
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ProfileMenu;
