// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, DependentExtensions, FileNames, OperationType, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {IoTWorkbenchSettings} from '../IoTSettings';
import {TelemetryContext} from '../telemetry';
import * as utils from '../utils';

import {Board} from './Interfaces/Board';
import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {OTA} from './OTA';

const constants = {
  defaultSketchFileName: 'device.ino',
  arduinoJsonFileName: 'arduino.json',
  cppPropertiesFileName: 'c_cpp_properties.json',
  cppPropertiesFileNameMac: 'c_cpp_properties_macos.json',
  cppPropertiesFileNameWin: 'c_cpp_properties_win32.json',
  outputPath: './.build',
  compileTaskName: 'Arduino Compile',
  uploadTaskName: 'Arduino Upload',
  environmentTemplateFolderName: 'Arduino Task'
};


export abstract class ArduinoDeviceBase implements Device {
  protected deviceType: DeviceType;
  protected componentType: ComponentType;
  protected deviceFolder: string;
  protected vscodeFolderPath: string;
  protected boardFolderPath: string;
  protected channel: vscode.OutputChannel;
  protected extensionContext: vscode.ExtensionContext;
  protected telemetryContext: TelemetryContext;

  abstract name: string;
  abstract id: string;

  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      channel: vscode.OutputChannel, telemetryContext: TelemetryContext,
      deviceType: DeviceType) {
    this.deviceType = deviceType;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    this.vscodeFolderPath =
        path.join(this.deviceFolder, FileNames.vscodeSettingsFolderName);
    this.boardFolderPath = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName));
    this.telemetryContext = telemetryContext;
    this.channel = channel;
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  static async isAvailable(): Promise<boolean> {
    if (!vscode.extensions.getExtension(DependentExtensions.arduino)) {
      const choice = await vscode.window.showInformationMessage(
          'Arduino extension is required for the current project. Do you want to install it from marketplace?',
          'Yes', 'No');
      if (choice === 'Yes') {
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(
                'vscode:extension/' + DependentExtensions.arduino));
      }
      return false;
    }

    return true;
  }

  async checkPrerequisites(): Promise<boolean> {
    const isArduinoExtensionAvailable = await ArduinoDeviceBase.isAvailable();
    if (!isArduinoExtensionAvailable) {
      return false;
    }

    return true;
  }

  async compile(): Promise<boolean> {
    const result = await this.preCompileAction();
    if (!result) {
      return false;
    }

    return await utils.fetchAndExecuteTask(
        this.extensionContext, this.channel, this.telemetryContext,
        this.deviceFolder, OperationType.Compile, constants.compileTaskName);
  }

  async upload(): Promise<boolean> {
    const result = await this.preUploadAction();
    if (!result) {
      return false;
    }
    return await utils.fetchAndExecuteTask(
        this.extensionContext, this.channel, this.telemetryContext,
        this.deviceFolder, OperationType.Upload, constants.uploadTaskName);
  }


  abstract async configDeviceSettings(): Promise<boolean>;

  abstract async load(): Promise<boolean>;


  abstract async create(): Promise<boolean>;

  async createCore(board: Board|undefined, templateFiles: TemplateFileInfo[]):
      Promise<boolean> {
    // Generate template files
    const createTimeScaffoldType = ScaffoldType.Local;
    if (!await FileUtility.directoryExists(
            createTimeScaffoldType, this.deviceFolder)) {
      throw new Error(`Internal error: Couldn't find the template folder.`);
    }
    if (!board) {
      throw new Error(`Invalid / unsupported target platform`);
    }

    for (const fileInfo of templateFiles) {
      await utils.generateTemplateFile(
          this.deviceFolder, createTimeScaffoldType, fileInfo);
    }

    await this.generateCppPropertiesFile(createTimeScaffoldType, board);

    // Configurate device environment
    const res = await this.configDeviceEnvironment(
        this.deviceFolder, createTimeScaffoldType);

    return res;
  }

  // Backward compatibility: Check configuration
  abstract async preCompileAction(): Promise<boolean>;

  abstract async preUploadAction(): Promise<boolean>;

  abstract get version(): string;

  async generateCppPropertiesFile(type: ScaffoldType, board: Board):
      Promise<void> {
    if (!await FileUtility.directoryExists(type, this.vscodeFolderPath)) {
      await FileUtility.mkdirRecursively(type, this.vscodeFolderPath);
    }

    // Create c_cpp_properties.json file
    const cppPropertiesFilePath =
        path.join(this.vscodeFolderPath, constants.cppPropertiesFileName);

    if (await FileUtility.directoryExists(type, cppPropertiesFilePath)) {
      return;
    }

    try {
      const plat = await IoTWorkbenchSettings.getPlatform();

      if (plat === 'win32') {
        const propertiesFilePathWin32 =
            this.extensionContext.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, FileNames.templatesFolderName,
                board.id, constants.cppPropertiesFileNameWin));
        const propertiesContentWin32 =
            fs.readFileSync(propertiesFilePathWin32).toString();
        const rootPathPattern = /{ROOTPATH}/g;
        const versionPattern = /{VERSION}/g;
        const homeDir = await IoTWorkbenchSettings.getOs();
        const localAppData: string = path.join(homeDir, 'AppData', 'Local');
        const replaceStr =
            propertiesContentWin32
                .replace(rootPathPattern, localAppData.replace(/\\/g, '\\\\'))
                .replace(versionPattern, this.version);
        await FileUtility.writeFile(type, cppPropertiesFilePath, replaceStr);
      }
      // TODO: Let's use the same file for Linux and MacOS for now. Need to
      // revisit this part.
      else {
        const propertiesFilePathMac =
            this.extensionContext.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, FileNames.templatesFolderName,
                board.id, constants.cppPropertiesFileNameMac));
        const propertiesContentMac =
            await FileUtility.readFile(type, propertiesFilePathMac).toString();
        await FileUtility.writeFile(
            type, cppPropertiesFilePath, propertiesContentMac);
      }
    } catch (error) {
      throw new Error(`Create cpp properties file failed: ${error.message}`);
    }
  }

  async generateCrc(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    if (!(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0)) {
      const message = 'No workspace opened.';
      vscode.window.showWarningMessage(message);
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }

    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      const message = 'No device path found in workspace configuration.';
      vscode.window.showWarningMessage(message);
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }
    const deviceBuildLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..', devicePath,
        '.build');

    if (!deviceBuildLocation) {
      const message = 'No device compile output folder found.';
      vscode.window.showWarningMessage(message);
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }

    const binFiles = fs.listSync(deviceBuildLocation, ['bin']);
    if (!binFiles || !binFiles.length) {
      const message =
          'No bin file found. Please run the command of Device Compile first.';
      vscode.window.showWarningMessage(message);
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }

    let binFilePath = '';

    if (binFiles.length === 1) {
      binFilePath = binFiles[0];
    } else {
      const binFilePickItems: vscode.QuickPickItem[] = [];
      for (const file of binFiles) {
        const fileName = path.basename(file);
        binFilePickItems.push({label: fileName, description: file});
      }

      const choice = await vscode.window.showQuickPick(binFilePickItems, {
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Select bin file',
      });

      if (!choice || !choice.description) {
        return false;
      }

      binFilePath = choice.description;
    }

    if (!binFilePath || !fs.existsSync(binFilePath)) {
      return false;
    }

    const res = OTA.generateCrc(binFilePath);

    vscode.window.showInformationMessage('Generate CRC succeeded.');

    channel.show();
    channel.appendLine('========== CRC Information ==========');
    channel.appendLine('');
    channel.appendLine('fwPath: ' + binFilePath);
    channel.appendLine('fwPackageCheckValue: ' + res.crc);
    channel.appendLine('fwSize: ' + res.size);
    channel.appendLine('');
    channel.appendLine('======================================');

    return true;
  }

  async configDeviceEnvironment(deviceDir: string, scaffoldType: ScaffoldType):
      Promise<boolean> {
    if (!deviceDir) {
      throw new Error(
          'Unable to find the project device path, please open the folder and initialize project again.');
    }

    const templateFilesInfo = await utils.getEnvTemplateFilesAndAskOverwrite(
        this.extensionContext, this.telemetryContext, this.deviceFolder,
        scaffoldType, constants.environmentTemplateFolderName);
    if (!templateFilesInfo) {
      return false;
    }

    // Configure project environment with template files
    for (const fileInfo of templateFilesInfo) {
      await utils.generateTemplateFile(deviceDir, scaffoldType, fileInfo);
    }

    const message = 'Arduino device configuration done.';
    utils.channelShowAndAppendLine(this.channel, message);

    return true;
  }
}