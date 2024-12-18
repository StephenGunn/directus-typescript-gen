import { readFile } from "fs/promises";

import type { OpenAPI3 } from "openapi-typescript";
import openapiTS from "openapi-typescript";
import { z } from "zod";

type ReadSpecFileOptions = {
  readonly specFile?: undefined | string;
  readonly host?: undefined | string;
  readonly email?: undefined | string;
  readonly password?: undefined | string;
};

const DirectusAuthResponse = z.object({
  data: z.object({
    access_token: z.string(),
    expires: z.number().int(),
    refresh_token: z.string(),
  }),
});

export const readSpecFile = async (
  options: ReadSpecFileOptions,
): Promise<unknown> => {
  if (typeof options.specFile === `string`) {
    return JSON.parse(
      await readFile(options.specFile, { encoding: `utf-8` }),
    ) as unknown;
  }

  if (typeof options.host !== `string`) {
    throw new Error(`Either inputFile or inputUrl must be specified`);
  }
  if (typeof options.email !== `string`) {
    throw new Error(`email must be specified`);
  }
  if (typeof options.password !== `string`) {
    throw new Error(`password must be specified`);
  }

  const {
    data: { access_token },
  } = await fetch(new URL(`/auth/login`, options.host), {
    body: JSON.stringify({
      email: options.email,
      password: options.password,
    }),
    headers: {
      "Content-Type": `application/json`,
    },
    method: `POST`,
  })
    .then((response) => response.json())
    .then((json) => DirectusAuthResponse.parse(json));

  return (await fetch(new URL(`/server/specs/oas`, options.host), {
    headers: {
      "Authorization": `Bearer ${access_token}`,
      "Content-Type": `application/json`,
    },
  }).then((response) => response.json())) as unknown;
};

type GenerateTypeScriptOptions = {
  readonly includeSystemCollections?: boolean;
  readonly typeName: string;
};

const validIdentifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;

export const generateTypeScript = async (
  spec: OpenAPI3,
  { includeSystemCollections, typeName }: GenerateTypeScriptOptions,
): Promise<string> => {
  if (!validIdentifier.test(typeName)) {
    throw new Error(`Invalid type name: ${typeName}`);
  }

  let source = await openapiTS(spec);

  source += `\n\nexport type ${typeName} = {\n`;

  // Keep a record of discovered collections to avoid duplicates
  const collections: Record<string, string> = {};

  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const collectionPathPattern = /^\/items\/(?<collection>[a-zA-Z0-9_]+)$/;
      const collection =
        collectionPathPattern.exec(path)?.groups?.[`collection`];
      if (typeof collection !== `string` || collection.length === 0) {
        continue;
      }
      if (
        `get` in pathItem &&
        `responses` in pathItem.get &&
        `200` in pathItem.get.responses &&
        `content` in pathItem.get.responses[`200`] &&
        `application/json` in pathItem.get.responses[`200`].content &&
        `schema` in pathItem.get.responses[`200`].content[`application/json`] &&
        `properties` in
          pathItem.get.responses[`200`].content[`application/json`].schema &&
        `data` in
          pathItem.get.responses[`200`].content[`application/json`].schema
            .properties &&
        `items` in
          pathItem.get.responses[`200`].content[`application/json`].schema
            .properties[`data`] &&
        `$ref` in
          pathItem.get.responses[`200`].content[`application/json`].schema
            .properties[`data`].items
      ) {
        const $ref =
          pathItem.get.responses[`200`].content[`application/json`].schema
            .properties[`data`].items.$ref;
        const refPattern = /^#\/components\/schemas\/(?<ref>[a-zA-Z0-9_]+)$/;
        const ref = refPattern.exec($ref)?.groups?.[`ref`];
        if (typeof ref !== `string` || ref.length === 0) {
          continue;
        }
        // Instead of adding directly to source, store in collections
        if (!collections[collection]) {
          collections[collection] = `components["schemas"]["${ref}"][]`;
        }
      }
    }
  }

  // Add directus system collections if requested
  if (spec.components && spec.components.schemas && includeSystemCollections) {
    for (const [schema_key, schema_value] of Object.entries(
      spec.components.schemas,
    )) {
      const x_collection = (schema_value as Record<string, unknown>)[
        `x-collection`
      ] as string | undefined;
      if (typeof x_collection === `string` && x_collection.length > 0) {
        // Only add if not already present
        if (!collections[x_collection]) {
          collections[x_collection] = `components["schemas"]["${schema_key}"]`;
        }
      }
    }
  }

  // After gathering all collections, write them out once
  for (const [collectionName, typeDef] of Object.entries(collections)) {
    source += `  ${collectionName}: ${typeDef};\n`;
  }

  source += `};\n`;

  const toPascalCase = (str: string): string =>
    str
      .replace(/[_\- ]+/g, ` `) // Replace separators with space
      .split(` `)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(``);

  // Iterate over each collection to create individual export types
  for (const [collectionName, typeDef] of Object.entries(collections)) {
    const pascalCaseName = toPascalCase(collectionName);
    source += `export type ${pascalCaseName} = ${typeDef};\n`;
  }

  return source;
};
