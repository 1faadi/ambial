import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📋 GET /api/manufacturers - Start');

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('❌ Unauthorized - No session or email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Fetching manufacturers...');
    const manufacturers = await prisma.manufacturer.findMany({
      orderBy: { name: 'asc' },
    });

    console.log(`✅ Found ${manufacturers.length} manufacturers`);
    return NextResponse.json(manufacturers);
  } catch (error) {
    console.error('❌ Error fetching manufacturers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log('➕ POST /api/manufacturers - Start');

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('❌ Unauthorized - No session or email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Request body:', body);

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      console.log('❌ Invalid manufacturer name');
      return NextResponse.json({ error: 'Manufacturer name is required' }, { status: 400 });
    }

    const manufacturerName = body.name.trim();

    // Check for case-insensitive duplicate
    console.log('🔍 Checking for case-insensitive duplicate...');
    const existingManufacturer = await prisma.manufacturer.findFirst({
      where: {
        name: {
          equals: manufacturerName,
          mode: 'insensitive',
        },
      },
    });

    if (existingManufacturer) {
      console.log(`❌ Manufacturer already exists: ${existingManufacturer.name}`);
      return NextResponse.json(
        { error: `Manufacturer "${existingManufacturer.name}" already exists` },
        { status: 409 }
      );
    }

    console.log('✅ Creating manufacturer...');
    const manufacturer = await prisma.manufacturer.create({
      data: {
        name: manufacturerName,
      },
    });

    console.log(`✅ Manufacturer created: ${manufacturer.name}`);
    return NextResponse.json(manufacturer, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating manufacturer:', error);

    // Handle unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Manufacturer already exists' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
