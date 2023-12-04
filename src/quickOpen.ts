/*---------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as cp from 'child_process';
import { Uri, window, Disposable, FileSystemError } from 'vscode';
import { QuickPickItem } from 'vscode';
import { workspace } from 'vscode';
declare global {
    var path: string;
}

/**
 * A file opener using window.createQuickPick().
 * 
 * It shows how the list of items can be dynamically updated based on
 * the user's input in the filter field.
 */
export async function quickOpen() {
    console.log("quickOpen: Start"); // Debug message for function start
    const uri = await pickFile();
    if (uri) {
        console.log(`quickOpen: Picked file URI - ${uri}`); // Debug message for file URI picked
        const document = await workspace.openTextDocument(uri);
        await window.showTextDocument(document);
        console.log("quickOpen: Document shown"); // Debug message for document shown
    }
    console.log("quickOpen: End"); // Debug message for function end
}

class FileItem implements QuickPickItem {

    label: string;
    description: string;

    constructor(public base: Uri, public uri: Uri) {
        this.label = path.basename(uri.fsPath);
        this.description = path.dirname(path.relative(base.fsPath, uri.fsPath));
    }
}

class MessageItem implements QuickPickItem {

    label: string;
    description = '';
    detail: string;

    constructor(public base: Uri, public message: string) {
        this.label = message.replace(/\r?\n/g, ' ');
        this.detail = base.fsPath;
    }
}

class CreateFileItem implements QuickPickItem {
    label: string;
    description = 'Create new file at this location';
    detail: string;

    constructor(public path: string) {
        this.label = `Create "${path}"`;
        this.detail = path;
    }
}

async function pickFile() {
    console.log("pickFile: Start"); // Debug message for function start
    const disposables: Disposable[] = [];
    try {
        return await new Promise<Uri | undefined>((resolve, reject) => {
            const input = window.createQuickPick<FileItem | MessageItem | CreateFileItem>();
            input.placeholder = 'Type to search for files';
            let rgs: cp.ChildProcess[] = [];
            disposables.push(
                input.onDidChangeValue(value => {
                    console.log(`pickFile: Value changed to ${value}`); // Debug message for value change
                    rgs.forEach(rg => rg.kill());
                    if (!value) {
                        input.items = [];
                        return;
                    }
                    input.busy = true;
                    const cwds = workspace.workspaceFolders ? workspace.workspaceFolders.map(f => f.uri.fsPath) : [process.cwd()];
                    const q = process.platform === 'win32' ? '"' : '\'';
                    rgs = cwds.map(cwd => {
                        const rg = cp.exec(`rg --files -g ${q}*${value}*${q}`, { cwd }, (err, stdout) => {
                            console.log(`pickFile: rg executed in ${cwd}`); // Debug message for rg execution
                            const i = rgs.indexOf(rg);
                            if (i !== -1) {
                                if (rgs.length === cwds.length) {
                                    input.items = [];
                                }
                                if (!err) {
                                    input.items = input.items.concat(
                                        stdout
                                            .split('\n').slice(0, 50)
                                            .map(relative => new FileItem(Uri.file(cwd), Uri.file(path.join(cwd, relative))))
                                    );
                                    console.log(`pickFile: Files found for ${value}`); // Debug message for files found
                                }
                                if (err && !(<any>err).killed && (<any>err).code !== 1 && err.message) {
                                    input.items = input.items.concat([
                                        new MessageItem(Uri.file(cwd), err.message)
                                    ]);
                                    console.log(`pickFile: Error - ${err.message}`); // Debug message for error
                                }
                                rgs.splice(i, 1);
                                if (!rgs.length) {
                                    input.busy = false;
                                }
                            }
                        });
                        return rg;
                    });

                    // If no files are found, show the option to create a file
                    if (input.items.length === 0) {
                        const cwds = workspace.workspaceFolders ? workspace.workspaceFolders.map(f => f.uri.fsPath) : [process.cwd()];
                        cwds.forEach(cwd => {
                            const filePath = path.join(cwd, value);
                            const createFileItem = new CreateFileItem(filePath);
                            input.items = [createFileItem];
                            console.log(`pickFile: No files found, option to create file at ${filePath}`); // Debug message for create file option
                        });
                    }
                }),
                input.onDidChangeSelection(items => {
                    const item = items[0];
                    if (item instanceof FileItem) {
                        resolve(item.uri);
                        console.log(`pickFile: File item selected - ${item.uri}`); // Debug message for file item selection
                        input.hide();
                    }
                    else if (item instanceof CreateFileItem) {
                        // Logic to create a new file
                        const newFilePath = item.detail;
                        cp.exec(`touch "${newFilePath}"`, (err) => {
                            if (err) {
                                window.showErrorMessage(`Failed to create file: ${err.message}`);
                                console.log(`pickFile: Failed to create file - ${err.message}`); // Debug message for file creation failure
                            } else {
                                resolve(Uri.file(newFilePath));
                                console.log(`pickFile: File created - ${newFilePath}`); // Debug message for file creation
                                window.showInformationMessage(`File created: ${newFilePath}`);
                            }
                        });
                        input.hide();
                    }
                }),
                input.onDidHide(() => {
                    rgs.forEach(rg => rg.kill());
                    resolve(undefined);
                    console.log("pickFile: Input closed"); // Debug message for input closure
                    input.dispose();
                })
            );// disposiables.push
            input.show();
            console.log("pickFile: QuickPick shown"); // Debug message for QuickPick shown
        });
    } finally {
        disposables.forEach(d => d.dispose());
        console.log("pickFile: Disposables disposed"); // Debug message for disposing disposables
    }
}
