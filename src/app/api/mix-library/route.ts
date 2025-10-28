import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Fetch user's mix library
export async function GET() {
  try {
    console.log('🔍 Fetching mix library...');

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('❌ No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      console.log('❌ User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('✅ User found:', user.id);

    // Fetch mix library with all associated mixes
    const mixLibrary = await prisma.mixLibrary.findUnique({
      where: { userId: user.id },
      include: {
        mixes: {
          orderBy: { mixId: 'asc' },
        },
      },
    });

    if (!mixLibrary) {
      console.log('ℹ️ No mix library found for user');
      return NextResponse.json({ mixLibrary: null }, { status: 200 });
    }

    console.log('✅ Mix library found with', mixLibrary.mixes.length, 'mixes');

    // Transform to frontend format
    const response = {
      fileName: mixLibrary.fileName,
      mixLibraryVersion: mixLibrary.mixLibraryVersion,
      units: mixLibrary.units,
      indexRange: [mixLibrary.indexRangeMin, mixLibrary.indexRangeMax],
      layerSequence: mixLibrary.layerSequence,
      mixes: mixLibrary.mixes.map(mix => ({
        id: mix.mixId,
        layerCount: mix.layerCount,
      })),
    };

    return NextResponse.json({ mixLibrary: response }, { status: 200 });
  } catch (error) {
    console.error('❌ Error fetching mix library:', error);
    return NextResponse.json({ error: 'Failed to fetch mix library' }, { status: 500 });
  }
}

// POST - Save/Update mix library
export async function POST(request: NextRequest) {
  try {
    console.log('💾 Saving mix library...');

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('❌ No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      console.log('❌ User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { fileName, mixLibraryVersion, units, indexRange, layerSequence, mixes } = body;

    console.log('📄 Received data:', {
      fileName,
      mixLibraryVersion,
      units,
      mixCount: mixes?.length,
    });

    // Define mix type
    interface MixInput {
      id: number;
      layerCount: number;
    }

    // Validate required fields
    if (!fileName || !mixLibraryVersion || !units || !indexRange || !layerSequence || !mixes) {
      console.log('❌ Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user already has a mix library
    const existingMixLibrary = await prisma.mixLibrary.findUnique({
      where: { userId: user.id },
    });

    let mixLibrary;

    if (existingMixLibrary) {
      console.log('🔄 Updating existing mix library');

      // Delete existing mixes first (cascade delete handles this)
      // Then update the mix library
      mixLibrary = await prisma.mixLibrary.update({
        where: { userId: user.id },
        data: {
          fileName,
          mixLibraryVersion,
          units,
          indexRangeMin: indexRange[0],
          indexRangeMax: indexRange[1],
          layerSequence,
          mixes: {
            deleteMany: {}, // Delete all existing mixes
            create: (mixes as MixInput[]).map(mix => ({
              mixId: mix.id,
              layerCount: mix.layerCount,
            })),
          },
        },
        include: {
          mixes: true,
        },
      });
    } else {
      console.log('➕ Creating new mix library');

      // Create new mix library with mixes
      mixLibrary = await prisma.mixLibrary.create({
        data: {
          fileName,
          mixLibraryVersion,
          units,
          indexRangeMin: indexRange[0],
          indexRangeMax: indexRange[1],
          layerSequence,
          userId: user.id,
          mixes: {
            create: (mixes as MixInput[]).map(mix => ({
              mixId: mix.id,
              layerCount: mix.layerCount,
            })),
          },
        },
        include: {
          mixes: true,
        },
      });
    }

    console.log('✅ Mix library saved successfully with', mixLibrary.mixes.length, 'mixes');

    return NextResponse.json(
      {
        message: 'Mix library saved successfully',
        mixLibrary: {
          id: mixLibrary.id,
          mixCount: mixLibrary.mixes.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error saving mix library:', error);
    return NextResponse.json({ error: 'Failed to save mix library' }, { status: 500 });
  }
}

// DELETE - Remove mix library
export async function DELETE() {
  try {
    console.log('🗑️ Deleting mix library...');

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('❌ No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      console.log('❌ User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if mix library exists
    const mixLibrary = await prisma.mixLibrary.findUnique({
      where: { userId: user.id },
    });

    if (!mixLibrary) {
      console.log('ℹ️ No mix library to delete');
      return NextResponse.json({ message: 'No mix library found' }, { status: 404 });
    }

    // Delete mix library (cascade will delete all mixes)
    await prisma.mixLibrary.delete({
      where: { userId: user.id },
    });

    console.log('✅ Mix library deleted successfully');

    return NextResponse.json({ message: 'Mix library deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('❌ Error deleting mix library:', error);
    return NextResponse.json({ error: 'Failed to delete mix library' }, { status: 500 });
  }
}
