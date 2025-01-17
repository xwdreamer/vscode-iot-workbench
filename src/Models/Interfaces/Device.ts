// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {ScaffoldType} from '../../constants';

import {Compilable} from './Compilable';
import {Component} from './Component';
import {Uploadable} from './Uploadable';

export enum DeviceType {
  MXChip_AZ3166 = 1,
  IoT_Button = 2,
  Esp32 = 3,
  Raspberry_Pi = 4
}

export interface Device extends Component, Compilable, Uploadable {
  getDeviceType(): DeviceType;
  configDeviceSettings(): Promise<boolean>;
  configDeviceEnvironment(projectPath: string, scaffoldType: ScaffoldType):
      Promise<boolean>;
}
