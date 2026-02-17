/**
 * Swagger/OpenAPI documentation
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Eco-Relais API',
      version: '1.0.0',
      description: 'Hyperlocal package delivery platform – REST API for clients and partners',
    },
    servers: [{ url: '/api', description: 'API base' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['client', 'partner', 'admin'] },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone: { type: 'string', nullable: true },
            address_lat: { type: 'number', nullable: true },
            address_lng: { type: 'number', nullable: true },
            verified: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Mission: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string', format: 'uuid' },
            partner_id: { type: 'string', format: 'uuid', nullable: true },
            package_photo_url: { type: 'string', nullable: true },
            package_title: { type: 'string' },
            package_size: { type: 'string', enum: ['small', 'medium', 'large'] },
            pickup_address: { type: 'string' },
            pickup_lat: { type: 'number' },
            pickup_lng: { type: 'number' },
            delivery_address: { type: 'string' },
            delivery_lat: { type: 'number' },
            delivery_lng: { type: 'number' },
            pickup_time_slot: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'accepted', 'collected', 'in_transit', 'delivered', 'cancelled'],
            },
            price: { type: 'number' },
            commission: { type: 'number' },
            qr_code: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            completed_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [], // Add paths to controller files for JSDoc; definition above is sufficient for basic docs
};

const spec = swaggerJsdoc(options);

export function setupSwagger(app: Express, path: string = '/api-docs'): void {
  app.use(path, swaggerUi.serve, swaggerUi.setup(spec, { explorer: true }));
}

export default spec;
