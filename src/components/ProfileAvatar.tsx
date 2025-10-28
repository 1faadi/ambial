'use client';
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { useSession } from 'next-auth/react';

interface ProfileAvatarProps {
  previewImage?: string | null;
  className?: string;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ previewImage, className }) => {
  const { data: session } = useSession();

  // Priority: previewImage > session profileImage > session image > default
  const imageSource =
    previewImage ||
    session?.user?.profileImage ||
    session?.user?.image ||
    'https://github.com/shadcn.png';

  // Generate fallback initials from user name
  const generateInitials = (name: string | null | undefined): string => {
    if (!name) return 'CN';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = generateInitials(session?.user?.name);

  return (
    <Avatar className={`h-10 w-10 cursor-pointer ${className}`}>
      <AvatarImage src={imageSource} alt="Profile" />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
};

export default ProfileAvatar;
