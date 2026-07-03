import fp from "fastify-plugin";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { assertEnvConfigValid } from "@hiero-enterprise/core";
import type { HieroAdapterConfig, HieroServices } from "./runtime.js";
import { createHieroRuntime } from "./runtime.js";

export type { HieroAdapterConfig, HieroServices } from "./runtime.js";
export { createHieroRuntime } from "./runtime.js";

/**
 * Augment Fastify instance to include Hiero services.
 */
declare module "fastify" {
    interface FastifyInstance {
        hiero: HieroServices;
    }
}

/**
 * Plugin options — accepts a combined core + mirror config or reads from
 * environment.
 */
export interface HieroPluginOptions extends FastifyPluginOptions {
    config?: HieroAdapterConfig;
}

/**
 * Fastify plugin that initializes the HieroContext and decorates the
 * Fastify instance with all Hiero services at `fastify.hiero` —
 * write-side services from core plus mirror node repositories from
 * `@hiero-enterprise/mirror`.
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { hieroPlugin } from '@hiero-enterprise/fastify';
 *
 * const app = Fastify();
 * app.register(hieroPlugin, { config: { network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' } });
 *
 * app.get('/balance', async (request, reply) => {
 *   const balance = await app.hiero.accountService.getOperatorAccountBalance();
 *   return balance;
 * });
 * ```
 */
const plugin = function (fastify: FastifyInstance, opts: HieroPluginOptions) {
    if (!opts.config) {
        assertEnvConfigValid();
    }
    const runtime = createHieroRuntime(opts.config);
    const services: HieroServices = runtime;

    fastify.decorate("hiero", services);

    // Clean up SDK client on close
    fastify.addHook("onClose", () => {
        runtime.close();
    });
};

export const hieroPlugin = fp(plugin, {
    name: "@hiero-enterprise/fastify",
});
