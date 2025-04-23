import { nanoid } from 'nanoid';

import { config } from './config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogOptions {
  level?: LogLevel;
  meta?: Record<string, any>;
}

/**
 * 简单的日志工具，支持不同日志级别和元数据记录
 */
class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private sensitiveFields: string[];
  
  private constructor() {
    this.logLevel = (config.logging.level as LogLevel) || 'info';
    this.sensitiveFields = config.logging.sensitiveFields || [];
  }
  
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 记录一条日志
   */
  log(message: string, options: LogOptions = {}): void {
    const { level = 'info', meta = {} } = options;
    
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const sanitizedMeta = this.sanitizeSensitiveData(meta);
    
    console[level]({
      timestamp,
      level,
      message,
      ...sanitizedMeta
    });
  }

  /**
   * 判断当前日志级别是否应该记录
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    return levels[level] >= levels[this.logLevel];
  }
  
  /**
   * 处理敏感数据，替换为***
   */
  private sanitizeSensitiveData(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'object' && data !== null) {
      const result: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (this.sensitiveFields.includes(key)) {
          result[key] = '***';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = this.sanitizeSensitiveData(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    }
    
    return data;
  }

  debug(message: string, meta: Record<string, any> = {}): void {
    this.log(message, { level: 'debug', meta });
  }

  info(message: string, meta: Record<string, any> = {}): void {
    this.log(message, { level: 'info', meta });
  }

  warn(message: string, meta: Record<string, any> = {}): void {
    this.log(message, { level: 'warn', meta });
  }

  error(message: string, meta: Record<string, any> = {}): void {
    this.log(message, { level: 'error', meta });
  }
}

export const logger = Logger.getInstance();

/**
 * API请求中间件 - 用于封装Next.js API路由处理器并记录请求/响应日志
 */
export function withRequestLogger<T>(
  handler: (request: Request, ...args: any[]) => Promise<Response>
): (request: Request, ...args: any[]) => Promise<Response> {
  return async (request: Request, ...args: any[]) => {
    const startTime = Date.now();
    const requestId = nanoid();
    
    // Clone request to read the body
    const requestClone = request.clone();
    let requestBody = {};
    
    try {
      if (['POST', 'PUT', 'PATCH'].includes(request.method) && config.logging.logRequestBody) {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          requestBody = await requestClone.json();
        }
      }
    } catch (error) {
      logger.warn('Failed to parse request body', { error, requestId });
    }
    
    // Log request
    logger.info(`API Request: ${request.method} ${request.url}`, {
      requestId,
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      ...(config.logging.logRequestBody ? { body: requestBody } : {})
    });
    
    try {
      // Execute the original handler
      const response = await handler(request, ...args);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Clone response to read the body
      const responseClone = response.clone();
      let responseBody = {};
      
      try {
        if (config.logging.logResponseBody) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            responseBody = await responseClone.json();
          }
        }
      } catch (error) {
        logger.warn('Failed to parse response body', { error, requestId });
      }
      
      // Log response
      logger.info(`API Response: ${response.status}`, {
        requestId,
        status: response.status,
        statusText: response.statusText,
        responseTime: `${responseTime}ms`,
        headers: Object.fromEntries(response.headers.entries()),
        ...(config.logging.logResponseBody ? { body: responseBody } : {})
      });
      
      return response;
    } catch (error: any) {
      // Log error
      logger.error(`API Error: ${error.message}`, {
        requestId,
        error: error.stack || error.message,
        responseTime: `${Date.now() - startTime}ms`,
      });
      
      throw error;
    }
  };
} 