import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JobsWorkerModule } from './modules/jobs/jobs-worker.module.js';

// Queue worker entry point, run as its own process: node dist/worker.js
try {
  const app = await NestFactory.createApplicationContext(JobsWorkerModule);
  app.enableShutdownHooks();
} catch (error) {
  new Logger('Worker').error('Failed to start', error);
  process.exit(1);
}
