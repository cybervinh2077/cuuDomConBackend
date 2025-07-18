import request from 'supertest';
import app from '../index.js';

describe('User API', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/register')
      .send({ username: 'testuser', password: '123456' });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/thành công/i);
  });

  it('should not register duplicate user', async () => {
    await request(app).post('/register').send({ username: 'testuser2', password: '123456' });
    const res = await request(app).post('/register').send({ username: 'testuser2', password: '123456' });
    expect(res.statusCode).toBe(409);
  });

  it('should login with correct credentials', async () => {
    await request(app).post('/register').send({ username: 'testuser3', password: '123456' });
    const res = await request(app).post('/login').send({ username: 'testuser3', password: '123456' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should not login with wrong password', async () => {
    await request(app).post('/register').send({ username: 'testuser4', password: '123456' });
    const res = await request(app).post('/login').send({ username: 'testuser4', password: 'wrongpass' });
    expect(res.statusCode).toBe(401);
  });
}); 