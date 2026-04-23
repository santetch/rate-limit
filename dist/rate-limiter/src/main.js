"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _core = require("@nestjs/core");
const _swagger = require("@nestjs/swagger");
const _nestjs = /*#__PURE__*/ _interop_require_wildcard(require("@sentry/nestjs"));
const _profilingnode = require("@sentry/profiling-node");
const _appmodule = require("./app.module");
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
async function bootstrap() {
    // Initialize Sentry
    _nestjs.init({
        dsn: process.env.SENTRY_DSN || '',
        integrations: [
            (0, _profilingnode.nodeProfilingIntegration)()
        ],
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0
    });
    const app = await _core.NestFactory.create(_appmodule.AppModule);
    // Swagger Configuration
    const config = new _swagger.DocumentBuilder().setTitle('Pokemon Rate Limiter API').setDescription('Challenge implementation of a rate-limited Pokemon API client.').setVersion('1.0').addTag('Pokemon').build();
    const document = _swagger.SwaggerModule.createDocument(app, config);
    _swagger.SwaggerModule.setup('api/docs', app, document);
    await app.listen(3000);
    console.log(`Application is running on: http://localhost:3000`);
    console.log(`Swagger Documentation: http://localhost:3000/api/docs`);
}
bootstrap();
