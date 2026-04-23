import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryPokemonRepository } from '../../../src/modules/pokemon/infrastructure/in-memory-pokemon.repository';
import { Pokemon } from '../../../src/modules/pokemon/domain/pokemon.interface';

describe('InMemoryPokemonRepository', () => {
  let repository: InMemoryPokemonRepository;

  beforeEach(() => {
    repository = new InMemoryPokemonRepository();
  });

  describe('saveAppearance', () => {
    it('should save a pokemon appearance', async () => {
      // Given
      const pokemon: Pokemon = {
        id: 25,
        name: 'pikachu',
        types: ['electric'],
        imageUrl: 'https://pikachu-image',
      };

      // When
      await repository.saveAppearance(pokemon);
      const ranking = await repository.getRanking();

      // Then
      expect(ranking).toHaveLength(1);
      expect(ranking[0]).toEqual({ name: 'pikachu', appearances: 1 });
    });

    it('should increment appearance count for the same pokemon', async () => {
      // Given
      const pokemon: Pokemon = {
        id: 25,
        name: 'pikachu',
        types: ['electric'],
        imageUrl: 'https://pikachu-image',
      };

      // When
      await repository.saveAppearance(pokemon);
      await repository.saveAppearance(pokemon);
      const ranking = await repository.getRanking();

      // Then
      expect(ranking).toHaveLength(1);
      expect(ranking[0]).toEqual({ name: 'pikachu', appearances: 2 });
    });
  });

  describe('getRanking', () => {
    it('should return ranking sorted by appearances descending', async () => {
      // Given
      const pikachu: Pokemon = { id: 25, name: 'pikachu', types: [], imageUrl: '' };
      const bulbasaur: Pokemon = { id: 1, name: 'bulbasaur', types: [], imageUrl: '' };
      const charmander: Pokemon = { id: 4, name: 'charmander', types: [], imageUrl: '' };

      // When
      await repository.saveAppearance(pikachu);
      await repository.saveAppearance(pikachu);
      await repository.saveAppearance(pikachu);
      
      await repository.saveAppearance(bulbasaur);
      
      await repository.saveAppearance(charmander);
      await repository.saveAppearance(charmander);

      const ranking = await repository.getRanking();

      // Then
      expect(ranking).toEqual([
        { name: 'pikachu', appearances: 3 },
        { name: 'charmander', appearances: 2 },
        { name: 'bulbasaur', appearances: 1 },
      ]);
    });

    it('should return empty array when no appearances saved', async () => {
      // When
      const ranking = await repository.getRanking();

      // Then
      expect(ranking).toEqual([]);
    });
  });
});
