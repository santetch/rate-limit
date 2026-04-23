import { Injectable, InternalServerErrorException, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Pokemon, PokemonClient } from '../domain/Pokemon';
import { RateLimiter } from '../domain/RateLimiter';

@Injectable()
export class PokeApiClient implements PokemonClient {
  constructor(
    private readonly httpService: HttpService,
    @Inject('RateLimiter') private readonly rateLimiter: RateLimiter,
  ) {}

  async getRandomPokemon(): Promise<Pokemon> {
    const randomId = Math.floor(Math.random() * 150) + 1;
    const url = `https://pokeapi.co/api/v2/pokemon/${randomId}`;

    // Apply rate limiting: Wait until a token is available
    await this.rateLimiter.wait('pokeapi-global');

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      const data = response.data;

      return {
        id: data.id,
        name: data.name,
        types: data.types.map((t: any) => t.type.name),
        imageUrl: data.sprites.front_default,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to fetch pokemon: ${error.message}`);
    }
  }
}
