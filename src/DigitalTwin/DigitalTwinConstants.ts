// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export class DigitalTwinFileNames {
  static readonly graphFileName = 'graph.json';
  static readonly interfaceFileName = 'Interface.json';
  static readonly capabilityModelFileName = 'CapabilityModel.json';
  static readonly settingsJsonFileName = 'settings.json';
  static readonly vscodeSettingsFolderName = '.vscode';
  static readonly sampleInterfaceName = 'sample.interface.json';
  static readonly sampleCapabilityModelName = 'sample.capabilitymodel.json';
  static readonly schemaFolderName = 'schemas';
  static readonly defaultInterfaceName = 'myInterface';
  static readonly defaultCapabilityModelName = 'myCapabilityModel';
  static readonly etagCacheFileName = 'etagCache.json';
  static readonly digitalTwinTemplateFolderName = 'digitaltwin';
  static readonly projectTypeListFileName = 'projecttypelist.json';
  static readonly deviceConnectionListFileName = 'deviceconnectionlist.json';
  static readonly utilitiesFolderName = 'utilities';
}

export class DigitalTwinConstants {
  static readonly repoConnectionStringTemplate =
      'HostName=<Host Name>;RepositoryId=<repository id>;SharedAccessKeyName=<Shared AccessKey Name>;SharedAccessKey=<access Key>';
  static readonly interfaceSuffix = '.interface.json';
  static readonly capabilityModelSuffix = '.capabilitymodel.json';
  static readonly dtPrefix = '[IoT Plug and Play]';
  static readonly apiVersion = '2019-07-01-Preview';
  static readonly productName = 'IoT Plug and Play';
}

export class CodeGenConstants {
  static readonly codeGeneratorToolPath = 'iotpnp-codegen';
}