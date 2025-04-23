import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { mcpServersTable, McpServerStatus } from '@/db/schema';
import { logger, withRequestLogger } from '@/lib/logger';

import { authenticateApiKey } from '../auth';

async function handleGet(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const activeMcpServers = await db
      .select()
      .from(mcpServersTable)
      .where(
        and(
          eq(mcpServersTable.status, McpServerStatus.ACTIVE),
          eq(mcpServersTable.profile_uuid, auth.activeProfile.uuid)
        )
      );
    
    logger.info('MCP servers fetched successfully', {
      profileUuid: auth.activeProfile.uuid,
      count: activeMcpServers.length
    });
    
    return NextResponse.json(activeMcpServers);
  } catch (error) {
    logger.error('Failed to fetch active MCP servers', { error });
    return NextResponse.json(
      { error: 'Failed to fetch active MCP servers' },
      { status: 500 }
    );
  }
}

async function handlePost(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { uuid, name, description, command, args, env, status } = body;

    logger.debug('Creating new MCP server', {
      name,
      profileUuid: auth.activeProfile.uuid
    });

    const newMcpServer = await db
      .insert(mcpServersTable)
      .values({
        uuid,
        name,
        description,
        command,
        args,
        env,
        status,
        profile_uuid: auth.activeProfile.uuid,
      })
      .returning();

    logger.info('MCP server created successfully', {
      serverUuid: newMcpServer[0].uuid,
      name: newMcpServer[0].name,
      profileUuid: auth.activeProfile.uuid
    });

    return NextResponse.json(newMcpServer[0]);
  } catch (error) {
    logger.error('Failed to create MCP server', { error });
    return NextResponse.json(
      { error: 'Failed to create MCP server' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogger(handleGet);
export const POST = withRequestLogger(handlePost);
