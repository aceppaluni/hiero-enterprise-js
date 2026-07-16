import { describe, it, expect } from "vitest";
import {
    MirrorError,
    MirrorErrorCodes,
    orNull,
} from "../../../src/errors/MirrorError.js";

describe("orNull", () => {
    it("passes a resolved value through untouched", async () => {
        const account = { account: "0.0.98" };
        await expect(orNull(Promise.resolve(account))).resolves.toBe(account);
    });

    it("converts a NotFound rejection to null", async () => {
        const missing = Promise.reject(
            new MirrorError("Account not found", {
                code: MirrorErrorCodes.NotFound,
                status: 404,
            }),
        );
        await expect(orNull(missing)).resolves.toBe(null);
    });

    it("re-throws MirrorErrors that are not NotFound", async () => {
        const rateLimited = new MirrorError("Mirror node returned 429", {
            code: MirrorErrorCodes.MirrorNodeHttpError,
            status: 429,
        });
        await expect(orNull(Promise.reject(rateLimited))).rejects.toBe(
            rateLimited,
        );
    });

    it("re-throws non-Mirror errors", async () => {
        const bug = new TypeError("undefined is not a function");
        await expect(orNull(Promise.reject(bug))).rejects.toBe(bug);
    });
});
