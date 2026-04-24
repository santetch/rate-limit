import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PokemonModule } from './modules/pokemon/pokemon.module';
import { RateLimiterModule } from './modules/rate-limiter/rate-limiter.module';
import { RedisModule } from './modules/redis/redis.module';
import { dataSourceOptions } from './database/data-source';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    RedisModule,
    PokemonModule,
    RateLimiterModule
  ],
})
export class AppModule {}
