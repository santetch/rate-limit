import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PokemonService } from './pokemon.service';
import { Pokemon } from './pokemon.interface';

@ApiTags('Pokemon')
@Controller('random-pokemon')
export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  @Get()
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
  async getRandomPokemon(): Promise<Pokemon> {
    return this.pokemonService.getRandomPokemon();
  }
}
