import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface StorageOptions {
  connectionString: string;
  container: string;
  publicUrl?: string;
}

export const {
  ConfigurableModuleClass: StorageConfigurableModule,
  MODULE_OPTIONS_TOKEN: STORAGE_OPTIONS,
} = new ConfigurableModuleBuilder<StorageOptions>()
  .setClassMethodName('forRoot')
  .setExtras({ isGlobal: true }, (definition, extras) => ({
    ...definition,
    global: extras.isGlobal,
  }))
  .build();
