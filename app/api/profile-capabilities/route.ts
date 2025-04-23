import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { profilesTable } from '@/db/schema';
import { logger, withRequestLogger } from '@/lib/logger';

import { authenticateApiKey } from '../auth';

async function handleGet(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const profile = await db
      .select({
        enabled_capabilities: profilesTable.enabled_capabilities,
      })
      .from(profilesTable)
      .where(eq(profilesTable.uuid, auth.activeProfile.uuid))
      .limit(1);

    if (profile.length === 0) {
      logger.warn('Profile not found when fetching capabilities', {
        profileUuid: auth.activeProfile.uuid
      });
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    logger.info('Profile capabilities fetched successfully', {
      profileUuid: auth.activeProfile.uuid
    });

    return NextResponse.json({
      profileCapabilities: profile[0].enabled_capabilities,
    });
  } catch (error) {
    logger.error('Failed to fetch profile capabilities', { error });
    return NextResponse.json(
      { error: 'Failed to fetch profile capabilities' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogger(handleGet);
