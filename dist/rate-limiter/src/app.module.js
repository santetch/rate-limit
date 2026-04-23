"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AppModule", {
    enumerable: true,
    get: function() {
        return AppModule;
    }
});
const _common = require("@nestjs/common");
const _axios = require("@nestjs/axios");
const _PokemonController = require("./interface/PokemonController");
const _PokemonService = require("./application/PokemonService");
const _PokeApiClient = require("./infrastructure/PokeApiClient");
const _TokenBucketLimiter = require("./infrastructure/TokenBucketLimiter");
const _Logger = require("./infrastructure/Logger");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let AppModule = class AppModule {
};
AppModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _axios.HttpModule
        ],
        controllers: [
            _PokemonController.PokemonController
        ],
        providers: [
            _PokemonService.PokemonService,
            {
                provide: 'RateLimiter',
                useFactory: ()=>{
                    // Default limit: 1 request per second
                    return new _TokenBucketLimiter.TokenBucketLimiter(1, 1, new _Logger.ConsoleLogger());
                }
            },
            {
                provide: 'PokemonClient',
                useClass: _PokeApiClient.PokeApiClient
            }
        ]
    })
], AppModule);
