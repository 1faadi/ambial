import React from 'react';
import Image from 'next/image';
import { LoginForm } from '@/components/forms/LoginForm';

const LoginScreen = () => {
  return (
    <div className="relative min-h-screen p-4 flex justify-center items-center ">
      <div className="absolute top-4 left-4 md:top-6 md:left-6 lg:top-8 lg:left-8 xl:top-10 xl:left-10 2xl:top-15 2xl:left-15">
        <Image src="/images/ambial_logo.png" alt="logo" height={74} width={74} priority />
      </div>
      <LoginForm />
    </div>
  );
};

export default LoginScreen;
