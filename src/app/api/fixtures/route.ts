import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithFixtures = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        fixtures: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!userWithFixtures) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(userWithFixtures.fixtures);
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      fixtureType,
      modelName,
      sizeIn,
      manufacturer,
      price,
      lumens,
      peakPowerW,
      maxVoltageV,
      maxCurrentA,
      minPWM,
      maxPWM,
      dimmingMode,
      dimmingCurve,
      minCCT,
      midCCT,
      maxCCT,
      sidebarId,
      channelCount,
      dimmingGamma,
    } = body;

    if (!fixtureType || !modelName || !manufacturer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find the next sequential ID (reuse gaps from deleted fixtures)
    let nextSequentialId = 1;

    // Get all existing sequential IDs for this user
    const existingFixtures = await prisma.fixture.findMany({
      where: { userId: user.id },
      select: { sequentialId: true },
      orderBy: { sequentialId: 'asc' },
    });

    // Find the first gap in the sequence
    for (const fixture of existingFixtures) {
      if (fixture.sequentialId === nextSequentialId) {
        nextSequentialId++;
      } else {
        break; // Found a gap, use nextSequentialId
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        fixtures: {
          create: {
            sequentialId: nextSequentialId,
            fixtureType,
            modelName,
            sizeIn: sizeIn ?? null,
            manufacturer,
            price: price ?? null,
            lumens: lumens ?? null,
            peakPowerW: peakPowerW ?? null,
            maxVoltageV: maxVoltageV ?? null,
            maxCurrentA: maxCurrentA ?? null,
            minPWM: minPWM ?? null,
            maxPWM: maxPWM ?? null,
            dimmingMode,
            dimmingCurve,
            minCCT: minCCT ?? null,
            midCCT: midCCT ?? null,
            maxCCT: maxCCT ?? null,
            sidebarId: sidebarId ?? null,
            channelCount: channelCount ?? null,
            dimmingGamma: dimmingGamma ?? null,
          },
        },
      },
      include: {
        fixtures: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return NextResponse.json(updated.fixtures[0]);
  } catch (error) {
    console.error('Error creating fixture:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
