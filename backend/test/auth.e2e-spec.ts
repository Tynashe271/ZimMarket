import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

// Requires the backend's Postgres and Redis dependencies to be running,
// e.g. `docker compose up -d` from the backend directory (see README.md).
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function uniquePhone() {
    return `+26377${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`;
  }

  it('rejects a protected route without a bearer token', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/profile');
    expect(response.status).toBe(401);
  });

  it('registers a customer, logs in, and reads their own profile', async () => {
    const phone = uniquePhone();
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone, password: 'password123', accountType: 'CUSTOMER', fullName: 'Test Customer', city: 'Harare', acceptedPolicies: true });
    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.accessToken).toBeDefined();

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: phone, password: 'password123' });
    expect(loginResponse.status).toBe(200);

    const profileResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.phone).toBe(phone);
  });

  it('rejects a second registration with the same phone number', async () => {
    const payload = { phone: uniquePhone(), password: 'password123', accountType: 'CUSTOMER', fullName: 'Test Customer', city: 'Harare', acceptedPolicies: true };
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload).expect(201);
    const response = await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload);
    expect(response.status).toBe(409);
  });

  it('rejects login with the wrong password', async () => {
    const phone = uniquePhone();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone, password: 'password123', accountType: 'CUSTOMER', fullName: 'Test Customer', city: 'Harare', acceptedPolicies: true })
      .expect(201);

    const response = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ identifier: phone, password: 'wrong-password' });
    expect(response.status).toBe(401);
  });
});
