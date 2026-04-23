import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AppModule } from '../src/app.module';

describe('PokemonController (Integration)', () => {
  let app: INestApplication;
  let httpService: HttpService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    httpService = moduleFixture.get<HttpService>(HttpService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /random-pokemon should return a pokemon', async () => {
    const mockPokemon = {
      data: {
        id: 25,
        name: 'pikachu',
        types: [{ type: { name: 'electric' } }],
        sprites: { front_default: 'https://pikachu-image' },
      },
    };

    jest.spyOn(httpService, 'get').mockReturnValue(of(mockPokemon as any));

    const response = await request(app.getHttpServer())
      .get('/random-pokemon')
      .expect(200);

    expect(response.body).toEqual({
      id: 25,
      name: 'pikachu',
      types: ['electric'],
      imageUrl: 'https://pikachu-image',
    });
  });

  it('GET /random-pokemon should be sequential due to rate limit', async () => {
    const mockPokemon = {
      data: { id: 1, name: 'b', types: [], sprites: {} },
    };
    jest.spyOn(httpService, 'get').mockReturnValue(of(mockPokemon as any));

    const start = Date.now();
    
    // Fire two requests concurrently
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer()).get('/random-pokemon'),
      request(app.getHttpServer()).get('/random-pokemon'),
    ]);

    const end = Date.now();
    const duration = end - start;

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    
    // Since the limit is 1 token per second, the second request must have waited at least 1000ms
    // We use a small buffer for execution time
    expect(duration).toBeGreaterThanOrEqual(1000);
  });
});
