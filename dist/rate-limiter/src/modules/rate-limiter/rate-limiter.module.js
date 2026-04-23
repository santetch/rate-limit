"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RateLimiterModule", {
    enumerable: true,
    get: function() {
        return RateLimiterModule;
    }
});
const _common = require("@nestjs/common");
const _tokenbucketlimiter = require("./token-bucket-limiter");
const _logger = require("./logger");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let RateLimiterModule = class RateLimiterModule {
};
RateLimiterModule = _ts_decorate([
    (0, _common.Global)(),
    (0, _common.Module)({
        providers: [
            {
                provide: 'RateLimiter',
                useFactory: ()=>{
                    // Default limit: 1 request per second
                    return new _tokenbucketlimiter.TokenBucketLimiter(1, 1, new _logger.ConsoleLogger());
                }
            }
        ],
        exports: [
            'RateLimiter'
        ]
    })
], RateLimiterModule);
