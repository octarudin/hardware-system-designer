import { ApplicationError } from '../errors.js';

const MAX_NESTING_DEPTH = 100;

function invalid(message: string): never {
  throw new ApplicationError(
    422,
    'PROJECT_IMPORT_INVALID_JSON',
    'The project file is not valid JSON.',
    [{ code: 'STRICT_JSON_INVALID', path: '/', message }],
  );
}

export function parseStrictJson(source: string): unknown {
  let position = 0;
  const whitespace = () => {
    while (/\s/u.test(source[position] ?? '')) position += 1;
  };
  const stringToken = (): string => {
    const start = position;
    if (source[position] !== '"') invalid('Expected a JSON string.');
    position += 1;
    while (position < source.length) {
      const character = source[position];
      if (character === '"') {
        position += 1;
        try {
          return JSON.parse(source.slice(start, position)) as string;
        } catch {
          invalid('A JSON string contains an invalid escape sequence.');
        }
      }
      if (character === '\\') position += 2;
      else {
        if ((character?.codePointAt(0) ?? 0) < 0x20)
          invalid('A JSON string contains a control character.');
        position += 1;
      }
    }
    return invalid('A JSON string is not terminated.');
  };
  const value = (depth: number): void => {
    if (depth > MAX_NESTING_DEPTH) invalid('The JSON nesting depth exceeds the supported limit.');
    whitespace();
    const character = source[position];
    if (character === '{') {
      position += 1;
      whitespace();
      const keys = new Set<string>();
      if (source[position] === '}') {
        position += 1;
        return;
      }
      while (position < source.length) {
        whitespace();
        const key = stringToken();
        if (keys.has(key)) invalid(`Duplicate object key: ${key}`);
        keys.add(key);
        whitespace();
        if (source[position] !== ':') invalid('Expected a colon after an object key.');
        position += 1;
        value(depth + 1);
        whitespace();
        if (source[position] === '}') {
          position += 1;
          return;
        }
        if (source[position] !== ',') invalid('Expected a comma between object members.');
        position += 1;
      }
      invalid('A JSON object is not terminated.');
    }
    if (character === '[') {
      position += 1;
      whitespace();
      if (source[position] === ']') {
        position += 1;
        return;
      }
      while (position < source.length) {
        value(depth + 1);
        whitespace();
        if (source[position] === ']') {
          position += 1;
          return;
        }
        if (source[position] !== ',') invalid('Expected a comma between array values.');
        position += 1;
      }
      invalid('A JSON array is not terminated.');
    }
    if (character === '"') {
      stringToken();
      return;
    }
    const remainder = source.slice(position);
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(
      remainder,
    )?.[0];
    if (!token) invalid('Unexpected token in JSON input.');
    position += token.length;
  };

  whitespace();
  value(0);
  whitespace();
  if (position !== source.length) invalid('Unexpected content follows the JSON value.');
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return invalid('The JSON document could not be parsed.');
  }
}
