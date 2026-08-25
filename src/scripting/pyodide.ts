import { loadScript } from 'harmony-browser-utils';
import { PyodideAPI } from 'pyodide';

let initialized = false;
let pyodide: PyodideAPI;

let readyPromiseResolve: (value: boolean) => void;
const readyPromise = new Promise<boolean>((resolve) => readyPromiseResolve = resolve);

export async function getPyodide(): Promise<PyodideAPI> {
	if (!initialized) {
		initPyodide();
	}
	await readyPromise;

	return pyodide;
}


export async function initPyodide(): Promise<boolean> {
	if (initialized) {
		return true;
	}
	initialized = true;

	if (!await loadScript('./assets/js/pyodide/pyodide.js')) {
		return false;
	}

	pyodide = await (globalThis as any).loadPyodide({ jsglobals: {} });
	pyodide.setDebug(true);
	pyodide.setStderr({ batched: (msg) => console.log(msg) });

	readyPromiseResolve(true);
	return true;
}

export async function registerPyodideModule(name: string, module: any) {
	const pyodide = await getPyodide();
	pyodide.registerJsModule(name, module);
}
