import { Injectable, InternalServerErrorException, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Pokemon, PokemonClient } from '../domain/pokemon.interface';
import { RateLimiter } from '../../rate-limiter/domain/rate-limiter.interface';
import { DistributedSemaphore } from '../../rate-limiter/domain/distributed-semaphore.interface';
import { DISTRIBUTED_SEMAPHORE, WithSemaphore } from '../../rate-limiter/infrastructure/with-semaphore.decorator';
import { Logger, PinoLoggerAdapter } from '../../rate-limiter/infrastructure/logger';
import { rootLogger } from '../../../logging/logger.config';

@Injectable()
export class PokeApiClient implements PokemonClient {
  private readonly logger: Logger = new PinoLoggerAdapter(
    rootLogger.child({ context: 'PokeApiClient' }),
  );

  constructor(
    private readonly httpService: HttpService,
    @Inject('RateLimiter') private readonly rateLimiter: RateLimiter,
    @Inject(DISTRIBUTED_SEMAPHORE) public readonly distributedSemaphore: DistributedSemaphore,
  ) {}

  @WithSemaphore('pokeapi')
  async getRandomPokemon(): Promise<Pokemon> {
    const randomId = Math.floor(Math.random() * 150) + 1;
    const url = `https://pokeapi.co/api/v2/pokemon/${randomId}`;

    await this.rateLimiter.wait('pokeapi-global');

    const start = Date.now();
    try {
      const response = await firstValueFrom(this.httpService.get(url));
      const data = response.data;

      this.logger.info('pokeapi fetch ok', {
        pokemonId: data.id,
        name: data.name,
        durationMs: Date.now() - start,
      });

      return {
        id: data.id,
        name: data.name,
        types: data.types.map((t: any) => t.type.name),
        imageUrl: data.sprites.front_default,
      };
    } catch (error: any) {
      this.logger.error('pokeapi fetch failed', {
        pokemonId: randomId,
        durationMs: Date.now() - start,
        status: error?.response?.status,
        message: error?.message,
      });
      throw new InternalServerErrorException(`Failed to fetch pokemon: ${error.message}`);
    }
  }
}
