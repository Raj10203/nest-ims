import { NestFactory } from '@nestjs/core';
import { JobsWorkerModule } from './modules/jobs/jobs-worker.module.js';

// Queue worker entry point, run as its own process: node dist/worker.js
const app = await NestFactory.createApplicationContext(JobsWorkerModule);
app.enableShutdownHooks();
