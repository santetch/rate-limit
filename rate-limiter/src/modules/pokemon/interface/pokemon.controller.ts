import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PokemonService } from '../application/pokemon.service';
import { Pokemon } from '../domain/pokemon.interface';
import { RateLimitInterceptor } from '../../rate-limiter/interface/rate-limit.interceptor';

@ApiTags('Pokemon')
@Controller('random-pokemon')
export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  @Get()
  @UseInterceptors(RateLimitInterceptor)
  @ApiOperation({ summary: 'Get a random Pokemon with rate limiting' })
  @ApiResponse({
    status: 200,
    description: 'Returns a random pokemon.',
    schema: {
      example: {
        id: 25,
        name: 'pikachu',
        types: ['electric'],
        imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png'
      }
    }
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests. Inspect Retry-After and RateLimit-* headers.',
  })
  async getRandomPokemon(): Promise<Pokemon> {
    return this.pokemonService.getRandomPokemon();
  }

  @Get('ranking')
  @ApiOperation({ summary: 'Get Pokemon appearance ranking' })
  async getRanking() {
    return this.pokemonService.getRanking();
  }
}
