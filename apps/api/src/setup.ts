import type { INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { CSRF_HEADER } from '@toeic/shared'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { APP_CONFIG, type AppConfig } from './config/app-config'

export const API_PREFIX = 'api/v1'

/** Shared by main.ts and e2e tests so tests exercise the real HTTP pipeline. */
export function configureApp(app: INestApplication) {
  const config = app.get<AppConfig>(APP_CONFIG)
  const express = app as NestExpressApplication

  if (config.isProd) express.set('trust proxy', 1) // real client IP behind Cloud Run/Render/Railway proxies
  express.disable('x-powered-by')

  app.setGlobalPrefix(API_PREFIX)
  express.useBodyParser('json', { limit: '5mb' })
  app.use(helmet())
  app.use(cookieParser())
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', CSRF_HEADER],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
  app.enableShutdownHooks()
  return app
}
