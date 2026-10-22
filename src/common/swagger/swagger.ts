import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { RolesService } from '../../modules/roles/roles.service.js';
import { RoleName } from '../enums/role-name.enum.js';
import { FALLBACK_LANGUAGE, LANGUAGES } from '../i18n/languages.js';

export const SWAGGER_PATH = 'docs';

// Request schemas come from the zod schemas on @Body/@Query/@Param, including
// their .meta({ example }) values.
export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('IMS API')
    .setDescription(
      'Run POST /api/auth/login first: its example is the seeded super admin, ' +
        'and this page then sends the returned token with every request.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      in: 'header',
      name: 'Accept-Language',
      required: false,
      description: 'Language of messages (or ?lang=)',
      schema: {
        type: 'string',
        enum: [...LANGUAGES],
        default: FALLBACK_LANGUAGE,
      },
    })
    .build();
  return SwaggerModule.createDocument(app, config);
}

// Runs on every load of the docs page, so each visit offers an email, site code,
// category name and product prefix nobody has taken yet. The role is
// site_technician, which every role that can create users may assign.
export function withFreshExamples(
  document: OpenAPIObject,
  technicianRoleId?: number,
): OpenAPIObject {
  const patched = structuredClone(document);
  const suffix = Date.now().toString(36);
  setBodyExamples(patched, '/api/users', {
    email: `user.${suffix}@example.com`,
    ...(technicianRoleId ? { roleId: technicianRoleId } : {}),
  });
  setBodyExamples(patched, '/api/sites', {
    code: `SITE-${suffix.toUpperCase()}`,
  });
  setBodyExamples(patched, '/api/categories', {
    name: `Power Tools ${suffix}`,
  });
  // Prefixes are at most 10 characters; the suffix is 8 until the year 2059.
  setBodyExamples(patched, '/api/products', {
    prefix: `P${suffix.toUpperCase()}`,
  });
  return patched;
}

function setBodyExamples(
  document: OpenAPIObject,
  path: string,
  examples: Record<string, unknown>,
): void {
  const properties = (document.paths[path]?.post?.requestBody as any)?.content[
    'application/json'
  ]?.schema?.properties;
  for (const [name, example] of Object.entries(examples)) {
    if (properties?.[name]) properties[name].example = example;
  }
}

// Runs in the browser: Swagger UI receives it as source text, so it may only use
// browser globals. Authorizes the page with the token from a login or refresh.
function authorizeFromTokenResponse(response: any) {
  if (
    response.ok &&
    /\/api\/auth\/(login|refresh)(\?|$)/.test(response.url) &&
    response.body?.accessToken
  ) {
    (globalThis as any).ui.preauthorizeApiKey(
      'bearer',
      response.body.accessToken,
    );
  }
  return response;
}

export async function setupSwagger(app: INestApplication): Promise<void> {
  const document = createSwaggerDocument(app);
  // Roles only change with the seed command, so looking it up once is enough.
  const roles = await app.get(RolesService).findAll();
  const technicianRoleId = roles.find(
    (role) => role.name === RoleName.SITE_TECHNICIAN,
  )?.id;

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    patchDocumentOnRequest: (_req, _res, doc) =>
      withFreshExamples(doc, technicianRoleId),
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
      displayRequestDuration: true,
      responseInterceptor: authorizeFromTokenResponse,
    },
  });
}
