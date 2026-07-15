import type { Request, Response, NextFunction } from "express";
import { assertEnvConfigValid } from "@hiero-hackers/enterprise-core";
import type { HieroAdapterConfig, HieroServices } from "./runtime.js";
import { createHieroRuntime } from "./runtime.js";

export type { HieroAdapterConfig, HieroServices };
export { createHieroRuntime };

/**
 * Augment Express Request to include Hiero services.
 */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            hiero: HieroServices;
        }
    }
}

/**
 * Express middleware that initializes the HieroContext and injects all
 * Hiero services into `req.hiero` — write-side services from core plus
 * mirror node repositories from `@hiero-hackers/enterprise-mirror`.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { hieroMiddleware } from '@hiero-hackers/enterprise-express';
 *
 * const app = express();
 * app.use(hieroMiddleware({ network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' }));
 *
 * app.get('/balance', async (req, res) => {
 *   const balance = await req.hiero.accountService.getOperatorAccountBalance();
 *   res.json(balance);
 * });
 * ```
 */
export function hieroMiddleware(config?: HieroAdapterConfig) {
    if (!config) {
        assertEnvConfigValid();
    }
    const services: HieroServices = createHieroRuntime(config);

    return (req: Request, _res: Response, next: NextFunction) => {
        req.hiero = services;
        next();
    };
}
