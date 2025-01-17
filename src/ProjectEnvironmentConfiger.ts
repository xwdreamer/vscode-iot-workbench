// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as utils from './utils';

import {TelemetryContext} from './telemetry';
import {ScaffoldType, PlatformType} from './constants';
import {RemoteExtension} from './Models/RemoteExtension';
import {IoTWorkbenchProjectBase} from './Models/IoTWorkbenchProjectBase';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

export class ProjectEnvironmentConfiger {
  async configureProjectEnvironment(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    // Only configure project when not in remote environment
    const isLocal = RemoteExtension.checkLocalBeforeRunCommand(context);
    if (!isLocal) {
      return;
    }
    const scaffoldType = ScaffoldType.Local;

    if (!(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0)) {
      const message =
          'You have not yet opened a folder in Visual Studio Code. Please select a folder first.';
      vscode.window.showWarningMessage(message);
      return;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    await vscode.window.withProgress(
        {
          title: 'Project environment configuration',
          location: vscode.ProgressLocation.Window,
        },
        async () => {
          // Select platform if not specified
          const platformSelection =
              await utils.selectPlatform(scaffoldType, context);
          let platform: PlatformType;
          if (!platformSelection) {
            telemetryContext.properties.errorMessage =
                'Platform selection cancelled.';
            telemetryContext.properties.result = 'Cancelled';
            return;
          } else {
            telemetryContext.properties.platform = platformSelection.label;
            platform = utils.getEnumKeyByEnumValue(
                PlatformType, platformSelection.label);
          }

          const res = await ProjectEnvironmentConfiger
                          .configureProjectEnvironmentAsPlatform(
                              context, channel, telemetryContext, platform,
                              rootPath, scaffoldType);
          if (!res) {
            return;
          }

          const message = `Successfully configure project environment.`;
          utils.channelShowAndAppendLine(channel, message);
          vscode.window.showInformationMessage(message);
        });

    return;
  }

  static async configureProjectEnvironmentAsPlatform(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, platform: PlatformType,
      rootPath: string, scaffoldType: ScaffoldType): Promise<boolean> {
    if (platform === PlatformType.Arduino) {
      // First ensure the project is correctly open.
      const iotProject = await utils.constructAndLoadIoTProject(
          context, channel, telemetryContext);
      if (!iotProject) {
        return false;
      }

      // Validate platform.
      // Only iot workbench Arduino project created by workbench extension
      // can be configured as Arduino platform(for upgrade).
      const projectHostType =
          await IoTWorkbenchProjectBase.getProjectType(scaffoldType, rootPath);
      if (projectHostType !== ProjectHostType.Workspace) {
        const message =
            `This is not an iot workbench Arduino projects. You cannot configure it as Arduino platform.`;
        utils.channelShowAndAppendLine(channel, message);
        vscode.window.showInformationMessage(message);
        return false;
      }
    }

    let project;
    if (platform === PlatformType.EmbeddedLinux) {
      telemetryContext.properties.projectHostType = 'Container';
      project = new ioTContainerizedProjectModule.IoTContainerizedProject(
          context, channel, telemetryContext);

      // If external project, construct as RaspberryPi Device based
      // container iot workbench project
      await project.constructExternalProjectToIotProject(scaffoldType);

    } else if (platform === PlatformType.Arduino) {
      telemetryContext.properties.projectHostType = 'Workspace';
      project = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
          context, channel, telemetryContext);
    } else {
      throw new Error('unsupported platform');
    }

    let res = await project.load(scaffoldType);
    if (!res) {
      throw new Error(
          `Failed to load project. Project environment configuration stopped.`);
    }

    // Add configuration files
    res = await project.configureProjectEnvironmentCore(rootPath, scaffoldType);
    if (!res) {
      // User cancel configuration selection
      return false;
    }

    await project.openProject(rootPath, false);
    return true;
  }
}