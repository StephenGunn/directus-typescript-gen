#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/cli.ts
var import_promises2 = require("fs/promises");
var import_path = require("path");
var import_yargs = __toESM(require("yargs"), 1);

// src/index.ts
var import_promises = require("fs/promises");
var import_openapi_typescript = __toESM(require("openapi-typescript"), 1);
var import_zod = require("zod");
var DirectusAuthResponse = import_zod.z.object({
  data: import_zod.z.object({
    access_token: import_zod.z.string(),
    expires: import_zod.z.number().int(),
    refresh_token: import_zod.z.string()
  })
});
var readSpecFile = async (options) => {
  if (typeof options.specFile === `string`) {
    return JSON.parse(
      await (0, import_promises.readFile)(options.specFile, { encoding: `utf-8` })
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
  let source = await (0, import_openapi_typescript.default)(spec);
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
  const relationshipPathPattern = /^\/relations\/(?<relation>[a-zA-Z0-9_]+)$/;
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    const relation = relationshipPathPattern.exec(path)?.groups?.[`relation`];
    if (typeof relation !== `string` || relation.length === 0) {
      continue;
    }
    if (`get` in pathItem && `responses` in pathItem.get && `200` in pathItem.get.responses && `content` in pathItem.get.responses[`200`] && `application/json` in pathItem.get.responses[`200`].content && `schema` in pathItem.get.responses[`200`].content[`application/json`] && `properties` in pathItem.get.responses[`200`].content[`application/json`].schema && `data` in pathItem.get.responses[`200`].content[`application/json`].schema.properties && `items` in pathItem.get.responses[`200`].content[`application/json`].schema.properties[`data`] && `$ref` in pathItem.get.responses[`200`].content[`application/json`].schema.properties[`data`].items) {
      const $ref = pathItem.get.responses[`200`].content[`application/json`].schema.properties[`data`].items.$ref;
      const refPattern = /^#\/components\/schemas\/(?<ref>[a-zA-Z0-9_]+)$/;
      const ref = refPattern.exec($ref)?.groups?.[`ref`];
      if (typeof ref !== `string` || ref.length === 0) {
        continue;
      }
      if (!collections[relation]) {
        collections[relation] = `components["schemas"]["${ref}"][]`;
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
  const toPascalCase = (str) => str.replace(/[_\- ]+/g, ` `).split(` `).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(``);
  for (const [collectionName, typeDef] of Object.entries(collections)) {
    const pascalCaseName = toPascalCase(collectionName);
    source += `export type ${pascalCaseName} = ${typeDef};
`;
  }
  return source;
};

// src/cli.ts
var main = async () => {
  const argv = await import_yargs.default.options({
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
    await (0, import_promises2.writeFile)((0, import_path.resolve)(process.cwd(), argv.outFile), ts, {
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
//# sourceMappingURL=cli.cjs.map
