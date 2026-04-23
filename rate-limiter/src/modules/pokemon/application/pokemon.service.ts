import { Injectable, Inject } from '@nestjs/common';
import { Pokemon, PokemonClient, IPokemonRepository } from '../domain/pokemon.interface';

@Injectable()
export class PokemonService {
  constructor(
    @Inject('PokemonClient') private readonly pokemonClient: PokemonClient,
    @Inject('IPokemonRepository') private readonly pokemonRepository: IPokemonRepository,
  ) {}

  async getRandomPokemon(): Promise<Pokemon> {
    const pokemon = await this.pokemonClient.getRandomPokemon();
    await this.pokemonRepository.saveAppearance(pokemon);
    return pokemon;
  }

  async getRanking() {
    return this.pokemonRepository.getRanking();
  }
}
