/**
 * 应用全局配置
 */
export const config = {
  /**
   * 日志配置
   */
  logging: {
    // 日志级别: 'debug' | 'info' | 'warn' | 'error'
    level: process.env.LOG_LEVEL || 'info',
    
    // 是否记录请求体和响应体
    logRequestBody: process.env.LOG_REQUEST_BODY === 'true',
    logResponseBody: process.env.LOG_RESPONSE_BODY === 'true',
    
    // 敏感字段，这些字段在日志中将被遮蔽
    sensitiveFields: ['password', 'token', 'secret', 'api_key', 'apiKey', 'Authorization'],
  }
}; 