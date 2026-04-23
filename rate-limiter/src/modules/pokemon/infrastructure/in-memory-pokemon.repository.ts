import { Injectable } from '@nestjs/common';
import { IPokemonRepository, Pokemon, PokemonAppearance } from '../domain/pokemon.interface';

@Injectable()
export class InMemoryPokemonRepository implements IPokemonRepository {
  private appearances: PokemonAppearance[] = [];
  private nextId = 1;

  async saveAppearance(pokemon: Pokemon): Promise<void> {
    const appearance: PokemonAppearance = {
      id: this.nextId++,
      pokemonId: pokemon.id,
      name: pokemon.name,
      appearedAt: new Date(),
    };
    this.appearances.push(appearance);
  }

  async getRanking(): Promise<{ name: string; appearances: number }[]> {
    const counts = this.appearances.reduce((acc, curr) => {
      acc[curr.name] = (acc[curr.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([name, appearances]) => ({ name, appearances }))
      .sort((a, b) => b.appearances - a.appearances);
  }
}
