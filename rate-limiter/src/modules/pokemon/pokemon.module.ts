import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PokemonController } from './interface/pokemon.controller';
import { PokemonService } from './application/pokemon.service';
import { PokeApiClient } from './infrastructure/poke-api.client';
import { TypeormPokemonRepository } from './infrastructure/typeorm-pokemon.repository';
import { Pokemon } from './domain/entities/pokemon.entity';
import { Type } from './domain/entities/type.entity';
import { Appearance } from './domain/entities/appearance.entity';
import { RateLimitInterceptor } from '../rate-limiter/interface/rate-limit.interceptor';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Pokemon, Type, Appearance]),
  ],
  controllers: [PokemonController],
  providers: [
    PokemonService,
    RateLimitInterceptor,
    {
      provide: 'PokemonClient',
      useClass: PokeApiClient,
    },
    {
      provide: 'IPokemonRepository',
      useClass: TypeormPokemonRepository,
    },
  ],
})
export class PokemonModule {}
