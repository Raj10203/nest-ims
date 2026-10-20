import type { Type } from '@nestjs/common';
import {
  MODULE_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants.js';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum.js';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { AppModule } from '../../app.module.js';
import { SitesController } from '../../modules/sites/sites.controller.js';
import { createSiteSchema } from '../../modules/sites/dto/create-site.dto.js';
import { UsersController } from '../../modules/users/users.controller.js';
import { createUserSchema } from '../../modules/users/dto/create-user.dto.js';
import { createSwaggerDocument, withFreshExamples } from './swagger.js';

// Swagger UI pre-fills a body from the schema's `example`, or else from each
// property's example (default when none). That body must pass the same zod
// schema the API validates with.
function swaggerUiBody(jsonSchema: any): unknown {
  if ('example' in jsonSchema) return jsonSchema.example;
  return Object.fromEntries(
    Object.entries(jsonSchema.properties ?? {}).map(([name, property]: any) => [
      name,
      'example' in property ? property.example : property.default,
    ]),
  );
}

const toJsonSchema = (schema: z.ZodType) =>
  (schema as any)['~standard'].jsonSchema.input({ target: 'openapi-3.0' });

// Every controller reachable from AppModule, without starting the app.
function controllersOf(root: unknown): Type[] {
  const controllers = new Set<Type>();
  const seen = new Set<unknown>();
  const visit = (entry: any) => {
    if (!entry || seen.has(entry)) return;
    seen.add(entry);
    if (entry.forwardRef) return visit(entry.forwardRef());
    const module = entry.module ?? entry;
    for (const controller of [
      ...(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ?? []),
      ...(entry.controllers ?? []),
    ]) {
      controllers.add(controller);
    }
    for (const imported of [
      ...(Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) ?? []),
      ...(entry.imports ?? []),
    ]) {
      visit(imported);
    }
  };
  visit(root);
  return [...controllers];
}

const bodySchemas = controllersOf(AppModule).flatMap((controller) =>
  Object.getOwnPropertyNames(controller.prototype).flatMap((method) =>
    Object.entries(
      Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {},
    )
      .filter(
        ([key, arg]: [string, any]) =>
          Number(key.split(':')[0]) === RouteParamtypes.BODY &&
          arg.schema instanceof z.ZodType,
      )
      .map(([, arg]: [string, any]) => ({
        route: `${controller.name}.${method}`,
        schema: arg.schema as z.ZodType,
      })),
  ),
);

describe('Swagger examples', () => {
  it('finds the request bodies to check', () => {
    expect(bodySchemas.map(({ route }) => route)).toEqual(
      expect.arrayContaining([
        'UsersController.create',
        'AuthController.login',
      ]),
    );
  });

  it.each(bodySchemas)(
    '$route: the pre-filled body passes validation',
    ({ schema }) => {
      const jsonSchema = toJsonSchema(schema);
      if (!('example' in jsonSchema)) {
        // A property without example or default would be pre-filled with a
        // placeholder such as "string" or 0.
        const bare = Object.entries(jsonSchema.properties ?? {})
          .filter(([, p]: any) => !('example' in p) && !('default' in p))
          .map(([name]) => name);
        expect(bare).toEqual([]);
      }
      expect(schema.safeParse(swaggerUiBody(jsonSchema)).error).toBeUndefined();
    },
  );

  it('offers a fresh email, site code and the given role on each page load', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController, SitesController],
    })
      .useMocker(() => ({}))
      .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    const document = createSwaggerDocument(app);

    const patched = withFreshExamples(document, 7);
    const bodyOf = (path: string) =>
      swaggerUiBody(
        (patched.paths[path].post!.requestBody as any).content[
          'application/json'
        ].schema,
      ) as Record<string, unknown>;

    const user = bodyOf('/api/users');
    expect(user.roleId).toBe(7);
    expect(user.email).not.toBe('jane.doe@example.com');
    expect(createUserSchema.safeParse(user).error).toBeUndefined();

    const site = bodyOf('/api/sites');
    expect(site.code).not.toBe('AMD-01');
    expect(createSiteSchema.safeParse(site).error).toBeUndefined();
    await app.close();
  });
});
