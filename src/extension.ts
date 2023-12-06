var jsdom = require('jsdom');
const $ = require('jquery')(new jsdom.JSDOM().window);
import * as vscode from 'vscode';
import {
	commands,
	NotebookCellKind,
	WorkspaceEdit,
	workspace,
	window,
  } from "vscode";

export async function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "vscode-jupyter-gen-ai" is now active!');

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-jupyter-gen-ai.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from VSCode Jupyter GenAI integration plugin!');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-jupyter-gen-ai.generateInANewCell', async () => {
			const requestUrl = (
				workspace.getConfiguration().get('conf.VSCodeJupyterGenAI.requestUrl'));
			const requestTemplate = (
				workspace.getConfiguration().get('conf.VSCodeJupyterGenAI.requestTemplate'));
			var last_response_len = false;
			// @ts-ignore
			const editor = window.activeNotebookEditor!;
			const cellIndex = editor.selection.end - 1;
			const existingCell = editor.notebook.cellAt(cellIndex);
			if (existingCell.kind === NotebookCellKind.Markup) {
				//await commands.executeCommand("notebook.cell.edit");
			}
			const text = existingCell.document.getText();
			// @ts-ignore
			var request = JSON.parse(requestTemplate);
			request['messages'][1]['content'] = text;
			if (existingCell.kind === NotebookCellKind.Code) {
				await commands.executeCommand("notebook.cell.insertCodeCellBelow", 
											[{index: cellIndex}]);
			} else {
				await commands.executeCommand("notebook.cell.insertMarkdownCellBelow", 
											[{index: cellIndex}]);
				await commands.executeCommand("notebook.cell.edit");
			}

			const newEditor = window.activeNotebookEditor!;
			const newCellIndex = newEditor.selection.end - 1;
			const newCell = newEditor.notebook.cellAt(newCellIndex);

			if (existingCell.kind === NotebookCellKind.Markup) {
				await commands.executeCommand("list.focusUp");
				await commands.executeCommand("notebook.cell.edit");
				await commands.executeCommand("notebook.cell.quitEdit");
			} else {
				await commands.executeCommand("list.focusUp");
			}

			$.ajax({
				url: requestUrl,
				contentType: 'application/json',
				data: JSON.stringify(request),
				dataType: 'json',
				processData: false,
				type: 'POST',
				xhrFields: {
					onprogress: async function(e: any) {
						var this_response, response = e.currentTarget.response;
						if(last_response_len === false) {
							this_response = response;
							last_response_len = response.length;
						} else {
							this_response = response.substring(last_response_len);
							last_response_len = response.length;
						}
			
						var lines = this_response.split('\n');
						for (var i in lines) {
							var line = lines[i];
							if (!line.startsWith('data: ')) { continue; }
			
							var out = line.slice(6);
							if(out.trim() === '[DONE]') { return; }
			
							var d = JSON.parse(out);
							if (!d.choices[0].delta.content) { continue; }
			
							var token = d.choices[0].delta.content;
			
							// @ts-ignore
							const edit = new WorkspaceEdit();
							edit.insert(
								newCell.document.uri, 
								newCell.document.positionAt(9999999999), 
								token);
							await workspace.applyEdit(edit);
						}
					}
				}
			});
			//vscode.window.showInformationMessage('VSCode Jupyter GenAI integration plugin started.');
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}