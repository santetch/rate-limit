import { Module } from '@nestjs/common';
import { PokemonModule } from './modules/pokemon/pokemon.module';
import { RateLimiterModule } from './modules/rate-limiter/rate-limiter.module';

@Module({
  imports: [PokemonModule, RateLimiterModule],
})
export class AppModule {}
