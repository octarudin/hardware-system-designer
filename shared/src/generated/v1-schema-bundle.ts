/* eslint-disable */
/**
 * Generated from docs/schemas by scripts/generate-contracts.mjs.
 * Do not edit by hand.
 */

export const V1_SCHEMAS = [
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://hardware-system-designer.local/schemas/component-schema-v1.schema.json',
    title: 'Hardware System Designer Component Schema V1',
    description: 'Canonical published component definition for Hardware System Designer V1.',
    type: 'object',
    additionalProperties: false,
    required: [
      'schema_version',
      'component_id',
      'revision',
      'identity',
      'classification',
      'lifecycle',
      'provenance',
      'pins',
      'ports',
      'resources',
      'address_capabilities',
      'notes',
      'created_at',
      'updated_at',
      'revision_notes',
    ],
    properties: {
      schema_version: {
        const: 'hwsd.component/1',
      },
      component_id: {
        $ref: '#/$defs/componentId',
      },
      revision: {
        type: 'integer',
        minimum: 1,
      },
      identity: {
        $ref: '#/$defs/identity',
      },
      classification: {
        $ref: '#/$defs/classification',
      },
      lifecycle: {
        $ref: '#/$defs/lifecycle',
      },
      provenance: {
        $ref: '#/$defs/provenance',
      },
      pins: {
        type: 'array',
        items: {
          $ref: '#/$defs/pin',
        },
      },
      ports: {
        type: 'array',
        items: {
          $ref: 'port-interface-schema-v1.schema.json#/$defs/port',
        },
      },
      resources: {
        type: 'array',
        items: {
          $ref: '#/$defs/resource',
        },
      },
      address_capabilities: {
        type: 'array',
        items: {
          $ref: '#/$defs/addressCapability',
        },
      },
      notes: {
        type: 'array',
        items: {
          $ref: '#/$defs/note',
        },
      },
      created_at: {
        $ref: '#/$defs/timestamp',
      },
      updated_at: {
        $ref: '#/$defs/timestamp',
      },
      revision_notes: {
        $ref: '#/$defs/nonEmptyString',
      },
    },
    $defs: {
      nonEmptyString: {
        type: 'string',
        minLength: 1,
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
      },
      componentId: {
        type: 'string',
        pattern: '^CMP-[A-Z0-9][A-Z0-9_-]*$',
      },
      localId: {
        type: 'string',
        pattern: '^[A-Z]+-[A-Z0-9][A-Z0-9_-]*$',
      },
      nonNegativeNumber: {
        type: 'number',
        minimum: 0,
      },
      voltage: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'unit'],
        properties: {
          value: {
            type: 'number',
          },
          unit: {
            const: 'V',
          },
        },
      },
      current: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'unit'],
        properties: {
          value: {
            $ref: '#/$defs/nonNegativeNumber',
          },
          unit: {
            const: 'A',
          },
        },
      },
      voltageRange: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          min: {
            $ref: '#/$defs/voltage',
          },
          nominal: {
            $ref: '#/$defs/voltage',
          },
          max: {
            $ref: '#/$defs/voltage',
          },
        },
      },
      identity: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: {
            $ref: '#/$defs/nonEmptyString',
          },
          manufacturer: {
            $ref: '#/$defs/nonEmptyString',
          },
          part_number: {
            $ref: '#/$defs/nonEmptyString',
          },
          family: {
            $ref: '#/$defs/nonEmptyString',
          },
          variant: {
            $ref: '#/$defs/nonEmptyString',
          },
        },
      },
      classification: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'abstraction'],
        properties: {
          category: {
            enum: [
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
            ],
          },
          abstraction: {
            enum: ['RAW_IC', 'MODULE', 'FINISHED_SENSOR', 'BOARD', 'SYSTEM', 'CUSTOM'],
          },
        },
      },
      lifecycle: {
        type: 'object',
        additionalProperties: false,
        required: ['status'],
        properties: {
          status: {
            enum: [
              'AI_GENERATED',
              'REVIEW_REQUIRED',
              'USER_REVIEWED',
              'PENDING_ADMIN_VERIFICATION',
              'VERIFIED',
              'DEPRECATED',
              'DISABLED',
            ],
          },
          status_reason: {
            $ref: '#/$defs/nonEmptyString',
          },
          verified_by: {
            $ref: '#/$defs/nonEmptyString',
          },
          verified_at: {
            $ref: '#/$defs/timestamp',
          },
          superseded_by_revision: {
            type: 'integer',
            minimum: 2,
          },
        },
        allOf: [
          {
            if: {
              properties: {
                status: {
                  const: 'VERIFIED',
                },
              },
              required: ['status'],
            },
            then: {
              required: ['verified_by', 'verified_at'],
            },
            else: {
              not: {
                anyOf: [
                  {
                    required: ['verified_by'],
                  },
                  {
                    required: ['verified_at'],
                  },
                ],
              },
            },
          },
          {
            if: {
              properties: {
                status: {
                  enum: ['DEPRECATED', 'DISABLED'],
                },
              },
              required: ['status'],
            },
            then: {
              required: ['status_reason'],
            },
          },
        ],
      },
      datasheet: {
        type: 'object',
        additionalProperties: false,
        required: [
          'datasheet_id',
          'filename',
          'media_type',
          'byte_size',
          'storage_ref',
          'uploaded_at',
        ],
        properties: {
          datasheet_id: {
            $ref: '#/$defs/localId',
          },
          filename: {
            $ref: '#/$defs/nonEmptyString',
          },
          media_type: {
            const: 'application/pdf',
          },
          byte_size: {
            type: 'integer',
            minimum: 1,
            maximum: 10485760,
          },
          storage_ref: {
            $ref: '#/$defs/nonEmptyString',
          },
          sha256: {
            type: 'string',
            pattern: '^[a-fA-F0-9]{64}$',
          },
          page_count: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
          },
          uploaded_at: {
            $ref: '#/$defs/timestamp',
          },
        },
      },
      fieldEvidence: {
        type: 'object',
        additionalProperties: false,
        required: ['field'],
        properties: {
          field: {
            type: 'string',
            pattern: '^/',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
          datasheet_id: {
            $ref: '#/$defs/localId',
          },
          pages: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
            },
          },
          source_excerpt: {
            $ref: '#/$defs/nonEmptyString',
          },
          reviewer_note: {
            $ref: '#/$defs/nonEmptyString',
          },
        },
      },
      provenance: {
        type: 'object',
        additionalProperties: false,
        required: ['origin', 'datasheets', 'field_evidence'],
        properties: {
          origin: {
            enum: ['AI_DATASHEET_EXTRACTION', 'MANUAL', 'IMPORTED', 'MIGRATED'],
          },
          extracted_at: {
            $ref: '#/$defs/timestamp',
          },
          extraction_model: {
            $ref: '#/$defs/nonEmptyString',
          },
          datasheets: {
            type: 'array',
            items: {
              $ref: '#/$defs/datasheet',
            },
          },
          field_evidence: {
            type: 'array',
            items: {
              $ref: '#/$defs/fieldEvidence',
            },
          },
        },
        allOf: [
          {
            if: {
              properties: {
                origin: {
                  const: 'AI_DATASHEET_EXTRACTION',
                },
              },
              required: ['origin'],
            },
            then: {
              required: ['extracted_at', 'extraction_model'],
              properties: {
                datasheets: {
                  minItems: 1,
                },
              },
            },
          },
        ],
      },
      requirement: {
        enum: ['REQUIRED', 'OPTIONAL'],
      },
      pinDirection: {
        enum: ['INPUT', 'OUTPUT', 'BIDIRECTIONAL', 'POWER_INPUT', 'POWER_OUTPUT', 'PASSIVE'],
      },
      alternateFunction: {
        type: 'object',
        additionalProperties: false,
        required: ['function_id', 'interface_type', 'signal'],
        properties: {
          function_id: {
            $ref: '#/$defs/localId',
          },
          interface_type: {
            $ref: 'port-interface-schema-v1.schema.json#/$defs/interfaceType',
          },
          signal: {
            $ref: '#/$defs/nonEmptyString',
          },
          resource_id: {
            $ref: '#/$defs/localId',
          },
          channel: {
            $ref: '#/$defs/nonEmptyString',
          },
          mux_group: {
            $ref: '#/$defs/nonEmptyString',
          },
        },
      },
      pin: {
        type: 'object',
        additionalProperties: false,
        required: [
          'pin_id',
          'number',
          'name',
          'direction',
          'electrical_type',
          'requirement',
          'alternate_functions',
        ],
        properties: {
          pin_id: {
            $ref: '#/$defs/localId',
          },
          number: {
            $ref: '#/$defs/nonEmptyString',
          },
          name: {
            $ref: '#/$defs/nonEmptyString',
          },
          gpio_number: {
            $ref: '#/$defs/nonEmptyString',
          },
          direction: {
            $ref: '#/$defs/pinDirection',
          },
          electrical_type: {
            enum: [
              'DIGITAL',
              'ANALOG',
              'POWER',
              'GROUND',
              'OPEN_DRAIN',
              'OPEN_COLLECTOR',
              'DIFFERENTIAL',
              'PASSIVE',
              'CUSTOM',
            ],
          },
          requirement: {
            $ref: '#/$defs/requirement',
          },
          logic_voltage: {
            $ref: '#/$defs/voltageRange',
          },
          absolute_voltage: {
            $ref: '#/$defs/voltageRange',
          },
          max_source_current: {
            $ref: '#/$defs/current',
          },
          max_sink_current: {
            $ref: '#/$defs/current',
          },
          alternate_functions: {
            type: 'array',
            items: {
              $ref: '#/$defs/alternateFunction',
            },
          },
        },
      },
      resourceType: {
        enum: [
          'GPIO',
          'UART',
          'SPI',
          'I2C',
          'ADC',
          'DAC',
          'PWM',
          'CAN',
          'LIN',
          'ONE_WIRE',
          'ETHERNET',
          'CUSTOM',
        ],
      },
      resourceChannel: {
        type: 'object',
        additionalProperties: false,
        required: ['channel', 'signal'],
        properties: {
          channel: {
            $ref: '#/$defs/nonEmptyString',
          },
          signal: {
            $ref: '#/$defs/nonEmptyString',
          },
          optional: {
            type: 'boolean',
            default: false,
          },
        },
      },
      pinAssignment: {
        type: 'object',
        additionalProperties: false,
        required: ['signal', 'pin_id', 'function_id'],
        properties: {
          signal: {
            $ref: '#/$defs/nonEmptyString',
          },
          pin_id: {
            $ref: '#/$defs/localId',
          },
          function_id: {
            $ref: '#/$defs/localId',
          },
        },
      },
      pinMapping: {
        type: 'object',
        additionalProperties: false,
        required: ['mapping_id', 'assignments'],
        properties: {
          mapping_id: {
            $ref: '#/$defs/localId',
          },
          assignments: {
            type: 'array',
            minItems: 1,
            items: {
              $ref: '#/$defs/pinAssignment',
            },
          },
        },
      },
      resource: {
        type: 'object',
        additionalProperties: false,
        required: [
          'resource_id',
          'type',
          'name',
          'share_mode',
          'channels',
          'compatible_pin_mappings',
        ],
        properties: {
          resource_id: {
            $ref: '#/$defs/localId',
          },
          type: {
            $ref: '#/$defs/resourceType',
          },
          custom_type: {
            $ref: '#/$defs/nonEmptyString',
          },
          name: {
            $ref: '#/$defs/nonEmptyString',
          },
          share_mode: {
            enum: ['EXCLUSIVE', 'SHARED_BUS', 'CHANNELIZED'],
          },
          channels: {
            type: 'array',
            items: {
              $ref: '#/$defs/resourceChannel',
            },
          },
          compatible_pin_mappings: {
            type: 'array',
            items: {
              $ref: '#/$defs/pinMapping',
            },
          },
        },
        allOf: [
          {
            if: {
              properties: {
                type: {
                  const: 'CUSTOM',
                },
              },
              required: ['type'],
            },
            then: {
              required: ['custom_type'],
            },
            else: {
              not: {
                required: ['custom_type'],
              },
            },
          },
        ],
      },
      addressCapability: {
        type: 'object',
        additionalProperties: false,
        required: ['address_id', 'port_id', 'kind', 'mode'],
        properties: {
          address_id: {
            $ref: '#/$defs/localId',
          },
          port_id: {
            $ref: '#/$defs/localId',
          },
          kind: {
            enum: ['I2C_7_BIT', 'I2C_10_BIT', 'MODBUS_RTU_SLAVE'],
          },
          mode: {
            enum: ['FIXED', 'SELECTABLE', 'USER_CONFIGURABLE'],
          },
          allowed_values: {
            type: 'array',
            uniqueItems: true,
            items: {
              type: 'integer',
              minimum: 0,
              maximum: 1023,
            },
          },
          range: {
            type: 'object',
            additionalProperties: false,
            required: ['min', 'max'],
            properties: {
              min: {
                type: 'integer',
                minimum: 0,
                maximum: 1023,
              },
              max: {
                type: 'integer',
                minimum: 0,
                maximum: 1023,
              },
            },
          },
        },
        allOf: [
          {
            if: {
              properties: {
                mode: {
                  const: 'FIXED',
                },
              },
              required: ['mode'],
            },
            then: {
              required: ['allowed_values'],
              properties: {
                allowed_values: {
                  minItems: 1,
                  maxItems: 1,
                },
              },
              not: {
                required: ['range'],
              },
            },
          },
          {
            if: {
              properties: {
                mode: {
                  const: 'SELECTABLE',
                },
              },
              required: ['mode'],
            },
            then: {
              required: ['allowed_values'],
              properties: {
                allowed_values: {
                  minItems: 2,
                },
              },
              not: {
                required: ['range'],
              },
            },
          },
          {
            if: {
              properties: {
                mode: {
                  const: 'USER_CONFIGURABLE',
                },
              },
              required: ['mode'],
            },
            then: {
              required: ['range'],
              not: {
                required: ['allowed_values'],
              },
            },
          },
        ],
      },
      note: {
        type: 'object',
        additionalProperties: false,
        required: ['note_id', 'text', 'severity'],
        properties: {
          note_id: {
            $ref: '#/$defs/localId',
          },
          text: {
            $ref: '#/$defs/nonEmptyString',
          },
          severity: {
            enum: ['INFO', 'WARNING', 'CRITICAL'],
          },
          applies_to: {
            type: 'string',
            pattern: '^/',
          },
        },
      },
    },
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://hardware-system-designer.local/schemas/port-interface-schema-v1.schema.json',
    title: 'Hardware System Designer Port/Interface Schema V1',
    description:
      'Canonical standalone and reusable port/interface definition for Hardware System Designer V1.',
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'port'],
    properties: {
      schema_version: {
        const: 'hwsd.port-interface/1',
      },
      port: {
        $ref: '#/$defs/port',
      },
    },
    $defs: {
      nonEmptyString: {
        type: 'string',
        minLength: 1,
      },
      localId: {
        type: 'string',
        pattern: '^[A-Z]+-[A-Z0-9][A-Z0-9_-]*$',
      },
      portId: {
        type: 'string',
        pattern: '^PORT-[A-Z0-9][A-Z0-9_-]*$',
      },
      interfaceId: {
        type: 'string',
        pattern: '^IFACE-[A-Z0-9][A-Z0-9_-]*$',
      },
      voltage: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'unit'],
        properties: {
          value: {
            type: 'number',
          },
          unit: {
            const: 'V',
          },
        },
      },
      current: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'unit'],
        properties: {
          value: {
            type: 'number',
            minimum: 0,
          },
          unit: {
            const: 'A',
          },
        },
      },
      frequency: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'unit'],
        properties: {
          value: {
            type: 'number',
            minimum: 0,
          },
          unit: {
            const: 'Hz',
          },
        },
      },
      voltageRange: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          min: {
            $ref: '#/$defs/voltage',
          },
          nominal: {
            $ref: '#/$defs/voltage',
          },
          max: {
            $ref: '#/$defs/voltage',
          },
        },
      },
      currentRange: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          min: {
            $ref: '#/$defs/current',
          },
          nominal: {
            $ref: '#/$defs/current',
          },
          max: {
            $ref: '#/$defs/current',
          },
        },
      },
      requirement: {
        enum: ['REQUIRED', 'OPTIONAL'],
      },
      portDirection: {
        enum: ['INPUT', 'OUTPUT', 'BIDIRECTIONAL', 'PASSIVE'],
      },
      interfaceType: {
        enum: [
          'GPIO_INPUT',
          'GPIO_OUTPUT',
          'GPIO_BIDIRECTIONAL',
          'PWM',
          'INTERRUPT',
          'DIGITAL_CUSTOM',
          'UART_TTL',
          'RS232',
          'RS485',
          'CAN',
          'LIN',
          'I2C',
          'SPI',
          'ONE_WIRE',
          'ANALOG_INPUT',
          'ANALOG_OUTPUT',
          'ADC_INPUT',
          'DAC_OUTPUT',
          'ANALOG_0_10V',
          'ANALOG_4_20MA',
          'ETHERNET',
          'WIFI',
          'BLE',
          'GSM',
          'LTE',
          'LORA',
          'RF_CUSTOM',
          'DRY_CONTACT',
          'RELAY_CONTACT',
          'ENABLE',
          'RESET',
          'POWER_INPUT',
          'POWER_OUTPUT',
          'BATTERY_INPUT',
          'BATTERY_OUTPUT',
          'CHARGER_INPUT',
          'CHARGER_OUTPUT',
          'CUSTOM',
        ],
      },
      busMode: {
        enum: ['POINT_TO_POINT', 'SHARED_BUS', 'MULTI_DROP', 'WIRELESS', 'NOT_APPLICABLE'],
      },
      busRole: {
        enum: ['CONTROLLER', 'TARGET', 'PEER'],
      },
      interface: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'bus_mode'],
        properties: {
          type: {
            $ref: '#/$defs/interfaceType',
          },
          custom_type: {
            type: 'string',
            minLength: 1,
            pattern: '^[A-Z0-9][A-Z0-9_.+-]*$',
          },
          interface_id: {
            $ref: '#/$defs/interfaceId',
          },
          interface_revision: {
            type: 'integer',
            minimum: 1,
          },
          bus_mode: {
            $ref: '#/$defs/busMode',
          },
          bus_role: {
            $ref: '#/$defs/busRole',
          },
          logic_voltage: {
            $ref: '#/$defs/voltageRange',
          },
          signal_voltage: {
            $ref: '#/$defs/voltageRange',
          },
          signal_current: {
            $ref: '#/$defs/currentRange',
          },
          max_frequency: {
            $ref: '#/$defs/frequency',
          },
          protocol: {
            type: 'string',
            minLength: 1,
            pattern: '^[A-Z0-9][A-Z0-9_.+-]*$',
          },
        },
        dependentRequired: {
          interface_id: ['interface_revision'],
          interface_revision: ['interface_id'],
        },
        allOf: [
          {
            if: {
              properties: {
                type: {
                  enum: ['CUSTOM', 'DIGITAL_CUSTOM', 'RF_CUSTOM'],
                },
              },
              required: ['type'],
            },
            then: {
              required: ['custom_type'],
            },
            else: {
              not: {
                required: ['custom_type'],
              },
            },
          },
        ],
      },
      binding: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pin_id: {
            $ref: '#/$defs/localId',
          },
          function_id: {
            $ref: '#/$defs/localId',
          },
          resource_id: {
            $ref: '#/$defs/localId',
          },
          channel: {
            $ref: '#/$defs/nonEmptyString',
          },
          signal: {
            $ref: '#/$defs/nonEmptyString',
          },
        },
        anyOf: [
          {
            required: ['pin_id'],
          },
          {
            required: ['resource_id'],
          },
        ],
        dependentRequired: {
          function_id: ['pin_id'],
          channel: ['resource_id'],
        },
      },
      power: {
        type: 'object',
        additionalProperties: false,
        required: ['role'],
        properties: {
          role: {
            enum: ['SOURCE', 'LOAD'],
          },
          voltage: {
            $ref: '#/$defs/voltageRange',
          },
          typical_current: {
            $ref: '#/$defs/current',
          },
          max_current: {
            $ref: '#/$defs/current',
          },
          peak_current: {
            $ref: '#/$defs/current',
          },
          regulation: {
            enum: ['REGULATED', 'UNREGULATED', 'BATTERY', 'UNKNOWN'],
          },
          polarity: {
            enum: ['POSITIVE', 'NEGATIVE', 'AC', 'NOT_APPLICABLE'],
          },
        },
      },
      port: {
        type: 'object',
        additionalProperties: false,
        required: ['port_id', 'name', 'requirement', 'direction', 'interface', 'bindings'],
        properties: {
          port_id: {
            $ref: '#/$defs/portId',
          },
          name: {
            $ref: '#/$defs/nonEmptyString',
          },
          requirement: {
            $ref: '#/$defs/requirement',
          },
          direction: {
            $ref: '#/$defs/portDirection',
          },
          interface: {
            $ref: '#/$defs/interface',
          },
          bindings: {
            type: 'array',
            items: {
              $ref: '#/$defs/binding',
            },
          },
          power: {
            $ref: '#/$defs/power',
          },
          description: {
            $ref: '#/$defs/nonEmptyString',
          },
        },
        allOf: [
          {
            if: {
              required: ['power'],
            },
            then: {
              properties: {
                interface: {
                  properties: {
                    type: {
                      enum: [
                        'POWER_INPUT',
                        'POWER_OUTPUT',
                        'BATTERY_INPUT',
                        'BATTERY_OUTPUT',
                        'CHARGER_INPUT',
                        'CHARGER_OUTPUT',
                      ],
                    },
                  },
                },
              },
            },
          },
          {
            if: {
              properties: {
                interface: {
                  properties: {
                    type: {
                      enum: [
                        'POWER_INPUT',
                        'POWER_OUTPUT',
                        'BATTERY_INPUT',
                        'BATTERY_OUTPUT',
                        'CHARGER_INPUT',
                        'CHARGER_OUTPUT',
                      ],
                    },
                  },
                  required: ['type'],
                },
              },
              required: ['interface'],
            },
            then: {
              required: ['power'],
            },
            else: {
              not: {
                required: ['power'],
              },
            },
          },
          {
            if: {
              properties: {
                interface: {
                  properties: {
                    type: {
                      enum: ['POWER_INPUT', 'BATTERY_INPUT', 'CHARGER_INPUT'],
                    },
                  },
                  required: ['type'],
                },
              },
              required: ['interface'],
            },
            then: {
              properties: {
                direction: {
                  const: 'INPUT',
                },
                power: {
                  properties: {
                    role: {
                      const: 'LOAD',
                    },
                  },
                  required: ['role'],
                },
              },
            },
          },
          {
            if: {
              properties: {
                interface: {
                  properties: {
                    type: {
                      enum: ['POWER_OUTPUT', 'BATTERY_OUTPUT', 'CHARGER_OUTPUT'],
                    },
                  },
                  required: ['type'],
                },
              },
              required: ['interface'],
            },
            then: {
              properties: {
                direction: {
                  const: 'OUTPUT',
                },
                power: {
                  properties: {
                    role: {
                      const: 'SOURCE',
                    },
                  },
                  required: ['role'],
                },
              },
            },
          },
        ],
      },
    },
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://hardware-system-designer.local/schemas/connection-rule-result-v1.schema.json',
    title: 'Hardware System Designer Connection Rule Result V1',
    description: 'Deterministic evaluation result produced by Connection & Rule Engine V1.',
    type: 'object',
    additionalProperties: false,
    required: [
      'ruleset_version',
      'mode',
      'subject',
      'verdict',
      'allowed',
      'requires_confirmation',
      'findings',
      'allocation_effects',
    ],
    properties: {
      ruleset_version: {
        const: 'hwsd.connection-rules/1',
      },
      mode: {
        enum: ['CONNECTION_PREVIEW', 'CONNECTION_COMMIT', 'DESIGN_CHECK'],
      },
      subject: {
        $ref: '#/$defs/subject',
      },
      verdict: {
        enum: ['VALID', 'WARNING', 'ERROR'],
      },
      allowed: {
        type: 'boolean',
      },
      requires_confirmation: {
        type: 'boolean',
      },
      findings: {
        type: 'array',
        items: {
          $ref: '#/$defs/finding',
        },
      },
      allocation_effects: {
        type: 'array',
        items: {
          $ref: '#/$defs/allocationEffect',
        },
      },
      summary: {
        $ref: '#/$defs/summary',
      },
    },
    allOf: [
      {
        if: {
          properties: {
            verdict: {
              const: 'ERROR',
            },
          },
          required: ['verdict'],
        },
        then: {
          properties: {
            allowed: {
              const: false,
            },
            requires_confirmation: {
              const: false,
            },
            allocation_effects: {
              maxItems: 0,
            },
            findings: {
              contains: {
                type: 'object',
                properties: {
                  severity: {
                    const: 'ERROR',
                  },
                },
                required: ['severity'],
              },
            },
          },
        },
      },
      {
        if: {
          properties: {
            mode: {
              const: 'DESIGN_CHECK',
            },
          },
          required: ['mode'],
        },
        then: {
          required: ['summary'],
          properties: {
            allocation_effects: {
              maxItems: 0,
            },
          },
        },
        else: {
          not: {
            required: ['summary'],
          },
        },
      },
      {
        if: {
          properties: {
            verdict: {
              const: 'WARNING',
            },
          },
          required: ['verdict'],
        },
        then: {
          properties: {
            allowed: {
              const: true,
            },
            findings: {
              contains: {
                type: 'object',
                properties: {
                  severity: {
                    const: 'WARNING',
                  },
                },
                required: ['severity'],
              },
              not: {
                contains: {
                  type: 'object',
                  properties: {
                    severity: {
                      const: 'ERROR',
                    },
                  },
                  required: ['severity'],
                },
              },
            },
          },
        },
      },
      {
        if: {
          properties: {
            verdict: {
              const: 'VALID',
            },
          },
          required: ['verdict'],
        },
        then: {
          properties: {
            allowed: {
              const: true,
            },
            requires_confirmation: {
              const: false,
            },
            findings: {
              not: {
                contains: {
                  type: 'object',
                  properties: {
                    severity: {
                      enum: ['WARNING', 'ERROR'],
                    },
                  },
                  required: ['severity'],
                },
              },
            },
          },
        },
      },
      {
        if: {
          properties: {
            verdict: {
              const: 'WARNING',
            },
          },
          required: ['verdict'],
        },
        then: {
          if: {
            properties: {
              mode: {
                const: 'DESIGN_CHECK',
              },
            },
            required: ['mode'],
          },
          then: {
            properties: {
              requires_confirmation: {
                const: false,
              },
            },
          },
          else: {
            properties: {
              requires_confirmation: {
                const: true,
              },
            },
          },
        },
      },
    ],
    $defs: {
      entityId: {
        type: 'string',
        pattern: '^[A-Z]+-[A-Z0-9][A-Z0-9_-]*$',
      },
      subject: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          project_id: {
            $ref: '#/$defs/entityId',
          },
          connection_id: {
            $ref: '#/$defs/entityId',
          },
          component_instance_id: {
            $ref: '#/$defs/entityId',
          },
          bus_id: {
            $ref: '#/$defs/entityId',
          },
        },
      },
      location: {
        type: 'object',
        additionalProperties: false,
        required: ['entity_type', 'entity_id'],
        properties: {
          entity_type: {
            enum: ['PROJECT', 'CONNECTION', 'BUS', 'COMPONENT_INSTANCE'],
          },
          entity_id: {
            $ref: '#/$defs/entityId',
          },
          path: {
            type: 'string',
            pattern: '^/',
          },
        },
      },
      detail: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'value'],
        properties: {
          key: {
            type: 'string',
            pattern: '^[a-z][a-z0-9_]*$',
          },
          value: {
            type: 'string',
            minLength: 1,
          },
        },
      },
      summary: {
        type: 'object',
        additionalProperties: false,
        required: ['checks_evaluated', 'passed', 'infos', 'warnings', 'errors'],
        properties: {
          checks_evaluated: {
            type: 'integer',
            minimum: 0,
          },
          passed: {
            type: 'integer',
            minimum: 0,
          },
          infos: {
            type: 'integer',
            minimum: 0,
          },
          warnings: {
            type: 'integer',
            minimum: 0,
          },
          errors: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      finding: {
        type: 'object',
        additionalProperties: false,
        required: [
          'rule_id',
          'code',
          'severity',
          'message',
          'locations',
          'details',
          'suggested_actions',
          'fingerprint',
        ],
        properties: {
          rule_id: {
            type: 'string',
            pattern: '^[A-Z]+-[0-9]{3}$',
          },
          code: {
            type: 'string',
            pattern: '^[A-Z][A-Z0-9_]*$',
          },
          severity: {
            enum: ['INFO', 'WARNING', 'ERROR'],
          },
          message: {
            type: 'string',
            minLength: 1,
          },
          locations: {
            type: 'array',
            minItems: 1,
            items: {
              $ref: '#/$defs/location',
            },
          },
          details: {
            type: 'array',
            items: {
              $ref: '#/$defs/detail',
            },
          },
          suggested_actions: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
            },
          },
          fingerprint: {
            type: 'string',
            pattern: '^[a-f0-9]{64}$',
          },
          acknowledged: {
            type: 'boolean',
          },
        },
      },
      allocationEffect: {
        type: 'object',
        additionalProperties: false,
        required: [
          'action',
          'component_instance_id',
          'resource_kind',
          'resource_id',
          'connection_id',
        ],
        properties: {
          action: {
            enum: ['ALLOCATE', 'SHARE'],
          },
          component_instance_id: {
            $ref: '#/$defs/entityId',
          },
          resource_kind: {
            enum: ['PIN', 'FUNCTION', 'RESOURCE', 'CHANNEL'],
          },
          resource_id: {
            $ref: '#/$defs/entityId',
          },
          channel: {
            type: 'string',
            minLength: 1,
          },
          connection_id: {
            $ref: '#/$defs/entityId',
          },
        },
        allOf: [
          {
            if: {
              properties: {
                resource_kind: {
                  const: 'CHANNEL',
                },
              },
              required: ['resource_kind'],
            },
            then: {
              required: ['channel'],
            },
            else: {
              not: {
                required: ['channel'],
              },
            },
          },
        ],
      },
    },
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://hardware-system-designer.local/schemas/project-file-v1.schema.json',
    title: 'Hardware System Designer Project File V1',
    description:
      'Canonical server, recovery, and local export representation for a V1 hardware design project.',
    type: 'object',
    additionalProperties: false,
    required: [
      'schema_version',
      'ruleset_version',
      'project_id',
      'document_revision',
      'engineering_revision',
      'metadata',
      'settings',
      'canvas',
      'component_instances',
      'connections',
      'allocations',
      'engineering_notes',
      'warning_overrides',
    ],
    properties: {
      schema_version: {
        const: 'hwsd.project/1',
      },
      ruleset_version: {
        const: 'hwsd.connection-rules/1',
      },
      project_id: {
        $ref: '#/$defs/projectId',
      },
      document_revision: {
        type: 'integer',
        minimum: 1,
      },
      engineering_revision: {
        type: 'integer',
        minimum: 1,
      },
      metadata: {
        $ref: '#/$defs/metadata',
      },
      settings: {
        $ref: '#/$defs/settings',
      },
      canvas: {
        $ref: '#/$defs/canvas',
      },
      component_instances: {
        type: 'array',
        items: {
          $ref: '#/$defs/componentInstance',
        },
      },
      connections: {
        type: 'array',
        items: {
          $ref: '#/$defs/connection',
        },
      },
      allocations: {
        type: 'array',
        items: {
          $ref: '#/$defs/allocation',
        },
      },
      engineering_notes: {
        type: 'array',
        items: {
          $ref: '#/$defs/engineeringNote',
        },
      },
      warning_overrides: {
        type: 'array',
        items: {
          $ref: '#/$defs/warningOverride',
        },
      },
      last_design_check: {
        $ref: '#/$defs/designCheck',
      },
    },
    $defs: {
      nonEmptyString: {
        type: 'string',
        minLength: 1,
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
      },
      entityId: {
        type: 'string',
        pattern: '^[A-Z]+-[A-Z0-9][A-Z0-9_-]*$',
      },
      projectId: {
        type: 'string',
        pattern: '^PROJ-[A-Z0-9][A-Z0-9_-]*$',
      },
      instanceId: {
        type: 'string',
        pattern: '^INST-[A-Z0-9][A-Z0-9_-]*$',
      },
      connectionId: {
        type: 'string',
        pattern: '^CONN-[A-Z0-9][A-Z0-9_-]*$',
      },
      endpointId: {
        type: 'string',
        pattern: '^ENDP-[A-Z0-9][A-Z0-9_-]*$',
      },
      allocationId: {
        type: 'string',
        pattern: '^ALLOC-[A-Z0-9][A-Z0-9_-]*$',
      },
      noteId: {
        type: 'string',
        pattern: '^NOTE-[A-Z0-9][A-Z0-9_-]*$',
      },
      overrideId: {
        type: 'string',
        pattern: '^OVERRIDE-[A-Z0-9][A-Z0-9_-]*$',
      },
      userId: {
        type: 'string',
        pattern: '^USR-[A-Z0-9][A-Z0-9_-]*$',
      },
      localId: {
        type: 'string',
        pattern: '^[A-Z]+-[A-Z0-9][A-Z0-9_-]*$',
      },
      metadata: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'owner_user_id', 'created_at', 'updated_at'],
        properties: {
          name: {
            $ref: '#/$defs/nonEmptyString',
          },
          description: {
            $ref: '#/$defs/nonEmptyString',
          },
          owner_user_id: {
            $ref: '#/$defs/userId',
          },
          created_at: {
            $ref: '#/$defs/timestamp',
          },
          updated_at: {
            $ref: '#/$defs/timestamp',
          },
        },
      },
      autosave: {
        type: 'object',
        additionalProperties: false,
        required: ['enabled', 'interval_ms'],
        properties: {
          enabled: {
            type: 'boolean',
          },
          interval_ms: {
            type: 'integer',
            minimum: 1000,
            maximum: 60000,
            default: 3000,
          },
          last_saved_at: {
            $ref: '#/$defs/timestamp',
          },
        },
      },
      settings: {
        type: 'object',
        additionalProperties: false,
        required: ['autosave'],
        properties: {
          autosave: {
            $ref: '#/$defs/autosave',
          },
        },
      },
      point: {
        type: 'object',
        additionalProperties: false,
        required: ['x', 'y'],
        properties: {
          x: {
            type: 'number',
          },
          y: {
            type: 'number',
          },
        },
      },
      viewport: {
        type: 'object',
        additionalProperties: false,
        required: ['x', 'y', 'zoom'],
        properties: {
          x: {
            type: 'number',
          },
          y: {
            type: 'number',
          },
          zoom: {
            type: 'number',
            exclusiveMinimum: 0,
          },
        },
      },
      grid: {
        type: 'object',
        additionalProperties: false,
        required: ['size', 'snap_to_grid'],
        properties: {
          size: {
            type: 'number',
            exclusiveMinimum: 0,
          },
          snap_to_grid: {
            type: 'boolean',
          },
        },
      },
      canvas: {
        type: 'object',
        additionalProperties: false,
        required: ['viewport', 'grid'],
        properties: {
          viewport: {
            $ref: '#/$defs/viewport',
          },
          grid: {
            $ref: '#/$defs/grid',
          },
        },
      },
      layout: {
        type: 'object',
        additionalProperties: false,
        required: ['x', 'y'],
        properties: {
          x: {
            type: 'number',
          },
          y: {
            type: 'number',
          },
          width: {
            type: 'number',
            exclusiveMinimum: 0,
          },
          height: {
            type: 'number',
            exclusiveMinimum: 0,
          },
          z_index: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      componentInstance: {
        type: 'object',
        additionalProperties: false,
        required: ['instance_id', 'layout', 'component_snapshot'],
        properties: {
          instance_id: {
            $ref: '#/$defs/instanceId',
          },
          display_name: {
            $ref: '#/$defs/nonEmptyString',
          },
          layout: {
            $ref: '#/$defs/layout',
          },
          component_snapshot: {
            $ref: 'component-schema-v1.schema.json',
          },
        },
      },
      frequency: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'unit'],
        properties: {
          value: {
            type: 'number',
            exclusiveMinimum: 0,
          },
          unit: {
            const: 'Hz',
          },
        },
      },
      serialSettings: {
        type: 'object',
        additionalProperties: false,
        required: ['baud_rate', 'data_bits', 'parity', 'stop_bits'],
        properties: {
          baud_rate: {
            type: 'integer',
            minimum: 1,
          },
          data_bits: {
            type: 'integer',
            minimum: 5,
            maximum: 9,
          },
          parity: {
            enum: ['NONE', 'EVEN', 'ODD'],
          },
          stop_bits: {
            enum: [1, 1.5, 2],
          },
        },
      },
      addressSelection: {
        type: 'object',
        additionalProperties: false,
        required: ['address_id', 'value'],
        properties: {
          address_id: {
            $ref: '#/$defs/localId',
          },
          value: {
            type: 'integer',
            minimum: 0,
            maximum: 1023,
          },
        },
      },
      endpoint: {
        type: 'object',
        additionalProperties: false,
        required: [
          'endpoint_id',
          'component_instance_id',
          'port_id',
          'selected_mapping_ids',
          'address_selections',
        ],
        properties: {
          endpoint_id: {
            $ref: '#/$defs/endpointId',
          },
          component_instance_id: {
            $ref: '#/$defs/instanceId',
          },
          port_id: {
            type: 'string',
            pattern: '^PORT-[A-Z0-9][A-Z0-9_-]*$',
          },
          selected_mapping_ids: {
            type: 'array',
            uniqueItems: true,
            items: {
              type: 'string',
              pattern: '^MAP-[A-Z0-9][A-Z0-9_-]*$',
            },
          },
          address_selections: {
            type: 'array',
            items: {
              $ref: '#/$defs/addressSelection',
            },
          },
        },
      },
      connectionVisual: {
        type: 'object',
        additionalProperties: false,
        required: ['routing', 'waypoints'],
        properties: {
          routing: {
            enum: ['AUTO', 'MANUAL'],
          },
          waypoints: {
            type: 'array',
            items: {
              $ref: '#/$defs/point',
            },
          },
        },
        allOf: [
          {
            if: {
              properties: {
                routing: {
                  const: 'MANUAL',
                },
              },
              required: ['routing'],
            },
            then: {
              properties: {
                waypoints: {
                  minItems: 1,
                },
              },
            },
          },
        ],
      },
      connection: {
        type: 'object',
        additionalProperties: false,
        required: ['connection_id', 'topology', 'endpoints', 'visual'],
        properties: {
          connection_id: {
            $ref: '#/$defs/connectionId',
          },
          name: {
            $ref: '#/$defs/nonEmptyString',
          },
          topology: {
            enum: ['POINT_TO_POINT', 'SHARED_BUS', 'MULTI_DROP', 'WIRELESS', 'NOT_APPLICABLE'],
          },
          endpoints: {
            type: 'array',
            minItems: 2,
            items: {
              $ref: '#/$defs/endpoint',
            },
          },
          operating_frequency: {
            $ref: '#/$defs/frequency',
          },
          serial_settings: {
            $ref: '#/$defs/serialSettings',
          },
          visual: {
            $ref: '#/$defs/connectionVisual',
          },
        },
        allOf: [
          {
            if: {
              properties: {
                topology: {
                  enum: ['POINT_TO_POINT', 'NOT_APPLICABLE'],
                },
              },
              required: ['topology'],
            },
            then: {
              properties: {
                endpoints: {
                  minItems: 2,
                  maxItems: 2,
                },
              },
            },
          },
        ],
      },
      allocation: {
        type: 'object',
        additionalProperties: false,
        required: [
          'allocation_id',
          'connection_id',
          'endpoint_id',
          'component_instance_id',
          'resource_kind',
          'resource_id',
          'allocation_mode',
        ],
        properties: {
          allocation_id: {
            $ref: '#/$defs/allocationId',
          },
          connection_id: {
            $ref: '#/$defs/connectionId',
          },
          endpoint_id: {
            $ref: '#/$defs/endpointId',
          },
          component_instance_id: {
            $ref: '#/$defs/instanceId',
          },
          resource_kind: {
            enum: ['PIN', 'FUNCTION', 'RESOURCE', 'CHANNEL'],
          },
          resource_id: {
            $ref: '#/$defs/localId',
          },
          channel: {
            $ref: '#/$defs/nonEmptyString',
          },
          allocation_mode: {
            enum: ['EXCLUSIVE', 'SHARED'],
          },
        },
        allOf: [
          {
            if: {
              properties: {
                resource_kind: {
                  const: 'CHANNEL',
                },
              },
              required: ['resource_kind'],
            },
            then: {
              required: ['channel'],
            },
            else: {
              not: {
                required: ['channel'],
              },
            },
          },
        ],
      },
      engineeringNote: {
        type: 'object',
        additionalProperties: false,
        required: ['note_id', 'scope', 'text', 'created_by', 'created_at', 'updated_at'],
        properties: {
          note_id: {
            $ref: '#/$defs/noteId',
          },
          scope: {
            enum: ['PROJECT', 'COMPONENT_INSTANCE', 'CONNECTION', 'ALLOCATION'],
          },
          target_id: {
            $ref: '#/$defs/entityId',
          },
          text: {
            $ref: '#/$defs/nonEmptyString',
          },
          created_by: {
            $ref: '#/$defs/userId',
          },
          created_at: {
            $ref: '#/$defs/timestamp',
          },
          updated_at: {
            $ref: '#/$defs/timestamp',
          },
        },
        allOf: [
          {
            if: {
              properties: {
                scope: {
                  const: 'PROJECT',
                },
              },
              required: ['scope'],
            },
            then: {
              not: {
                required: ['target_id'],
              },
            },
            else: {
              required: ['target_id'],
            },
          },
        ],
      },
      evaluationSubject: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          project_id: {
            $ref: '#/$defs/projectId',
          },
          connection_id: {
            $ref: '#/$defs/connectionId',
          },
          component_instance_id: {
            $ref: '#/$defs/instanceId',
          },
          bus_id: {
            $ref: '#/$defs/entityId',
          },
        },
      },
      warningOverride: {
        type: 'object',
        additionalProperties: false,
        required: [
          'override_id',
          'ruleset_version',
          'rule_id',
          'code',
          'message',
          'fingerprint',
          'subject',
          'confirmed_by',
          'confirmed_at',
        ],
        properties: {
          override_id: {
            $ref: '#/$defs/overrideId',
          },
          ruleset_version: {
            const: 'hwsd.connection-rules/1',
          },
          rule_id: {
            type: 'string',
            pattern: '^[A-Z]+-[0-9]{3}$',
          },
          code: {
            type: 'string',
            pattern: '^[A-Z][A-Z0-9_]*$',
          },
          message: {
            $ref: '#/$defs/nonEmptyString',
          },
          fingerprint: {
            type: 'string',
            pattern: '^[a-f0-9]{64}$',
          },
          subject: {
            $ref: '#/$defs/evaluationSubject',
          },
          confirmed_by: {
            $ref: '#/$defs/userId',
          },
          confirmed_at: {
            $ref: '#/$defs/timestamp',
          },
          engineering_note: {
            $ref: '#/$defs/nonEmptyString',
          },
        },
      },
      designCheck: {
        type: 'object',
        additionalProperties: false,
        required: ['evaluated_engineering_revision', 'evaluated_at', 'result'],
        properties: {
          evaluated_engineering_revision: {
            type: 'integer',
            minimum: 1,
          },
          evaluated_at: {
            $ref: '#/$defs/timestamp',
          },
          result: {
            allOf: [
              {
                $ref: 'connection-rule-result-v1.schema.json',
              },
              {
                type: 'object',
                properties: {
                  mode: {
                    const: 'DESIGN_CHECK',
                  },
                },
                required: ['mode'],
              },
            ],
          },
        },
      },
    },
  },
] as const;
