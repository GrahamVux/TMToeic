import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch && process.env.TSUP_NO_CLEAN !== '1',
  sourcemap: true,
  target: 'es2022',
}))
