"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get ConsoleLogger () {
        return ConsoleLogger;
    },
    get NoOpLogger () {
        return NoOpLogger;
    }
});
let ConsoleLogger = class ConsoleLogger {
    info(message, ...meta) {
        console.log(`[INFO] ${message}`, ...meta);
    }
    warn(message, ...meta) {
        console.warn(`[WARN] ${message}`, ...meta);
    }
    error(message, ...meta) {
        console.error(`[ERROR] ${message}`, ...meta);
    }
};
let NoOpLogger = class NoOpLogger {
    info() {}
    warn() {}
    error() {}
};
