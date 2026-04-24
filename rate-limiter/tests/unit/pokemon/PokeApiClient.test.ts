import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { PokeApiClient } from '../../../src/modules/pokemon/infrastructure/poke-api.client';
import { RateLimiter } from '../../../src/modules/rate-limiter/domain/rate-limiter.interface';
import { DistributedSemaphore } from '../../../src/modules/rate-limiter/domain/distributed-semaphore.interface';
import { InternalServerErrorException } from '@nestjs/common';

describe('PokeApiClient', () => {
  let client: PokeApiClient;
  let mockHttpService: jest.Mocked<HttpService>;
  let mockRateLimiter: jest.Mocked<RateLimiter>;
  let mockSemaphore: jest.Mocked<DistributedSemaphore>;

  beforeEach(() => {
    mockHttpService = {
      get: jest.fn(),
    } as any;

    mockRateLimiter = {
      allow: jest.fn(),
      wait: jest.fn<() => Promise<void>>(),
      getLimitStatus: jest.fn(),
    } as any;

    mockSemaphore = {
      acquire: jest.fn<() => Promise<string>>().mockResolvedValue('test-slot-id'),
      release: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    client = new PokeApiClient(mockHttpService, mockRateLimiter, mockSemaphore);
  });

  it('should fetch random pokemon and respect rate limiting', async () => {
    const mockData = {
      id: 25,
      name: 'pikachu',
      types: [{ type: { name: 'electric' } }],
      sprites: { front_default: 'https://pikachu-image' },
    };

    mockRateLimiter.wait.mockResolvedValue(undefined);
    mockHttpService.get.mockReturnValue(of({ data: mockData } as any));

    const result = await client.getRandomPokemon();

    expect(result).toEqual({
      id: 25,
      name: 'pikachu',
      types: ['electric'],
      imageUrl: 'https://pikachu-image',
    });
    expect(mockRateLimiter.wait).toHaveBeenCalledWith('pokeapi-global');
    expect(mockHttpService.get).toHaveBeenCalled();
  });

  it('should throw InternalServerErrorException if api call fails', async () => {
    mockRateLimiter.wait.mockResolvedValue(undefined);
    mockHttpService.get.mockReturnValue(throwError(() => new Error('API Error')));

    await expect(client.getRandomPokemon()).rejects.toThrow(InternalServerErrorException);
  });
});
