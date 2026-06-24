'use strict';

function buildOpenApi(baseUrl) {
  const origin = (baseUrl || 'https://kiteline.uk').replace(/\/$/, '');
  const paths = {};
  const resources = [
    ['health', 'get', false],
    ['me', 'get', true],
    ['sites', 'get', true],
    ['recipes', 'get', true],
    ['recipes', 'post', true],
    ['menus', 'get', true],
    ['menus', 'post', true],
    ['allergens', 'get', true],
    ['temperature-logs', 'get', true],
    ['temperature-logs', 'post', true],
    ['haccp-logs', 'get', true],
    ['haccp-logs', 'post', true],
    ['cleaning-checks', 'get', true],
    ['fridge-freezer-units', 'get', true],
    ['labels', 'get', true],
    ['labels', 'post', true],
    ['stock', 'get', true],
    ['suppliers', 'get', true],
    ['orders', 'get', true],
    ['waste', 'get', true],
    ['rota', 'get', true],
    ['reports', 'get', true],
  ];

  resources.forEach(([name, method, auth]) => {
    const p = `/api/ai/${name}`;
    paths[p] = paths[p] || {};
    paths[p][method] = {
      operationId: `${method}_${name.replace(/-/g, '_')}`,
      summary: `${method.toUpperCase()} ${name}`,
      ...(auth ? { security: [{ AiBearer: [] }, { AiApiKey: [] }] } : {}),
      parameters: method === 'get' ? [{
        name: 'site',
        in: 'query',
        schema: { type: 'string' },
        description: 'Kitchen site id (e.g. site_grove)',
      }] : [],
      requestBody: method !== 'get' ? {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                confirm: { type: 'boolean', description: 'Must be true for create/update/delete' },
                site: { type: 'string' },
                data: { type: 'object' },
              },
            },
          },
        },
      } : undefined,
      responses: {
        200: { description: 'OK' },
        401: { description: 'Invalid or missing AI token' },
        403: { description: 'Permission denied' },
      },
    };
  });

  return {
    openapi: '3.1.0',
    info: {
      title: 'Kiteline AI Connector',
      version: '1.0.0',
      description:
        'Secure Kiteline API for authorised AI assistants (ChatGPT GPT Actions). '
        + 'Use a Kiteline AI token — never a user password. Create tokens in the Kiteline app while signed in: POST /api/ai/tokens',
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: {
        AiBearer: {
          type: 'http',
          scheme: 'bearer',
          description: 'Kiteline AI token (kl_ai_…)',
        },
        AiApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Kiteline AI token (kl_ai_…)',
        },
        OAuth2: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: `${origin}/api/ai/oauth/authorize`,
              tokenUrl: `${origin}/api/ai/oauth/token`,
              scopes: {
                'kiteline.read': 'Read recipes, allergens, logs, and reports',
                'kiteline.write': 'Create and update records (with user confirmation)',
              },
            },
          },
        },
      },
    },
    paths,
  };
}

module.exports = { buildOpenApi };
