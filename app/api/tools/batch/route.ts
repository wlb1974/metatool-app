import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { mcpServersTable, toolsTable } from '@/db/schema';
import { logger, withRequestLogger } from '@/lib/logger';

import { authenticateApiKey } from '../../auth';

async function handlePost(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { operations } = body;

    // 验证operations是一个数组
    if (!Array.isArray(operations) || operations.length === 0) {
      logger.warn('Batch operation failed: missing or empty operations array', {
        profileUuid: auth.activeProfile.uuid
      });
      return NextResponse.json(
        { error: 'Request must include a non-empty array of operations' },
        { status: 400 }
      );
    }

    // 用于存储操作结果
    const results = {
      success: [] as any[],
      errors: [] as any[],
      summary: {
        total: operations.length,
        succeeded: 0,
        failed: 0
      }
    };

    // 对每个操作进行处理
    for (const operation of operations) {
      const { action, data } = operation;

      if (!action || !data) {
        results.errors.push({
          operation,
          error: 'Missing required fields: action or data'
        });
        results.summary.failed++;
        continue;
      }

      try {
        // 根据操作类型执行不同的逻辑
        switch (action) {
          case 'create':
            // await processCreateOperation(data, results, auth);
            break;
          case 'update':
            // await processUpdateOperation(data, results, auth);
            break;
          case 'delete':
            // await processDeleteOperation(data, results, auth);
            break;
          default:
            results.errors.push({
              operation,
              error: `Unsupported action: ${action}`
            });
            results.summary.failed++;
        }
      } catch (error: any) {
        logger.error(`Error processing batch operation: ${action}`, { error });
        results.errors.push({
          operation,
          error: error.message || 'Unknown error'
        });
        results.summary.failed++;
      }
    }

    // 更新成功计数
    results.summary.succeeded = results.success.length;

    logger.info('Batch tools operations completed', {
      profileUuid: auth.activeProfile.uuid,
      total: results.summary.total,
      succeeded: results.summary.succeeded,
      failed: results.summary.failed
    });

    return NextResponse.json(results);
  } catch (error) {
    logger.error('Unexpected error during batch operations', { error });
    return NextResponse.json(
      { error: 'Failed to process batch operations' },
      { status: 500 }
    );
  }
}

// 处理创建工具操作
async function processCreateOperation(data: any, results: any, auth: any) {
  const { name, description, toolSchema, mcp_server_uuid } = data;

  // 验证必填字段
  if (!name || !toolSchema || !mcp_server_uuid) {
    results.errors.push({
      data,
      error: 'Missing required fields: name, toolSchema, or mcp_server_uuid'
    });
    results.summary.failed++;
    return;
  }

  // 验证MCP服务器是否属于当前配置文件
  const mcpServer = await db
    .select()
    .from(mcpServersTable)
    .where(
      sql`${mcpServersTable.uuid} = ${mcp_server_uuid} AND 
          ${mcpServersTable.profile_uuid} = ${auth.activeProfile.uuid}`
    )
    .limit(1);

  if (mcpServer.length === 0) {
    results.errors.push({
      data,
      error: 'MCP server not found or does not belong to your profile'
    });
    results.summary.failed++;
    return;
  }

  // 创建工具
  const newTool = await db
    .insert(toolsTable)
    .values({
      name,
      description,
      toolSchema,
      mcp_server_uuid
    })
    .returning();

  results.success.push(newTool[0]);
}

// 处理更新工具操作
async function processUpdateOperation(data: any, results: any, auth: any) {
  const { uuid, name, description, toolSchema, mcp_server_uuid } = data;

  // 验证必填字段
  if (!uuid) {
    results.errors.push({
      data,
      error: 'Missing required field: uuid'
    });
    results.summary.failed++;
    return;
  }

  // 构建更新对象
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (toolSchema !== undefined) updateData.toolSchema = toolSchema;
  if (mcp_server_uuid !== undefined) {
    // 验证新的MCP服务器是否属于当前配置文件
    const mcpServer = await db
      .select()
      .from(mcpServersTable)
      .where(
        sql`${mcpServersTable.uuid} = ${mcp_server_uuid} AND 
            ${mcpServersTable.profile_uuid} = ${auth.activeProfile.uuid}`
      )
      .limit(1);

    if (mcpServer.length === 0) {
      results.errors.push({
        data,
        error: 'MCP server not found or does not belong to your profile'
      });
      results.summary.failed++;
      return;
    }
    
    updateData.mcp_server_uuid = mcp_server_uuid;
  }

  // 更新工具前先检查工具是否存在且属于当前配置文件
  const existingTool = await db
    .select()
    .from(toolsTable)
    .innerJoin(
      mcpServersTable,
      sql`${toolsTable.mcp_server_uuid} = ${mcpServersTable.uuid}`
    )
    .where(
      sql`${toolsTable.uuid} = ${uuid} AND 
          ${mcpServersTable.profile_uuid} = ${auth.activeProfile.uuid}`
    )
    .limit(1);

  if (existingTool.length === 0) {
    results.errors.push({
      data,
      error: 'Tool not found or does not belong to your profile'
    });
    results.summary.failed++;
    return;
  }

  // 更新工具
  const updatedTool = await db
    .update(toolsTable)
    .set(updateData)
    .where(sql`${toolsTable.uuid} = ${uuid}`)
    .returning();

  results.success.push(updatedTool[0]);
}

// 处理删除工具操作
async function processDeleteOperation(data: any, results: any, auth: any) {
  const { uuid } = data;

  // 验证必填字段
  if (!uuid) {
    results.errors.push({
      data,
      error: 'Missing required field: uuid'
    });
    results.summary.failed++;
    return;
  }

  // 删除前先检查工具是否存在且属于当前配置文件
  const existingTool = await db
    .select()
    .from(toolsTable)
    .innerJoin(
      mcpServersTable,
      sql`${toolsTable.mcp_server_uuid} = ${mcpServersTable.uuid}`
    )
    .where(
      sql`${toolsTable.uuid} = ${uuid} AND 
          ${mcpServersTable.profile_uuid} = ${auth.activeProfile.uuid}`
    )
    .limit(1);

  if (existingTool.length === 0) {
    results.errors.push({
      data,
      error: 'Tool not found or does not belong to your profile'
    });
    results.summary.failed++;
    return;
  }

  // 删除工具
  const deletedTool = await db
    .delete(toolsTable)
    .where(sql`${toolsTable.uuid} = ${uuid}`)
    .returning();

  results.success.push(deletedTool[0]);
}

export const POST = withRequestLogger(handlePost); 