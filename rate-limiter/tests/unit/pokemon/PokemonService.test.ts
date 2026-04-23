import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { PokemonService } from '../../../src/modules/pokemon/application/pokemon.service';
import { Pokemon, PokemonClient, IPokemonRepository } from '../../../src/modules/pokemon/domain/pokemon.interface';

describe('PokemonService', () => {
  let service: PokemonService;
  let mockPokemonClient: jest.Mocked<PokemonClient>;
  let mockPokemonRepository: jest.Mocked<IPokemonRepository>;

  beforeEach(() => {
    mockPokemonClient = {
      getRandomPokemon: jest.fn<() => Promise<Pokemon>>(),
    } as any;

    mockPokemonRepository = {
      saveAppearance: jest.fn<() => Promise<void>>(),
      getRanking: jest.fn<() => Promise<{ name: string; appearances: number }[]>>(),
    } as any;

    service = new PokemonService(mockPokemonClient, mockPokemonRepository);
  });

  describe('getRandomPokemon', () => {
    it('should fetch pokemon from client and save appearance in repository', async () => {
      // Given
      const mockPokemon: Pokemon = {
        id: 25,
        name: 'pikachu',
        types: ['electric'],
        imageUrl: 'https://pikachu-image',
      };
      mockPokemonClient.getRandomPokemon.mockResolvedValue(mockPokemon);

      // When
      const result = await service.getRandomPokemon();

      // Then
      expect(result).toEqual(mockPokemon);
      expect(mockPokemonClient.getRandomPokemon).toHaveBeenCalledTimes(1);
      expect(mockPokemonRepository.saveAppearance).toHaveBeenCalledWith(mockPokemon);
    });
  });

  describe('getRanking', () => {
    it('should return ranking from repository', async () => {
      // Given
      const mockRanking = [
        { name: 'pikachu', appearances: 5 },
        { name: 'bulbasaur', appearances: 3 },
      ];
      mockPokemonRepository.getRanking.mockResolvedValue(mockRanking);

      // When
      const result = await service.getRanking();

      // Then
      expect(result).toEqual(mockRanking);
      expect(mockPokemonRepository.getRanking).toHaveBeenCalledTimes(1);
    });
  });
});
