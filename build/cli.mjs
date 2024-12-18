#!/usr/bin/env node

// src/cli.ts
import { writeFile } from "fs/promises";
import { resolve } from "path";
import yargs from "yargs";

// src/index.ts
import { readFile } from "fs/promises";
import openapiTS from "openapi-typescript";
import { z } from "zod";
var DirectusAuthResponse = z.object({
  data: z.object({
    access_token: z.string(),
    expires: z.number().int(),
    refresh_token: z.string()
  })
});
var readSpecFile = async (options) => {
  if (typeof options.specFile === `string`) {
    return JSON.parse(
      await readFile(options.specFile, { encoding: `utf-8` })
    );
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
    data: { access_token }
  } = await fetch(new URL(`/auth/login`, options.host), {
    body: JSON.stringify({
      email: options.email,
      password: options.password
    }),
    headers: {
      "Content-Type": `application/json`
    },
    method: `POST`
  }).then((response) => response.json()).then((json) => DirectusAuthResponse.parse(json));
  return await fetch(new URL(`/server/specs/oas`, options.host), {
    headers: {
      "Authorization": `Bearer ${access_token}`,
      "Content-Type": `application/json`
    }
  }).then((response) => response.json());
};
var validIdentifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;
var generateTypeScript = async (spec, { includeSystemCollections, typeName }) => {
  if (!validIdentifier.test(typeName)) {
    throw new Error(`Invalid type name: ${typeName}`);
  }
  let source = await openapiTS(spec);
  source += `

export type ${typeName} = {
`;
  const collections = {};
  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const collectionPathPattern = /^\/items\/(?<collection>[a-zA-Z0-9_]+)$/;
      const collection = collectionPathPattern.exec(path)?.groups?.[`collection`];
      if (typeof collection !== `string` || collection.length === 0) {
        continue;
      }
      if (`get` in pathItem && `responses` in pathItem.get && `200` in pathItem.get.responses && `content` in pathItem.get.responses[`200`] && `application/json` in pathItem.get.responses[`200`].content && `schema` in pathItem.get.responses[`200`].content[`application/json`] && `properties` in pathItem.get.responses[`200`].content[`application/json`].schema && `data` in pathItem.get.responses[`200`].content[`application/json`].schema.properties && `items` in pathItem.get.responses[`200`].content[`application/json`].schema.properties[`data`] && `$ref` in pathItem.get.responses[`200`].content[`application/json`].schema.properties[`data`].items) {
        const $ref = pathItem.get.responses[`200`].content[`application/json`].schema.properties[`data`].items.$ref;
        const refPattern = /^#\/components\/schemas\/(?<ref>[a-zA-Z0-9_]+)$/;
        const ref = refPattern.exec($ref)?.groups?.[`ref`];
        if (typeof ref !== `string` || ref.length === 0) {
          continue;
        }
        if (!collections[collection]) {
          collections[collection] = `components["schemas"]["${ref}"][]`;
        }
      }
    }
  }
  if (spec.components && spec.components.schemas && includeSystemCollections) {
    for (const [schema_key, schema_value] of Object.entries(
      spec.components.schemas
    )) {
      const x_collection = schema_value[`x-collection`];
      if (typeof x_collection === `string` && x_collection.length > 0) {
        if (!collections[x_collection]) {
          collections[x_collection] = `components["schemas"]["${schema_key}"]`;
        }
      }
    }
  }
  for (const [collectionName, typeDef] of Object.entries(collections)) {
    source += `  ${collectionName}: ${typeDef};
`;
  }
  source += `};
`;
  return source;
};

// src/cli.ts
var main = async () => {
  const argv = await yargs.options({
    email: {
      alias: `e`,
      description: `Email address`,
      type: `string`
    },
    host: {
      alias: `h`,
      description: `Remote host`,
      type: `string`
    },
    includeSystemCollections: {
      alias: `s`,
      default: false,
      description: `Include system collections`,
      type: `boolean`
    },
    outFile: {
      alias: `o`,
      description: `Output file`,
      type: `string`
    },
    password: {
      alias: `p`,
      description: `Password`,
      type: `string`
    },
    specFile: {
      alias: `i`,
      description: `Input spec file`,
      type: `string`
    },
    typeName: {
      alias: `t`,
      default: `Schema`,
      description: `Type name`,
      type: `string`
    }
  }).argv;
  const spec = await readSpecFile(argv);
  const ts = await generateTypeScript(spec, {
    includeSystemCollections: argv.includeSystemCollections,
    typeName: argv.typeName
  });
  if (typeof argv.outFile === `string`) {
    await writeFile(resolve(process.cwd(), argv.outFile), ts, {
      encoding: `utf-8`
    });
  } else {
    console.log(ts);
  }
};
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
//# sourceMappingURL=cli.mjs.map
