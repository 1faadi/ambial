import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();

    // Ensure the fixture exists and belongs to the current user before updating
    const existing = await prisma.fixture.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.fixture.update({
      where: { id },
      data: {
        fixtureType: body.fixtureType,
        modelName: body.modelName,
        sizeIn: body.sizeIn ?? null,
        manufacturer: body.manufacturer,
        price: body.price ?? null,
        lumens: body.lumens ?? null,
        peakPowerW: body.peakPowerW ?? null,
        maxVoltageV: body.maxVoltageV ?? null,
        maxCurrentA: body.maxCurrentA ?? null,
        minPWM: body.minPWM ?? null,
        maxPWM: body.maxPWM ?? null,
        dimmingMode: body.dimmingMode,
        dimmingCurve: body.dimmingCurve,
        minCCT: body.minCCT ?? null,
        midCCT: body.midCCT ?? null,
        maxCCT: body.maxCCT ?? null,
        sidebarId: body.sidebarId ?? undefined,
        channelCount: body.channelCount ?? undefined,
        dimmingGamma: body.dimmingGamma ?? null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating fixture:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { id } = await params;
    const existing = await prisma.fixture.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.fixture.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting fixture:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
