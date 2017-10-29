'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as xml from 'xml2js';

export function activate(context: vscode.ExtensionContext) {
    const fullyCoveredDecoration = vscode.window.createTextEditorDecorationType({
        gutterIconPath: context.asAbsolutePath("./images/full.svg"),
    });
    const partlyCoveredDecoration = vscode.window.createTextEditorDecorationType({
        gutterIconPath: context.asAbsolutePath("./images/partial.svg")
    });
    const notCoveredDecoration = vscode.window.createTextEditorDecorationType({
        gutterIconPath: context.asAbsolutePath("./images/no.svg")
    });

    let coverage = new Array<IFileCoverage>();
    const renderForEditor = (editor: vscode.TextEditor) => {
        editor.setDecorations(fullyCoveredDecoration, []);
        editor.setDecorations(partlyCoveredDecoration, []);
        editor.setDecorations(notCoveredDecoration, []);
        coverage
            .filter(coverage => editor.document.fileName.endsWith(coverage.fileName))
            .forEach(coverage => {
                editor.setDecorations(fullyCoveredDecoration, coverage.fullyCoveredRanges);
                editor.setDecorations(partlyCoveredDecoration, coverage.partlyCoveredRanges);
                editor.setDecorations(notCoveredDecoration, coverage.notCoveredRanges);
            });
    };

    let filePath: string;
    const renderForEditors = () => {
        coverage = filePath != null ? parse(filePath) : [];
        vscode.window.visibleTextEditors.forEach(renderForEditor)
    };

    let fileWatcher: vscode.FileSystemWatcher;
    const disposeFileWatcher = () => {
        if (fileWatcher != null) {
            fileWatcher.dispose();
        }
    };

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(renderForEditor),
        vscode.commands.registerCommand('jacoco.showCoverage', () => {
            disposeFileWatcher();
            vscode.window.showInputBox({
                prompt: "Path to JaCoCo XML report",
                value: "build/reports/jacoco/test/jacocoTestReport.xml",
                validateInput: (input) => fs.lstatSync(vscode.workspace.rootPath + "/" + input).isFile() ? "" : "File not found"
            }).then((input: string) => {
                if (input != null) {
                    filePath = vscode.workspace.rootPath + "/" + input;
                    fileWatcher = vscode.workspace.createFileSystemWatcher(filePath);
                    fileWatcher.onDidChange(renderForEditors);
                } else {
                    filePath = null;
                }
                renderForEditors();
            });
        }),
        {
            dispose: disposeFileWatcher
        }
    );
}

interface IFileCoverage {
    fileName: string;
    fullyCoveredRanges: Array<vscode.Range>;
    partlyCoveredRanges: Array<vscode.Range>;
    notCoveredRanges: Array<vscode.Range>;
}

function parse(filePath: string): Array<IFileCoverage> {
    const result = new Array<IFileCoverage>();
    new xml.Parser().parseString(fs.readFileSync(filePath).toString(), (err, xml) => {
        xml.report.package.forEach(p => {
            p.sourcefile.forEach(s => {
                const fileCoverage: IFileCoverage = {
                    fileName: p.$.name + "/" + s.$.name,
                    fullyCoveredRanges: new Array<vscode.Range>(),
                    partlyCoveredRanges: new Array<vscode.Range>(),
                    notCoveredRanges: new Array<vscode.Range>(),
                };
                s.line.forEach(line => {
                    const nr = parseInt(line.$.nr) - 1;
                    const range = new vscode.Range(nr, 0, nr, 0);
                    if (line.$.mi == "0") {
                        fileCoverage.fullyCoveredRanges.push(range);
                    } else if (line.$.ci == "0") {
                        fileCoverage.notCoveredRanges.push(range);
                    } else {
                        fileCoverage.partlyCoveredRanges.push(range);
                    }
                });
                result.push(fileCoverage);
            });
        });
    });
    return result;
}

export function deactivate() {
}
