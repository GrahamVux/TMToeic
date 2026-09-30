import 'reflect-metadata'
import { setDefaultResultOrder } from 'node:dns'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { APP_CONFIG, loadDotEnv, type AppConfig } from './config/app-config'
import { API_PREFIX, configureApp } from './setup'

// Render (and many PaaS) cannot reach IPv6-only Supabase hosts; prefer A records first.
setDefaultResultOrder('ipv4first')

async function bootstrap() {
  loadDotEnv()
  const app = await NestFactory.create(AppModule)
  configureApp(app)
  const { port } = app.get<AppConfig>(APP_CONFIG)
  await app.listen(port)
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/${API_PREFIX}`)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
