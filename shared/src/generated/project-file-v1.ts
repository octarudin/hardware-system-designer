/* eslint-disable */
/**
 * Generated from docs/schemas by scripts/generate-contracts.mjs.
 * Do not edit by hand.
 */

export type ProjectId = string;
export type NonEmptyString = string;
export type UserId = string;
export type Timestamp = string;
export type InstanceId = string;
export type Lifecycle = {
  status:
    | 'AI_GENERATED'
    | 'REVIEW_REQUIRED'
    | 'USER_REVIEWED'
    | 'PENDING_ADMIN_VERIFICATION'
    | 'VERIFIED'
    | 'DEPRECATED'
    | 'DISABLED';
  status_reason?: string;
  verified_by?: string;
  verified_at?: string;
  superseded_by_revision?: number;
};
export type Provenance = {
  origin: 'AI_DATASHEET_EXTRACTION' | 'MANUAL' | 'IMPORTED' | 'MIGRATED';
  extracted_at?: string;
  extraction_model?: string;
  datasheets: Datasheet[];
  field_evidence: FieldEvidence[];
};
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
  resource_id: string;
  type:
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
  custom_type?: string;
  name: string;
  share_mode: 'EXCLUSIVE' | 'SHARED_BUS' | 'CHANNELIZED';
  channels: ResourceChannel[];
  compatible_pin_mappings: PinMapping[];
};
export type AddressCapability = {
  address_id: string;
  port_id: string;
  kind: 'I2C_7_BIT' | 'I2C_10_BIT' | 'MODBUS_RTU_SLAVE';
  mode: 'FIXED' | 'SELECTABLE' | 'USER_CONFIGURABLE';
  allowed_values?: number[];
  range?: {
    min: number;
    max: number;
  };
};
export type Connection = {
  connection_id: ConnectionId;
  name?: NonEmptyString;
  topology: 'POINT_TO_POINT' | 'SHARED_BUS' | 'MULTI_DROP' | 'WIRELESS' | 'NOT_APPLICABLE';
  /**
   * @minItems 2
   */
  endpoints: [Endpoint, Endpoint, ...Endpoint[]];
  operating_frequency?: Frequency1;
  serial_settings?: SerialSettings;
  visual: ConnectionVisual;
};
export type ConnectionId = string;
export type EndpointId = string;
export type LocalId = string;
export type ConnectionVisual = {
  routing: 'AUTO' | 'MANUAL';
  waypoints: Point[];
};
export type Allocation = {
  allocation_id: AllocationId;
  connection_id: ConnectionId;
  endpoint_id: EndpointId;
  component_instance_id: InstanceId;
  resource_kind: 'PIN' | 'FUNCTION' | 'RESOURCE' | 'CHANNEL';
  resource_id: LocalId;
  channel?: NonEmptyString;
  allocation_mode: 'EXCLUSIVE' | 'SHARED';
};
export type AllocationId = string;
export type EngineeringNote = {
  note_id: NoteId;
  scope: 'PROJECT' | 'COMPONENT_INSTANCE' | 'CONNECTION' | 'ALLOCATION';
  target_id?: EntityId;
  text: NonEmptyString;
  created_by: UserId;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type NoteId = string;
export type EntityId = string;
export type OverrideId = string;
/**
 * Deterministic evaluation result produced by Connection & Rule Engine V1.
 */
export type HardwareSystemDesignerConnectionRuleResultV1 = {
  ruleset_version: 'hwsd.connection-rules/1';
  mode: 'CONNECTION_PREVIEW' | 'CONNECTION_COMMIT' | 'DESIGN_CHECK';
  subject: Subject;
  verdict: 'VALID' | 'WARNING' | 'ERROR';
  allowed: boolean;
  requires_confirmation: boolean;
  findings: Finding[];
  allocation_effects: AllocationEffect[];
  summary?: Summary;
};
export type AllocationEffect = {
  action: 'ALLOCATE' | 'SHARE';
  component_instance_id: string;
  resource_kind: 'PIN' | 'FUNCTION' | 'RESOURCE' | 'CHANNEL';
  resource_id: string;
  channel?: string;
  connection_id: string;
};

/**
 * Canonical server, recovery, and local export representation for a V1 hardware design project.
 */
export interface HardwareSystemDesignerProjectFileV1 {
  schema_version: 'hwsd.project/1';
  ruleset_version: 'hwsd.connection-rules/1';
  project_id: ProjectId;
  document_revision: number;
  engineering_revision: number;
  metadata: Metadata;
  settings: Settings;
  canvas: Canvas;
  component_instances: ComponentInstance[];
  connections: Connection[];
  allocations: Allocation[];
  engineering_notes: EngineeringNote[];
  warning_overrides: WarningOverride[];
  last_design_check?: DesignCheck;
}
export interface Metadata {
  name: NonEmptyString;
  description?: NonEmptyString;
  owner_user_id: UserId;
  created_at: Timestamp;
  updated_at: Timestamp;
}
export interface Settings {
  autosave: Autosave;
}
export interface Autosave {
  enabled: boolean;
  interval_ms: number;
  last_saved_at?: Timestamp;
}
export interface Canvas {
  viewport: Viewport;
  grid: Grid;
}
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}
export interface Grid {
  size: number;
  snap_to_grid: boolean;
}
export interface ComponentInstance {
  instance_id: InstanceId;
  display_name?: NonEmptyString;
  layout: Layout;
  component_snapshot: HardwareSystemDesignerComponentSchemaV1;
}
export interface Layout {
  x: number;
  y: number;
  width?: number;
  height?: number;
  z_index?: number;
}
/**
 * Canonical published component definition for Hardware System Designer V1.
 */
export interface HardwareSystemDesignerComponentSchemaV1 {
  schema_version: 'hwsd.component/1';
  component_id: string;
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
  created_at: string;
  updated_at: string;
  revision_notes: string;
}
export interface Identity {
  name: string;
  manufacturer?: string;
  part_number?: string;
  family?: string;
  variant?: string;
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
  datasheet_id: string;
  filename: string;
  media_type: 'application/pdf';
  byte_size: number;
  storage_ref: string;
  sha256?: string;
  page_count?: number;
  uploaded_at: string;
}
export interface FieldEvidence {
  field: string;
  confidence?: number;
  datasheet_id?: string;
  /**
   * @minItems 1
   */
  pages?: [number, ...number[]];
  source_excerpt?: string;
  reviewer_note?: string;
}
export interface Pin {
  pin_id: string;
  number: string;
  name: string;
  gpio_number?: string;
  direction: 'INPUT' | 'OUTPUT' | 'BIDIRECTIONAL' | 'POWER_INPUT' | 'POWER_OUTPUT' | 'PASSIVE';
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
  requirement: 'REQUIRED' | 'OPTIONAL';
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
  value: number;
  unit: 'A';
}
export interface AlternateFunction {
  function_id: string;
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
  signal: string;
  resource_id?: string;
  channel?: string;
  mux_group?: string;
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
  channel: string;
  signal: string;
  optional?: boolean;
}
export interface PinMapping {
  mapping_id: string;
  /**
   * @minItems 1
   */
  assignments: [PinAssignment, ...PinAssignment[]];
}
export interface PinAssignment {
  signal: string;
  pin_id: string;
  function_id: string;
}
export interface Note {
  note_id: string;
  text: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  applies_to?: string;
}
export interface Endpoint {
  endpoint_id: EndpointId;
  component_instance_id: InstanceId;
  port_id: string;
  selected_mapping_ids: string[];
  address_selections: AddressSelection[];
}
export interface AddressSelection {
  address_id: LocalId;
  value: number;
}
export interface Frequency1 {
  value: number;
  unit: 'Hz';
}
export interface SerialSettings {
  baud_rate: number;
  data_bits: number;
  parity: 'NONE' | 'EVEN' | 'ODD';
  stop_bits: 1 | 1.5 | 2;
}
export interface Point {
  x: number;
  y: number;
}
export interface WarningOverride {
  override_id: OverrideId;
  ruleset_version: 'hwsd.connection-rules/1';
  rule_id: string;
  code: string;
  message: NonEmptyString;
  fingerprint: string;
  subject: EvaluationSubject;
  confirmed_by: UserId;
  confirmed_at: Timestamp;
  engineering_note?: NonEmptyString;
}
export interface EvaluationSubject {
  project_id?: ProjectId;
  connection_id?: ConnectionId;
  component_instance_id?: InstanceId;
  bus_id?: EntityId;
}
export interface DesignCheck {
  evaluated_engineering_revision: number;
  evaluated_at: Timestamp;
  result: HardwareSystemDesignerConnectionRuleResultV1 & {
    mode: 'DESIGN_CHECK';
    [k: string]: any;
  };
}
export interface Subject {
  project_id?: string;
  connection_id?: string;
  component_instance_id?: string;
  bus_id?: string;
}
export interface Finding {
  rule_id: string;
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  /**
   * @minItems 1
   */
  locations: [Location, ...Location[]];
  details: Detail[];
  suggested_actions: string[];
  fingerprint: string;
  acknowledged?: boolean;
}
export interface Location {
  entity_type: 'PROJECT' | 'CONNECTION' | 'BUS' | 'COMPONENT_INSTANCE';
  entity_id: string;
  path?: string;
}
export interface Detail {
  key: string;
  value: string;
}
export interface Summary {
  checks_evaluated: number;
  passed: number;
  infos: number;
  warnings: number;
  errors: number;
}
