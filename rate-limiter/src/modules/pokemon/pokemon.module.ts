import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PokemonController } from './pokemon.controller';
import { PokemonService } from './pokemon.service';
import { PokeApiClient } from './poke-api.client';

@Module({
  imports: [HttpModule],
  controllers: [PokemonController],
  providers: [
    PokemonService,
    {
      provide: 'PokemonClient',
      useClass: PokeApiClient,
    },
  ],
})
export class PokemonModule {}
