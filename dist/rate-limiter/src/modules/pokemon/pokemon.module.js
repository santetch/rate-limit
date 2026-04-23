"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PokemonModule", {
    enumerable: true,
    get: function() {
        return PokemonModule;
    }
});
const _common = require("@nestjs/common");
const _axios = require("@nestjs/axios");
const _pokemoncontroller = require("./pokemon.controller");
const _pokemonservice = require("./pokemon.service");
const _pokeapiclient = require("./poke-api.client");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PokemonModule = class PokemonModule {
};
PokemonModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _axios.HttpModule
        ],
        controllers: [
            _pokemoncontroller.PokemonController
        ],
        providers: [
            _pokemonservice.PokemonService,
            {
                provide: 'PokemonClient',
                useClass: _pokeapiclient.PokeApiClient
            }
        ]
    })
], PokemonModule);
