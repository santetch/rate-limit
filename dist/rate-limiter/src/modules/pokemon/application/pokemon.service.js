"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PokemonService", {
    enumerable: true,
    get: function() {
        return PokemonService;
    }
});
const _common = require("@nestjs/common");
const _pokemoninterface = require("./pokemon.interface");
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
let PokemonService = class PokemonService {
    async getRandomPokemon() {
        return this.pokemonClient.getRandomPokemon();
    }
    constructor(pokemonClient){
        this.pokemonClient = pokemonClient;
    }
};
PokemonService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _common.Inject)('PokemonClient')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _pokemoninterface.PokemonClient === "undefined" ? Object : _pokemoninterface.PokemonClient
    ])
], PokemonService);
