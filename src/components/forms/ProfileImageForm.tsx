import React from 'react';
import { Card } from '@/components/ui/Card';
import ProfileAvatar from '@/components/ProfileAvatar';
import { Button } from '@/components/ui/Button';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

const ProfileImageForm = () => {
  const { updateUser } = useUser();
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      try {
        const base64Image = await convertToBase64(file);
        setPreviewImage(base64Image);
      } catch (error) {
        console.error('Error processing image:', error);
        toast.error('Failed to process image');
      }
    }
  };

  const handleSave = async () => {
    if (!previewImage) {
      toast.error('Please select an image first');
      return;
    }

    if (!session?.user?.id) {
      toast.error('User not found');
      return;
    }

    try {
      setIsLoading(true);

      updateUser.mutate(
        {
          id: session.user.id,
          userData: { profileImage: previewImage },
        },
        {
          onSuccess: async () => {
            // Force session refresh to get updated profileImage from database
            await update();
            setPreviewImage(null);
          },
          onError: error => {
            console.error('Failed to update profile image:', error);
            toast.error('Failed to update profile image');
          },
          onSettled: () => {
            setIsLoading(false);
          },
        }
      );
    } catch (error) {
      console.error('Error updating profile image:', error);
      toast.error('Failed to update profile image');
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-light-gray">
      <div className="p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Profile Image</h1>
          <p className="text-muted-foreground text-base font-normal">
            Avatar is your profile picture - Upload your Latest picture
          </p>
        </div>
        <div className="py-6 flex items-center gap-4">
          <ProfileAvatar previewImage={previewImage} />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            className="cursor-pointer"
            variant="outline"
            onClick={handleUploadClick}
            disabled={isLoading}
          >
            <Upload className="mr-2" /> Upload
          </Button>
        </div>
      </div>
      <hr className="border border-light-gray" />
      <div className="py-4 pr-6 flex justify-end">
        <Button
          className="cursor-pointer"
          onClick={handleSave}
          disabled={isLoading || !previewImage}
        >
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Card>
  );
};

export default ProfileImageForm;
