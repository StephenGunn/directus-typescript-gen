import type { OpenAPI3 } from "openapi-typescript";
type ReadSpecFileOptions = {
    readonly specFile?: undefined | string;
    readonly host?: undefined | string;
    readonly email?: undefined | string;
    readonly password?: undefined | string;
};
export declare const readSpecFile: (options: ReadSpecFileOptions) => Promise<unknown>;
type GenerateTypeScriptOptions = {
    readonly includeSystemCollections?: boolean;
    readonly typeName: string;
};
export declare const generateTypeScript: (spec: OpenAPI3, { includeSystemCollections, typeName }: GenerateTypeScriptOptions) => Promise<string>;
export {};
