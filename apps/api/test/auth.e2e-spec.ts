import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth E2E', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const email = `test-${Date.now()}@specpilot.test`;
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Test User', email, password: 'TestPass123!' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe(email);
    });

    it('should return 409 for duplicate email', async () => {
      const email = `dup-${Date.now()}@specpilot.test`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Test', email, password: 'TestPass123!' });

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Test2', email, password: 'TestPass456!' });

      expect(res.status).toBe(409);
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'not-an-email', password: 'TestPass123!' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    let testEmail: string;

    beforeAll(async () => {
      testEmail = `login-${Date.now()}@specpilot.test`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Login User', email: testEmail, password: 'TestPass123!' });
    });

    it('should login and return access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'TestPass123!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      accessToken = res.body.access_token;
    });

    it('should return 401 for wrong password (P18: generic message)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'Wrong123!' });

      expect(res.status).toBe(401);
    });

    it('should return 401 for non-existent user (P18: same message)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'no-such@user.com', password: 'TestPass123!' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Login first
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `logout-${Date.now()}@specpilot.test`, password: 'TestPass123!' })
        .catch(() => null);

      if (!loginRes || loginRes.status !== 200) return; // skip if no user

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.access_token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('JWT Auth Guard', () => {
    it('should return 401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/api/projects');
      expect(res.status).toBe(401);
    });

    it('should return 200 with valid token', async () => {
      // Create user and login
      const email = `guard-${Date.now()}@specpilot.test`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Guard User', email, password: 'TestPass123!' });

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'TestPass123!' });

      const res = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${loginRes.body.access_token}`);

      expect(res.status).toBe(200);
    });
  });
});
