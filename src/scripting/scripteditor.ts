import { Editor, EditSession } from 'ace-builds';
import { LineWidget } from 'ace-builds-internal/line_widgets';
import { loadScripts, PersistentStorage } from 'harmony-browser-utils';
import { createElement, CreateElementChildOption, createShadowRoot, defineHarmonyInfoBox, defineHarmonyTab, defineHarmonyTabGroup, HTMLHarmonyInfoBoxElementType, HTMLHarmonyTabElement, HTMLHarmonyTabGroupElement, I18n, updateElement } from 'harmony-ui';
import { MyEventTarget } from 'harmony-utils';
import scriptEditorCSS from '../css/scripteditor.css';
import { getPyodide } from './pyodide';

export const ACE_EDITOR_URI = 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.12/ace.js';
const SCRIPT_PATH = '/scripts/';

export interface ScriptEditorOptions {
	aceUrl?: string;
};

type scriptJSON = {
	filename: string;
	is_open: boolean;
	/** Script content. Only used to export / import all scripts. */
	content?: string;
}

type scriptsJSON = {
	scripts: scriptJSON[];
	//active: string;
}

type Script = {
	filename: string;
	isOpen: boolean;
	content: string;
	tab?: HTMLHarmonyTabElement;
	modified: boolean;
	persistent: boolean;
}

export class ScriptEditor extends MyEventTarget {
	#aceEditorResolve!: () => void;
	#aceEditorReady = new Promise((resolve: (value: void) => void) => this.#aceEditorResolve = resolve);
	#initialized = false;
	#shadowRoot?: ShadowRoot;
	#aceEditor?: Editor;
	#sessions = new Map<string, EditSession>;
	#currentSession: EditSession | null = null;
	#htmlSaveButton?: HTMLButtonElement;
	#htmlInfos?: HTMLElement;
	#htmlFileTabs?: HTMLHarmonyTabGroupElement;
	#knownScripts = new Map<string, Script>();
	#scriptsInitialized = false;
	#activeScript?: Script;

	constructor() {
		super();
		window.addEventListener('beforeunload', (event: Event) => this.#beforeUnload(event));
	}

	get htmlElement(): HTMLElement {
		this.#initHtml();
		return this.#shadowRoot!.host as HTMLElement;
	}

	#initHtml(): void {
		if (this.#shadowRoot) {
			return;
		}
		this.#shadowRoot = createShadowRoot('div', { adoptStyle: scriptEditorCSS },);
		I18n.observeElement(this.#shadowRoot);
	}

	initEditor(options: ScriptEditorOptions = {}): void {
		if (this.#initialized) {
			return;
		}
		this.#initHtml();
		defineHarmonyInfoBox();
		defineHarmonyTab();
		defineHarmonyTabGroup();

		//this.#pyodideWorker.postMessage({ cmd: "setInterruptBuffer", interruptBuffer: this.#interruptBuffer });

		//this.#shadowRoot = this.attachShadow({ mode: 'closed' });
		//shadowRootStyle(this.#shadowRoot, scriptEditorCSS);


		const aceScript: string = options.aceUrl ?? ACE_EDITOR_URI;
		this.#initialized = true;

		//this.style.cssText = 'display: flex;flex-direction: column;height: 100%;width: 100%;';

		createElement('button', {
			parent: this.#shadowRoot,
			i18n: '#new_script',
			$click: () => { this.#newScript() },
		}) as HTMLButtonElement;

		this.#htmlSaveButton = createElement('button', {
			parent: this.#shadowRoot,
			i18n: {
				innerText: '#save',
				values: {
					filename: '',
				}
			},
			disabled: true,
			$click: () => { this.#saveScript() },
		}) as HTMLButtonElement;

		createElement('button', {
			parent: this.#shadowRoot,
			i18n: '#run',
			$click: () => { this.#run() },
		}) as HTMLButtonElement;

		/*
		createElement('button', {
			parent: this.#shadowRoot,
			i18n: '#stop',
			$click: () => { this.#stop() },
		}) as HTMLButtonElement;
		*/

		this.#htmlInfos = createElement('div', {
			parent: this.#shadowRoot,
			class: 'infos',
		});

		createElement('harmony-info-box', {
			parent: this.#htmlInfos,
			class: 'script-warning',
			type: 'error',
			i18n: '#script_warning',
		});
		/*
		createElement('harmony-info-box', {
			parent: this.#shadowRoot,
			type: 'ok',
			childs: [
				createElement('span', { i18n: '#script_snippets', }),
				createElement('a', { href: SNIPPET_URL, innerText: SNIPPET_URL, target: '_blank', style: 'color:white;' }),
			],
		});
		*/

		/*
		createElement('button', {
			parent:this.#shadowRoot,
			i18n: '#stop',
			$click: () => this.#stop(),
		}) as HTMLButtonElement;
		*/

		this.#htmlFileTabs = createElement('harmony-tab-group', {
			class: 'tabs',
			parent: this.#shadowRoot,
		}) as HTMLHarmonyTabGroupElement;

		const container = createElement('div', { style: 'flex:1;', parent: this.#shadowRoot });
		//this.#htmlErrors = createElement('textarea', { style: 'flex:1;', parent: this.#shadowRoot }) as HTMLTextAreaElement;

		if (aceScript == '') {
			this.#initEditor2(container);
		} else {
			loadScripts([aceScript]).then(() => {
				loadScripts(['./assets/js/ace-builds/src-min/ext-language_tools.js', './assets/js/ace-builds/src-min/ext-code_lens.js']).then(() => this.#initEditor2(container));
				//loadScripts([aceScript]).then(() => this.#initEditor2(container));
			})
		}

		this.#initTabs();
	}

	addInfo(type: HTMLHarmonyInfoBoxElementType, children: CreateElementChildOption[]): void {
		if (!this.#initialized) {
			console.error('You must initialize the editor before using this method');
			return;
		}

		createElement('harmony-info-box', {
			parent: this.#htmlInfos,
			type,
			childs: children,
		});
	}

	async #initTabs(): Promise<void> {
		this.#scriptsInitialized = true;
		const file = await PersistentStorage.readFileAsString(SCRIPT_PATH + 'scripts.json');
		if (file) {
			const json = JSON.parse(file) as scriptsJSON;
			if (json) {
				this.#knownScripts.clear();
				for (const scriptJSON of json.scripts) {
					const content = await PersistentStorage.readFileAsString(SCRIPT_PATH + scriptJSON.filename);
					if (content) {
						const script: Script = { filename: scriptJSON.filename, isOpen: scriptJSON.is_open, content: content, modified: false, persistent: true };
						this.#knownScripts.set(script.filename, script);
						if (scriptJSON.is_open) {
							this.#addTab(script);
						}
					}
				}
			}
		} else {
			//this.#addTab('script1', '');
			await PersistentStorage.writeFile(SCRIPT_PATH + 'scripts.json', '{"scripts":[]}');
			this.#newScript();
		}
	}

	#addTab(script: Script): void {
		script.tab = createElement('harmony-tab', {
			$activated: () => this.#setActive(script),
			parent: this.#htmlFileTabs,
			'data-text': script.filename,
		}) as HTMLHarmonyTabElement;
		script.tab.activate();

		this.#addSession(script.filename, script.content);
	}

	#setActive(script: Script): void {
		this.#setSession(script.filename);

		this.#refreshSaveButton(script);
		this.#activeScript = script;

		updateElement(this.#htmlSaveButton, {
			i18n: {
				values: {
					filename: script.filename,
				}
			},
		});
	}

	#refreshSaveButton(script: Script): void {
		if (script.modified) {
			this.#htmlSaveButton?.removeAttribute('disabled');
			script.tab?.setAttribute('data-text', script.filename + ' *');

		} else {
			this.#htmlSaveButton?.setAttribute('disabled', '1');
			script.tab?.setAttribute('data-text', script.filename);
		}
		this.#refreshTitle();
	}

	#refreshTitle(): void {
		let detail = false;
		for (const [, knownScript] of this.#knownScripts) {
			if (knownScript.modified) {
				detail = true;
				break;
			}
		}

		this.dispatchEvent(new CustomEvent<boolean>('has-modified-script', { detail }));
	}

	#newScript(): void {
		let index = 1;
		const regex = /script(\d*).py/;
		for (const [, knownScript] of this.#knownScripts) {
			const result = regex.exec(knownScript.filename);
			if (result && result?.length > 1) {
				const existing = Number(result[1])
				if (index <= existing) {
					index = existing + 1;
				}
			}
		}

		const script: Script = { filename: `script${index}.py`, isOpen: true, content: `#script${index}.py`, modified: false, persistent: false };
		this.#knownScripts.set(script.filename, script);
		this.#addTab(script);
	}

	async #saveScript(): Promise<void> {
		const script = this.#activeScript;
		if (script) {
			if (await PersistentStorage.writeFile(SCRIPT_PATH + script.filename, script.content)) {
				script.modified = false;
				script.persistent = true;
				this.#refreshSaveButton(script);
				await this.#saveScripts();
			} else {
				alert('Failed to save script');
			}
		}
	}

	async #saveScripts(): Promise<void> {
		const json: scriptsJSON = { scripts: [] };
		for (const [, script] of this.#knownScripts) {
			if (script.persistent) {
				json.scripts.push({ filename: script.filename, is_open: script.isOpen });
			}
		}

		await PersistentStorage.writeFile(SCRIPT_PATH + 'scripts.json', JSON.stringify(json));
	}

	async #run(): Promise<void> {
		//Utils.setInterrupt(false);
		const scriptText = this.#aceEditor!.getValue();

		const session = this.#currentSession!;


		(await getPyodide()).runPythonAsync(scriptText).catch(
			(e: unknown) => {
				if (e instanceof Error) {
					/*
					if (e.stack?.includes(InterruptError)) {
						// TODO: process interruption
						return;
					}
					*/
					let message;
					/*
					if (e.cause) {
						message += e.cause;
					}
					*/
					if (e.stack) {
						message = e.stack;
					} else {
						message = e.name + ': ' + e.message;
					}
					//this.#htmlErrors!.value = message;
					this.#addErrorWidget(session, message);
				} else {
					console.error(e);
					//this.#htmlErrors!.value = String(e);
					this.#addErrorWidget(session, String(e));
				}

				//const range = new (globalThis as any).ace.Range(0, 0, 0, 10);
				//this.#currentSession?.addMarker(range, "ace_link_marker", "text", true);
			}
		);
		//this.#pyodideWorker.postMessage({ cmd: "runCode", scriptText });
	}

	#initEditor2(id: HTMLElement): void {
		this.#aceEditor = (globalThis as any).ace.edit(id) as Editor;
		this.#aceEditor.setOptions({
			enableBasicAutocompletion: true,
			enableSnippets: true,
			enableLiveAutocompletion: true
		});
		this.#aceEditorResolve();
		this.#aceEditor.renderer.attachToShadowRoot();
		//this.#aceEditor.$blockScrolling = Infinity;
		this.#aceEditor.setTheme('ace/theme/monokai');
		//this.#scriptEditor.getSession().setMode('ace/mode/python');
		/*
		this.#scriptEditor.getSession().on('change', () => {
			//clearTimeout(this.#recompileTimeout);
			//this.#recompileTimeout = setTimeout(() => { this.recompile() }, this.#recompileDelay);//TODO:
		});
		*/

		this.#aceEditor.commands.addCommand({
			name: 'myCommand',
			bindKey: { win: 'Ctrl-Shift-C', mac: 'Command-M' },
			exec: () => {
				//this.recompile();
			},
		});
	}

	setAnnotations(): void {
		/*
		if (shaderName == this.#editorShaderName) {
			this.#scriptEditor.getSession().setAnnotations(ShaderManager.getCustomSourceAnnotations(shaderName));
		}
		*/
	}

	async #addSession(name: string, content: string): Promise<void> {
		await this.#aceEditorReady;
		const ace = (globalThis as any).ace;
		const session = new ace.EditSession(content, 'ace/mode/python') as EditSession;
		session.setUndoManager(new ace.UndoManager());
		//session.setMode('ace/mode/python');

		session.on('change', () => {
			//this.#recompileTimeout = setTimeout(() => { this.recompile() }, this.#recompileDelay);//TODO:
			const knownScript = this.#knownScripts.get(name);
			if (knownScript) {
				knownScript.modified = true;
				knownScript.content = session.getValue();
				this.#refreshSaveButton(knownScript);
			}
		});


		this.#sessions.set(name, session);
		await this.#setSession(name);
	}

	async #setSession(name: string): Promise<void> {
		await this.#aceEditorReady;

		const session = this.#sessions.get(name);
		if (session) {
			this.#currentSession = session;
			this.#aceEditor!.setSession(session);
		}
	}

	#addLineWidget(session: EditSession, element: HTMLElement): LineWidget {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const LineWidgets = require("ace/line_widgets").LineWidgets;
		if (!session.widgetManager) {
			session.widgetManager = new LineWidgets(session);
			session.widgetManager.attach(this.#aceEditor!);
		}
		const w: LineWidget = {
			row: 0,
			fixedWidth: true,
			coverGutter: false,
			el: element,
		};

		session.widgetManager.addLineWidget(w);
		return w;
	}

	#addErrorWidget(session: EditSession, error: string): void {
		const lineWidget = this.#addLineWidget(session, createElement('div', {
			class: 'widget error',
			childs: [
				createElement('button', {
					i18n: '#clear_error',
					$click: () => session.widgetManager.removeLineWidget(lineWidget),
				}),
				createElement('div', {
					class: 'text',
					innerText: error,
				}),
			]
		}));
	}

	#beforeUnload(event: Event): void {
		if (!this.#scriptsInitialized) {
			return;
		}

		for (const [, knownScript] of this.#knownScripts) {
			if (knownScript.modified) {
				event.preventDefault();
				return;
			}
		}
	}
}
