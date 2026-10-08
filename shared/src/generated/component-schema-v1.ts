/* eslint-disable */
/**
 * Generated from docs/schemas by scripts/generate-contracts.mjs.
 * Do not edit by hand.
 */

export type ComponentId = string;
export type NonEmptyString = string;
export type Lifecycle = {
  status:
    | 'AI_GENERATED'
    | 'REVIEW_REQUIRED'
    | 'USER_REVIEWED'
    | 'PENDING_ADMIN_VERIFICATION'
    | 'VERIFIED'
    | 'DEPRECATED'
    | 'DISABLED';
  status_reason?: NonEmptyString;
  verified_by?: NonEmptyString;
  verified_at?: Timestamp;
  superseded_by_revision?: number;
};
export type Timestamp = string;
export type Provenance = {
  origin: 'AI_DATASHEET_EXTRACTION' | 'MANUAL' | 'IMPORTED' | 'MIGRATED';
  extracted_at?: Timestamp;
  extraction_model?: NonEmptyString;
  datasheets: Datasheet[];
  field_evidence: FieldEvidence[];
};
export type LocalId = string;
export type PinDirection =
  'INPUT' | 'OUTPUT' | 'BIDIRECTIONAL' | 'POWER_INPUT' | 'POWER_OUTPUT' | 'PASSIVE';
export type Requirement = 'REQUIRED' | 'OPTIONAL';
export type NonNegativeNumber = number;
export type Port = {
  port_id: string;
  name: string;
  requirement: 'REQUIRED' | 'OPTIONAL';
  direction: 'INPUT' | 'OUTPUT' | 'BIDIRECTIONAL' | 'PASSIVE';
  interface: Interface;
  bindings: Binding[];
  power?: Power;
  description?: string;
};
export type Interface = {
  type:
    | 'GPIO_INPUT'
    | 'GPIO_OUTPUT'
    | 'GPIO_BIDIRECTIONAL'
    | 'PWM'
    | 'INTERRUPT'
    | 'DIGITAL_CUSTOM'
    | 'UART_TTL'
    | 'RS232'
    | 'RS485'
    | 'CAN'
    | 'LIN'
    | 'I2C'
    | 'SPI'
    | 'ONE_WIRE'
    | 'ANALOG_INPUT'
    | 'ANALOG_OUTPUT'
    | 'ADC_INPUT'
    | 'DAC_OUTPUT'
    | 'ANALOG_0_10V'
    | 'ANALOG_4_20MA'
    | 'ETHERNET'
    | 'WIFI'
    | 'BLE'
    | 'GSM'
    | 'LTE'
    | 'LORA'
    | 'RF_CUSTOM'
    | 'DRY_CONTACT'
    | 'RELAY_CONTACT'
    | 'ENABLE'
    | 'RESET'
    | 'POWER_INPUT'
    | 'POWER_OUTPUT'
    | 'BATTERY_INPUT'
    | 'BATTERY_OUTPUT'
    | 'CHARGER_INPUT'
    | 'CHARGER_OUTPUT'
    | 'CUSTOM';
  custom_type?: string;
  interface_id?: string;
  interface_revision?: number;
  bus_mode: 'POINT_TO_POINT' | 'SHARED_BUS' | 'MULTI_DROP' | 'WIRELESS' | 'NOT_APPLICABLE';
  bus_role?: 'CONTROLLER' | 'TARGET' | 'PEER';
  logic_voltage?: VoltageRange1;
  signal_voltage?: VoltageRange1;
  signal_current?: CurrentRange;
  max_frequency?: Frequency;
  protocol?: string;
};
export type Binding = {
  [k: string]: any;
} & {
  pin_id?: string;
  function_id?: string;
  resource_id?: string;
  channel?: string;
  signal?: string;
};
export type Resource = {
  resource_id: LocalId;
  type: ResourceType;
  custom_type?: NonEmptyString;
  name: NonEmptyString;
  share_mode: 'EXCLUSIVE' | 'SHARED_BUS' | 'CHANNELIZED';
  channels: ResourceChannel[];
  compatible_pin_mappings: PinMapping[];
};
export type ResourceType =
  | 'GPIO'
  | 'UART'
  | 'SPI'
  | 'I2C'
  | 'ADC'
  | 'DAC'
  | 'PWM'
  | 'CAN'
  | 'LIN'
  | 'ONE_WIRE'
  | 'ETHERNET'
  | 'CUSTOM';
export type AddressCapability = {
  address_id: LocalId;
  port_id: LocalId;
  kind: 'I2C_7_BIT' | 'I2C_10_BIT' | 'MODBUS_RTU_SLAVE';
  mode: 'FIXED' | 'SELECTABLE' | 'USER_CONFIGURABLE';
  allowed_values?: number[];
  range?: {
    min: number;
    max: number;
  };
};

/**
 * Canonical published component definition for Hardware System Designer V1.
 */
export interface HardwareSystemDesignerComponentSchemaV1 {
  schema_version: 'hwsd.component/1';
  component_id: ComponentId;
  revision: number;
  identity: Identity;
  classification: Classification;
  lifecycle: Lifecycle;
  provenance: Provenance;
  pins: Pin[];
  ports: Port[];
  resources: Resource[];
  address_capabilities: AddressCapability[];
  notes: Note[];
  created_at: Timestamp;
  updated_at: Timestamp;
  revision_notes: NonEmptyString;
}
export interface Identity {
  name: NonEmptyString;
  manufacturer?: NonEmptyString;
  part_number?: NonEmptyString;
  family?: NonEmptyString;
  variant?: NonEmptyString;
}
export interface Classification {
  category:
    | 'MICROCONTROLLER'
    | 'SENSOR'
    | 'ACTUATOR'
    | 'RELAY'
    | 'DISPLAY'
    | 'ETHERNET_CONTROLLER'
    | 'GSM_LTE_MODULE'
    | 'RF_MODULE'
    | 'BATTERY'
    | 'CHARGER'
    | 'CONNECTOR'
    | 'EXTERNAL_SERVER_CLOUD'
    | 'COMPUTER_SBC'
    | 'POWER_SUPPLY'
    | 'VOLTAGE_REGULATOR'
    | 'INTERFACE_CONVERTER_TRANSCEIVER'
    | 'COMMUNICATION_MODULE'
    | 'GENERIC_IC'
    | 'GENERIC_MODULE'
    | 'GENERIC_BOARD'
    | 'CUSTOM_COMPONENT';
  abstraction: 'RAW_IC' | 'MODULE' | 'FINISHED_SENSOR' | 'BOARD' | 'SYSTEM' | 'CUSTOM';
}
export interface Datasheet {
  datasheet_id: LocalId;
  filename: NonEmptyString;
  media_type: 'application/pdf';
  byte_size: number;
  storage_ref: NonEmptyString;
  sha256?: string;
  page_count?: number;
  uploaded_at: Timestamp;
}
export interface FieldEvidence {
  field: string;
  confidence?: number;
  datasheet_id?: LocalId;
  /**
   * @minItems 1
   */
  pages?: [number, ...number[]];
  source_excerpt?: NonEmptyString;
  reviewer_note?: NonEmptyString;
}
export interface Pin {
  pin_id: LocalId;
  number: NonEmptyString;
  name: NonEmptyString;
  gpio_number?: NonEmptyString;
  direction: PinDirection;
  electrical_type:
    | 'DIGITAL'
    | 'ANALOG'
    | 'POWER'
    | 'GROUND'
    | 'OPEN_DRAIN'
    | 'OPEN_COLLECTOR'
    | 'DIFFERENTIAL'
    | 'PASSIVE'
    | 'CUSTOM';
  requirement: Requirement;
  logic_voltage?: VoltageRange;
  absolute_voltage?: VoltageRange;
  max_source_current?: Current;
  max_sink_current?: Current;
  alternate_functions: AlternateFunction[];
}
export interface VoltageRange {
  min?: Voltage;
  nominal?: Voltage;
  max?: Voltage;
}
export interface Voltage {
  value: number;
  unit: 'V';
}
export interface Current {
  value: NonNegativeNumber;
  unit: 'A';
}
export interface AlternateFunction {
  function_id: LocalId;
  interface_type:
    | 'GPIO_INPUT'
    | 'GPIO_OUTPUT'
    | 'GPIO_BIDIRECTIONAL'
    | 'PWM'
    | 'INTERRUPT'
    | 'DIGITAL_CUSTOM'
    | 'UART_TTL'
    | 'RS232'
    | 'RS485'
    | 'CAN'
    | 'LIN'
    | 'I2C'
    | 'SPI'
    | 'ONE_WIRE'
    | 'ANALOG_INPUT'
    | 'ANALOG_OUTPUT'
    | 'ADC_INPUT'
    | 'DAC_OUTPUT'
    | 'ANALOG_0_10V'
    | 'ANALOG_4_20MA'
    | 'ETHERNET'
    | 'WIFI'
    | 'BLE'
    | 'GSM'
    | 'LTE'
    | 'LORA'
    | 'RF_CUSTOM'
    | 'DRY_CONTACT'
    | 'RELAY_CONTACT'
    | 'ENABLE'
    | 'RESET'
    | 'POWER_INPUT'
    | 'POWER_OUTPUT'
    | 'BATTERY_INPUT'
    | 'BATTERY_OUTPUT'
    | 'CHARGER_INPUT'
    | 'CHARGER_OUTPUT'
    | 'CUSTOM';
  signal: NonEmptyString;
  resource_id?: LocalId;
  channel?: NonEmptyString;
  mux_group?: NonEmptyString;
}
export interface VoltageRange1 {
  min?: Voltage1;
  nominal?: Voltage1;
  max?: Voltage1;
}
export interface Voltage1 {
  value: number;
  unit: 'V';
}
export interface CurrentRange {
  min?: Current1;
  nominal?: Current1;
  max?: Current1;
}
export interface Current1 {
  value: number;
  unit: 'A';
}
export interface Frequency {
  value: number;
  unit: 'Hz';
}
export interface Power {
  role: 'SOURCE' | 'LOAD';
  voltage?: VoltageRange1;
  typical_current?: Current1;
  max_current?: Current1;
  peak_current?: Current1;
  regulation?: 'REGULATED' | 'UNREGULATED' | 'BATTERY' | 'UNKNOWN';
  polarity?: 'POSITIVE' | 'NEGATIVE' | 'AC' | 'NOT_APPLICABLE';
}
export interface ResourceChannel {
  channel: NonEmptyString;
  signal: NonEmptyString;
  optional?: boolean;
}
export interface PinMapping {
  mapping_id: LocalId;
  /**
   * @minItems 1
   */
  assignments: [PinAssignment, ...PinAssignment[]];
}
export interface PinAssignment {
  signal: NonEmptyString;
  pin_id: LocalId;
  function_id: LocalId;
}
export interface Note {
  note_id: LocalId;
  text: NonEmptyString;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  applies_to?: string;
}
