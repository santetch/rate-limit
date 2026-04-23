import { Injectable, Inject } from '@nestjs/common';
import { Pokemon, PokemonClient } from '../domain/Pokemon';

@Injectable()
export class PokemonService {
  constructor(
    @Inject('PokemonClient') private readonly pokemonClient: PokemonClient,
  ) {}

  async getRandomPokemon(): Promise<Pokemon> {
    return this.pokemonClient.getRandomPokemon();
  }
}
