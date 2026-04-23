import { Test, TestingModule } from '@nestjs/testing';
import { PokemonService } from '../../../src/modules/pokemon/application/pokemon.service';
import { InMemoryPokemonRepository } from '../../../src/modules/pokemon/infrastructure/in-memory-pokemon.repository';
import { PokemonClient } from '../../../src/modules/pokemon/domain/pokemon.interface';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('PokemonService Integration', () => {
  let service: PokemonService;
  let repository: InMemoryPokemonRepository;
  let mockPokemonClient: jest.Mocked<PokemonClient>;

  beforeEach(async () => {
    mockPokemonClient = {
      getRandomPokemon: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PokemonService,
        {
          provide: 'IPokemonRepository',
          useClass: InMemoryPokemonRepository,
        },
        {
          provide: 'PokemonClient',
          useValue: mockPokemonClient,
        },
      ],
    }).compile();

    service = module.get<PokemonService>(PokemonService);
    repository = module.get<InMemoryPokemonRepository>('IPokemonRepository');
  });

  it('should persist appearances in the real repository when fetching pokemon', async () => {
    const mockPokemon = {
      id: 25,
      name: 'pikachu',
      types: ['electric'],
      imageUrl: 'https://pikachu-image',
    };
    mockPokemonClient.getRandomPokemon.mockResolvedValue(mockPokemon);

    // Fetch pikachu twice
    await service.getRandomPokemon();
    await service.getRandomPokemon();

    // Fetch bulbasaur once
    mockPokemonClient.getRandomPokemon.mockResolvedValue({
      id: 1,
      name: 'bulbasaur',
      types: ['grass'],
      imageUrl: 'https://bulbasaur-image',
    });
    await service.getRandomPokemon();

    const ranking = await service.getRanking();

    expect(ranking).toEqual([
      { name: 'pikachu', appearances: 2 },
      { name: 'bulbasaur', appearances: 1 },
    ]);
  });
});
