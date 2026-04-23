import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PokemonModule } from './modules/pokemon/pokemon.module';
import { RateLimiterModule } from './modules/rate-limiter/rate-limiter.module';
import { dataSourceOptions } from './database/data-source';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    PokemonModule,
    RateLimiterModule
  ],
})
export class AppModule {}
