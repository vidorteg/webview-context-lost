"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const cats = {
    'Coding Cat': 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    'Compiling Cat': 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif',
    'Testing Cat': 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif'
};
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('catCoding.start', () => {
        CatCodingPanel.createOrShow(context.extensionUri);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('catCoding.doRefactor', () => {
        if (CatCodingPanel.currentPanel) {
            CatCodingPanel.currentPanel.doRefactor();
        }
    }));
    if (vscode.window.registerWebviewPanelSerializer) {
        // Make sure we register a serializer in activation event
        vscode.window.registerWebviewPanelSerializer(CatCodingPanel.viewType, {
            async deserializeWebviewPanel(webviewPanel, state) {
                //console.log(`Got state: ${state}`);
                CatCodingPanel.revive(webviewPanel, context.extensionUri);
            }
        });
    }
}
exports.activate = activate;
/**
 * Manages cat coding webview panels
 */
class CatCodingPanel {
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Set the webview's initial html content
        this._update();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Update the content based on view changes
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showErrorMessage(message.text);
                    return;
            }
        }, null, this._disposables);
    }
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it.
        if (CatCodingPanel.currentPanel) {
            CatCodingPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(CatCodingPanel.viewType, 'Cat Coding', column || vscode.ViewColumn.One, {
            // Enable javascript in the webview
            enableScripts: true,
            // And restrict the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media'), vscode.Uri.joinPath(extensionUri, 'third_party')]
        });
        CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionUri);
    }
    static revive(panel, extensionUri) {
        CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionUri);
    }
    doRefactor() {
        // Send a message to the webview webview.
        // You can send any JSON serializable data.
        this._panel.webview.postMessage({ command: 'refactor' });
    }
    dispose() {
        CatCodingPanel.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _update() {
        const webview = this._panel.webview;
        // Vary the webview's content based on where it is located in the editor.
        switch (this._panel.viewColumn) {
            case vscode.ViewColumn.Two:
                this._updateForCat(webview, 'Compiling Cat');
                return;
            case vscode.ViewColumn.Three:
                this._updateForCat(webview, 'Testing Cat');
                return;
            case vscode.ViewColumn.One:
            default:
                this._updateForCat(webview, 'Coding Cat');
                return;
        }
    }
    _updateForCat(webview, catName) {
        this._panel.title = catName;
        this._panel.webview.html = this._getHtmlForWebview(webview, cats[catName]);
    }
    // _getHtmlForWebview2(webview: vscode.Webview,  catGifPath: string) {
    //     // Local path to main script run in the webview
    //     const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
    //     // And the uri we use to load this script in the webview
    //     const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
    //     const htmlPath = vscode.Uri.file(vscode.Uri.joinPath(this._extensionUri, "third_party", "inspector.html").path);
    //     const htmlUri = webview.asWebviewUri asWebviewUri(htmlPath);
    //     return htmlUri;
    // }
    _getHtmlForWebview(webview, catGifPath) {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
        // And the uri we use to load this script in the webview
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, "third_party", "inspector.html");
        const htmlUri = webview.asWebviewUri(htmlPath);
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy"
                content="default-src 'none';
                frame-src ${webview.cspSource} vscode-webview:;
                script-src ${webview.cspSource} vscode-webview:;
                style-src ${webview.cspSource};
                img-src ${webview.cspSource} https:;
                ">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Cat Coding</title>
			</head>
			<body>
				<img src="${catGifPath}" width="300" />
				<h1 id="lines-of-code-counter">0</h1>
				<script src="${scriptUri}"></script>
				<iframe id="internalFrame" src="${htmlUri}"></iframe>
			</body>
			</html>`;
    }
}
CatCodingPanel.viewType = 'catCoding';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=extension.js.map