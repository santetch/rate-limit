import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { PokemonController } from '../../../src/modules/pokemon/interface/pokemon.controller';
import { PokemonService } from '../../../src/modules/pokemon/application/pokemon.service';
import { Pokemon } from '../../../src/modules/pokemon/domain/pokemon.interface';

describe('PokemonController', () => {
  let controller: PokemonController;
  let mockPokemonService: jest.Mocked<PokemonService>;

  beforeEach(() => {
    mockPokemonService = {
      getRandomPokemon: jest.fn<() => Promise<Pokemon>>(),
      getRanking: jest.fn<() => Promise<{ name: string; appearances: number }[]>>(),
    } as any;

    controller = new PokemonController(mockPokemonService);
  });

  describe('getRandomPokemon', () => {
    it('should return a pokemon from the service', async () => {
      const mockPokemon: Pokemon = {
        id: 25,
        name: 'pikachu',
        types: ['electric'],
        imageUrl: 'https://pikachu-image',
      };
      mockPokemonService.getRandomPokemon.mockResolvedValue(mockPokemon);

      const result = await controller.getRandomPokemon();

      expect(result).toEqual(mockPokemon);
      expect(mockPokemonService.getRandomPokemon).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRanking', () => {
    it('should return the ranking from the service', async () => {
      const mockRanking = [{ name: 'pikachu', appearances: 10 }];
      mockPokemonService.getRanking.mockResolvedValue(mockRanking);

      const result = await controller.getRanking();

      expect(result).toEqual(mockRanking);
      expect(mockPokemonService.getRanking).toHaveBeenCalledTimes(1);
    });
  });
});
