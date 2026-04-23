"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PokemonController", {
    enumerable: true,
    get: function() {
        return PokemonController;
    }
});
const _common = require("@nestjs/common");
const _swagger = require("@nestjs/swagger");
const _PokemonService = require("../application/PokemonService");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PokemonController = class PokemonController {
    async getRandomPokemon() {
        return this.pokemonService.getRandomPokemon();
    }
    constructor(pokemonService){
        this.pokemonService = pokemonService;
    }
};
_ts_decorate([
    (0, _common.Get)(),
    (0, _swagger.ApiOperation)({
        summary: 'Get a random Pokemon with rate limiting'
    }),
    (0, _swagger.ApiResponse)({
        status: 200,
        description: 'Returns a random pokemon.',
        schema: {
            example: {
                id: 25,
                name: 'pikachu',
                types: [
                    'electric'
                ],
                imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png'
            }
        }
    }),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Promise)
], PokemonController.prototype, "getRandomPokemon", null);
PokemonController = _ts_decorate([
    (0, _swagger.ApiTags)('Pokemon'),
    (0, _common.Controller)('random-pokemon'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _PokemonService.PokemonService === "undefined" ? Object : _PokemonService.PokemonService
    ])
], PokemonController);
