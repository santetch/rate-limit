export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  imageUrl: string;
}

export interface PokemonClient {
  getRandomPokemon(): Promise<Pokemon>;
}
