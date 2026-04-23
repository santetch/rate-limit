import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PokemonController } from './interface/pokemon.controller';
import { PokemonService } from './application/pokemon.service';
import { PokeApiClient } from './infrastructure/poke-api.client';
import { InMemoryPokemonRepository } from './infrastructure/in-memory-pokemon.repository';

@Module({
  imports: [HttpModule],
  controllers: [PokemonController],
  providers: [
    PokemonService,
    {
      provide: 'PokemonClient',
      useClass: PokeApiClient,
    },
    {
      provide: 'IPokemonRepository',
      useClass: InMemoryPokemonRepository,
    },
  ],
})
export class PokemonModule {}
