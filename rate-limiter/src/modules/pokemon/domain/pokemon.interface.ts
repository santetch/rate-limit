export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  imageUrl: string;
}

export interface PokemonAppearance {
  id: number;
  pokemonId: number;
  name: string;
  appearedAt: Date;
}

export interface PokemonClient {
  getRandomPokemon(): Promise<Pokemon>;
}

export interface IPokemonRepository {
  saveAppearance(pokemon: Pokemon): Promise<void>;
  getRanking(): Promise<{ name: string; appearances: number }[]>;
}
