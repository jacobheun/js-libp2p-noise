import {Noise} from "./noise";
export * from "./noise";

/**
 * Default configuration, it will generate new noise static key and enable noise pipes (IK handshake).
 */
export const NOISE = new Noise();
