import { and, desc, eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import {
  codesTable,
  customMcpServersTable,
  McpServerStatus,
} from '@/db/schema';
import { logger, withRequestLogger } from '@/lib/logger';

import { authenticateApiKey } from '../auth';

async function handleGet(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const customMcpServers = await db
      .select({
        uuid: customMcpServersTable.uuid,
        name: customMcpServersTable.name,
        description: customMcpServersTable.description,
        code_uuid: customMcpServersTable.code_uuid,
        additionalArgs: customMcpServersTable.additionalArgs,
        env: customMcpServersTable.env,
        created_at: customMcpServersTable.created_at,
        profile_uuid: customMcpServersTable.profile_uuid,
        status: customMcpServersTable.status,
        code: codesTable.code,
        codeFileName: codesTable.fileName,
      })
      .from(customMcpServersTable)
      .leftJoin(
        codesTable,
        eq(customMcpServersTable.code_uuid, codesTable.uuid)
      )
      .where(
        and(
          eq(customMcpServersTable.profile_uuid, auth.activeProfile.uuid),
          or(
            eq(customMcpServersTable.status, McpServerStatus.ACTIVE),
            eq(customMcpServersTable.status, McpServerStatus.INACTIVE)
          )
        )
      )
      .orderBy(desc(customMcpServersTable.created_at));

    logger.info('Custom MCP servers fetched successfully', {
      profileUuid: auth.activeProfile.uuid,
      count: customMcpServers.length
    });

    return NextResponse.json(customMcpServers);
  } catch (error) {
    logger.error('Failed to fetch custom MCP servers', { error });
    return NextResponse.json(
      { error: 'Failed to fetch custom MCP servers' },
      { status: 500 }
    );
  }
}

async function handlePost(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { name, description, code_uuid, additionalArgs, env } = body;

    logger.debug('Creating new custom MCP server', {
      name,
      profileUuid: auth.activeProfile.uuid
    });

    const [newCustomMcpServer] = await db
      .insert(customMcpServersTable)
      .values({
        name,
        description,
        code_uuid,
        additionalArgs,
        env,
        status: McpServerStatus.ACTIVE,
        profile_uuid: auth.activeProfile.uuid,
      })
      .returning();

    logger.info('Custom MCP server created successfully', {
      serverUuid: newCustomMcpServer.uuid,
      name: newCustomMcpServer.name,
      profileUuid: auth.activeProfile.uuid
    });

    return NextResponse.json(newCustomMcpServer);
  } catch (error) {
    logger.error('Failed to create custom MCP server', { error });
    return NextResponse.json(
      { error: 'Failed to create custom MCP server' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogger(handleGet);
export const POST = withRequestLogger(handlePost);
