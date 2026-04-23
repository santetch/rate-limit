"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PokeApiClient", {
    enumerable: true,
    get: function() {
        return PokeApiClient;
    }
});
const _common = require("@nestjs/common");
const _axios = require("@nestjs/axios");
const _rxjs = require("rxjs");
const _RateLimiter = require("../domain/RateLimiter");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let PokeApiClient = class PokeApiClient {
    async getRandomPokemon() {
        const randomId = Math.floor(Math.random() * 150) + 1;
        const url = `https://pokeapi.co/api/v2/pokemon/${randomId}`;
        // Apply rate limiting: Wait until a token is available
        await this.rateLimiter.wait('pokeapi-global');
        try {
            const response = await (0, _rxjs.firstValueFrom)(this.httpService.get(url));
            const data = response.data;
            return {
                id: data.id,
                name: data.name,
                types: data.types.map((t)=>t.type.name),
                imageUrl: data.sprites.front_default
            };
        } catch (error) {
            throw new _common.InternalServerErrorException(`Failed to fetch pokemon: ${error.message}`);
        }
    }
    constructor(httpService, rateLimiter){
        this.httpService = httpService;
        this.rateLimiter = rateLimiter;
    }
};
PokeApiClient = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(1, (0, _common.Inject)('RateLimiter')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _axios.HttpService === "undefined" ? Object : _axios.HttpService,
        typeof _RateLimiter.RateLimiter === "undefined" ? Object : _RateLimiter.RateLimiter
    ])
], PokeApiClient);
