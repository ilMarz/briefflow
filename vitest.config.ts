import { defineConfig } from 'vitest/config';
import path from 'node:path';
// Files run one after another: several of them set up the same test database (DDL would deadlock in parallel).
export default defineConfig({resolve:{alias:{'@':path.resolve(__dirname,'src')}},test:{include:['tests/**/*.test.ts'],exclude:['tests/e2e/**'],testTimeout:20000,fileParallelism:false}});
