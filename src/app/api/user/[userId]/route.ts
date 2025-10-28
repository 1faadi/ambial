import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { userId } = await params;

    if (userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, password, profileImage } = body;

    const updateData: Prisma.UserUpdateInput = {};

    if (name) updateData.name = name;
    if (profileImage) updateData.profileImage = profileImage;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json(
        { message: 'Failed to update user', error: error.message },
        { status: 500 }
      );
    }
    console.error('Error updating user:', error);
    return NextResponse.json(
      { message: 'Failed to update user', error: 'Unknown error' },
      { status: 500 }
    );
  }
}
