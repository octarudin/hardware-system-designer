/* eslint-disable */
/**
 * Generated from docs/schemas by scripts/generate-contracts.mjs.
 * Do not edit by hand.
 */

export type Port = {
  port_id: PortId;
  name: NonEmptyString;
  requirement: Requirement;
  direction: PortDirection;
  interface: Interface;
  bindings: Binding[];
  power?: Power;
  description?: NonEmptyString;
};
export type PortId = string;
export type NonEmptyString = string;
export type Requirement = 'REQUIRED' | 'OPTIONAL';
export type PortDirection = 'INPUT' | 'OUTPUT' | 'BIDIRECTIONAL' | 'PASSIVE';
export type Interface = {
  type: InterfaceType;
  custom_type?: string;
  interface_id?: InterfaceId;
  interface_revision?: number;
  bus_mode: BusMode;
  bus_role?: BusRole;
  logic_voltage?: VoltageRange;
  signal_voltage?: VoltageRange;
  signal_current?: CurrentRange;
  max_frequency?: Frequency;
  protocol?: string;
};
export type InterfaceType =
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
export type InterfaceId = string;
export type BusMode =
  'POINT_TO_POINT' | 'SHARED_BUS' | 'MULTI_DROP' | 'WIRELESS' | 'NOT_APPLICABLE';
export type BusRole = 'CONTROLLER' | 'TARGET' | 'PEER';
export type Binding = Binding1 & {
  pin_id?: LocalId;
  function_id?: LocalId;
  resource_id?: LocalId;
  channel?: NonEmptyString;
  signal?: NonEmptyString;
};
export type Binding1 = {
  [k: string]: any;
};
export type LocalId = string;

/**
 * Canonical standalone and reusable port/interface definition for Hardware System Designer V1.
 */
export interface HardwareSystemDesignerPortInterfaceSchemaV1 {
  schema_version: 'hwsd.port-interface/1';
  port: Port;
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
export interface CurrentRange {
  min?: Current;
  nominal?: Current;
  max?: Current;
}
export interface Current {
  value: number;
  unit: 'A';
}
export interface Frequency {
  value: number;
  unit: 'Hz';
}
export interface Power {
  role: 'SOURCE' | 'LOAD';
  voltage?: VoltageRange;
  typical_current?: Current;
  max_current?: Current;
  peak_current?: Current;
  regulation?: 'REGULATED' | 'UNREGULATED' | 'BATTERY' | 'UNKNOWN';
  polarity?: 'POSITIVE' | 'NEGATIVE' | 'AC' | 'NOT_APPLICABLE';
}
