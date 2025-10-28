'use client';
import Header from '@/components/Header';
import UserInfoForm from '@/components/forms/UserInfoForm';
import ChangePasswordForm from '@/components/forms/ChangePasswordForm';
import UpdateProfileForm from '@/components/forms/ProfileImageForm';

const AccountSettingScreen = () => {
  return (
    <>
      <Header breadcrumbs={['Home', 'Account Setting']} />

      <div className="mx-[127px] my-10 space-y-6">
        <div className="py-2 space-y-[6px]">
          <h1 className="text-xl font-semibold">Account Setting</h1>
          <p className="text-muted-foreground text-base font-normal">
            View your account details and update your password to keep your account secure.
          </p>
        </div>
        <div className="space-y-[10px]">
          <UpdateProfileForm />
          <UserInfoForm />
          <ChangePasswordForm />
        </div>
      </div>
    </>
  );
};

export default AccountSettingScreen;
