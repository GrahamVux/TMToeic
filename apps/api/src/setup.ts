import type { INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { CSRF_HEADER, VIEW_AS_HEADER } from '@toeic/shared'
import cookieParser from 'cookie-parser'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import { APP_CONFIG, type AppConfig } from './config/app-config'

export const API_PREFIX = 'api/v1'

/** Shared by main.ts and e2e tests so tests exercise the real HTTP pipeline. */
export function configureApp(app: INestApplication) {
  const config = app.get<AppConfig>(APP_CONFIG)
  const http = app as NestExpressApplication

  if (config.isProd) http.set('trust proxy', 1) // real client IP behind Cloud Run/Render/Railway proxies
  http.disable('x-powered-by')

  app.setGlobalPrefix(API_PREFIX)
  // Gemini's Listening JSON is a few hundred kilobytes; the photographed PDF beside it is several megabytes.
  http.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path.split('?')[0] ?? req.path
    if (req.method === 'POST' && /\/exams\/import-listening-scan(?:\/preview)?$/.test(path)) {
      return express.raw({ type: () => true, limit: '20mb' })(req, res, next)
    }
    next()
  })
  http.useBodyParser('json', { limit: '5mb' })
  // Listening recordings are posted as raw bytes, not JSON (the 5mb JSON parser would reject a full test).
  http.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path.split('?')[0] ?? req.path
    if (req.method === 'POST' && /\/(?:exams\/[^/]+\/audio\/file|assignments\/[^/]+\/(?:audio\/file|images)|study\/vocab\/import|study\/grammar\/[^/]+\/pdf|users\/students\/import)$/.test(path)) {
      return express.raw({ type: () => true, limit: '80mb' })(req, res, next)
    }
    next()
  })
  app.use(helmet())
  app.use(cookieParser())
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', CSRF_HEADER, VIEW_AS_HEADER],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
  app.enableShutdownHooks()
  return app
}
