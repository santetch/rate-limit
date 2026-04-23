import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PokemonController } from './interface/PokemonController';
import { PokemonService } from './application/PokemonService';
import { PokeApiClient } from './infrastructure/PokeApiClient';
import { TokenBucketLimiter } from './infrastructure/TokenBucketLimiter';
import { ConsoleLogger } from './infrastructure/Logger';

@Module({
  imports: [HttpModule],
  controllers: [PokemonController],
  providers: [
    PokemonService,
    {
      provide: 'RateLimiter',
      useFactory: () => {
        // Default limit: 1 request per second
        return new TokenBucketLimiter(1, 1, new ConsoleLogger());
      },
    },
    {
      provide: 'PokemonClient',
      useClass: PokeApiClient,
    },
  ],
})
export class AppModule {}
