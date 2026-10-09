import type { DatasheetExtractionResult } from '@hwsd/shared';

export interface ExtractionProvider {
  readonly model: string;
  readonly promptVersion: string;
  extract(text: string): Promise<ProviderExtraction>;
}

export interface ProviderExtraction {
  readonly result: DatasheetExtractionResult;
  readonly model: string;
}

const categories = [
  'MICROCONTROLLER',
  'SENSOR',
  'ACTUATOR',
  'RELAY',
  'DISPLAY',
  'ETHERNET_CONTROLLER',
  'GSM_LTE_MODULE',
  'RF_MODULE',
  'BATTERY',
  'CHARGER',
  'CONNECTOR',
  'EXTERNAL_SERVER_CLOUD',
  'COMPUTER_SBC',
  'POWER_SUPPLY',
  'VOLTAGE_REGULATOR',
  'INTERFACE_CONVERTER_TRANSCEIVER',
  'COMMUNICATION_MODULE',
  'GENERIC_IC',
  'GENERIC_MODULE',
  'GENERIC_BOARD',
  'CUSTOM_COMPONENT',
] as const;

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'label',
          'name',
          'manufacturer',
          'partNumber',
          'category',
          'abstraction',
          'confidence',
          'claims',
        ],
        properties: {
          label: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          manufacturer: { type: ['string', 'null'] },
          partNumber: { type: ['string', 'null'] },
          category: { enum: categories },
          abstraction: {
            enum: ['RAW_IC', 'MODULE', 'FINISHED_SENSOR', 'BOARD', 'SYSTEM', 'CUSTOM'],
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          claims: {
            type: 'array',
            maxItems: 200,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['field', 'value', 'page', 'sourceExcerpt', 'confidence'],
              properties: {
                field: { type: 'string', pattern: '^/' },
                value: { type: 'string' },
                page: { type: 'integer', minimum: 1, maximum: 100 },
                sourceExcerpt: { type: 'string', minLength: 1, maxLength: 500 },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
        },
      },
    },
  },
} as const;

interface OpenAIResponse {
  readonly model?: string;
  readonly output?: readonly {
    readonly type?: string;
    readonly content?: readonly { readonly type?: string; readonly text?: string }[];
  }[];
  readonly error?: { readonly message?: string };
}

export class OpenAIExtractionProvider implements ExtractionProvider {
  public readonly promptVersion = 'hwsd.datasheet-extraction/1';

  public constructor(
    private readonly apiKey: string,
    public readonly model = 'gpt-5.4-mini',
    private readonly endpoint = 'https://api.openai.com/v1/responses',
    private readonly timeoutMs = 60_000,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  public async extract(text: string): Promise<ProviderExtraction> {
    const body = {
      model: this.model,
      store: false,
      max_output_tokens: 12_000,
      input: [
        {
          role: 'developer',
          content:
            'Extract distinct hardware component candidates only from the supplied PDF text. Preserve page evidence. Do not invent missing values. Classification fields are suggestions for human review.',
        },
        { role: 'user', content: text },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'hardware_datasheet_candidates',
          strict: true,
          schema,
        },
      },
    };
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.fetcher(this.endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) {
          const failure = new Error(`OPENAI_HTTP_${response.status}`);
          if (response.status === 429 || response.status >= 500) {
            if (attempt < 2) continue;
            failure.name = 'RetryableProviderError';
          } else {
            failure.name = 'NonRetryableProviderError';
          }
          throw failure;
        }
        const payload = (await response.json()) as OpenAIResponse;
        const output = payload.output
          ?.flatMap(({ content }) => content ?? [])
          .find(({ type }) => type === 'output_text')?.text;
        if (!output) throw new Error('OPENAI_OUTPUT_MISSING');
        return {
          result: parseExtractionResult(JSON.parse(output) as unknown),
          model: payload.model?.trim() || this.model,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('OPENAI_REQUEST_FAILED');
        if (
          attempt < 2 &&
          lastError.name !== 'AbortError' &&
          lastError.name !== 'TimeoutError' &&
          lastError.name !== 'NonRetryableProviderError' &&
          lastError.message !== 'OPENAI_OUTPUT_INVALID'
        )
          continue;
        break;
      }
    }
    throw lastError ?? new Error('OPENAI_REQUEST_FAILED');
  }
}

function parseExtractionResult(value: unknown): DatasheetExtractionResult {
  if (!isRecord(value) || !Array.isArray(value.candidates)) throw invalidOutput();
  if (value.candidates.length < 1 || value.candidates.length > 20) throw invalidOutput();
  return {
    candidates: value.candidates.map((candidate) => {
      if (
        !isRecord(candidate) ||
        !nonEmpty(candidate.label) ||
        !nonEmpty(candidate.name) ||
        !(candidate.manufacturer === null || typeof candidate.manufacturer === 'string') ||
        !(candidate.partNumber === null || typeof candidate.partNumber === 'string') ||
        !categories.includes(candidate.category as (typeof categories)[number]) ||
        !['RAW_IC', 'MODULE', 'FINISHED_SENSOR', 'BOARD', 'SYSTEM', 'CUSTOM'].includes(
          String(candidate.abstraction),
        ) ||
        !confidence(candidate.confidence) ||
        !Array.isArray(candidate.claims) ||
        candidate.claims.length > 200
      )
        throw invalidOutput();
      return {
        label: candidate.label,
        name: candidate.name,
        manufacturer: candidate.manufacturer,
        partNumber: candidate.partNumber,
        category: candidate.category as (typeof categories)[number],
        abstraction: candidate.abstraction as ExtractedAbstraction,
        confidence: candidate.confidence,
        claims: candidate.claims.map((claim) => {
          if (
            !isRecord(claim) ||
            !nonEmpty(claim.field) ||
            !claim.field.startsWith('/') ||
            typeof claim.value !== 'string' ||
            !Number.isInteger(claim.page) ||
            (claim.page as number) < 1 ||
            (claim.page as number) > 100 ||
            !nonEmpty(claim.sourceExcerpt) ||
            claim.sourceExcerpt.length > 500 ||
            !confidence(claim.confidence)
          )
            throw invalidOutput();
          return {
            field: claim.field,
            value: claim.value,
            page: claim.page as number,
            sourceExcerpt: claim.sourceExcerpt,
            confidence: claim.confidence,
          };
        }),
      };
    }),
  };
}

type ExtractedAbstraction = DatasheetExtractionResult['candidates'][number]['abstraction'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function confidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function invalidOutput(): Error {
  return new Error('OPENAI_OUTPUT_INVALID');
}
