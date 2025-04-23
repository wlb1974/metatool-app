import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';

import { config as appConfig } from '@/lib/config';

// API路由检测
const isApiRoute = (pathname: string) => {
  return pathname.startsWith('/api/');
};

// 简单的日志记录函数
const logInfo = (message: string, meta: Record<string, any> = {}) => {
  console.info({
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    ...meta
  });
};

export async function middleware(request: NextRequest) {
  const requestId = nanoid();
  const { pathname } = request.nextUrl;
  
  // 只拦截API请求
  if (isApiRoute(pathname)) {
    // 过滤敏感头信息
    const headers = Object.fromEntries(request.headers.entries());
    const sanitizedHeaders: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (appConfig.logging.sensitiveFields.some((field: string) => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitizedHeaders[key] = '***';
      } else {
        sanitizedHeaders[key] = value;
      }
    }
    
    // 记录API请求
    logInfo(`[Middleware] API Request: ${request.method} ${request.nextUrl.toString()}`, {
      requestId,
      method: request.method,
      url: request.nextUrl.toString(),
      pathname,
      headers: sanitizedHeaders
    });
  }
  
  return NextResponse.next({
    headers: {
      'x-request-id': requestId
    }
  });
}

// 中间件配置
export const config = {
  // 匹配所有API路由
  matcher: ['/api/:path*']
}; 