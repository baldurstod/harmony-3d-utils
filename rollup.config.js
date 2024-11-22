import fs from 'fs';
import child_process from 'child_process';
import typescript from '@rollup/plugin-typescript';
import css from 'rollup-plugin-import-css';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const TEMP_BUILD = './dist/dts/index.js';

export default [
	{
		input: './src/index.ts',
		output: {
			file: TEMP_BUILD,
			format: 'esm',
		},
		plugins: [
			css(),
			typescript({
				"declaration": true,
				"declarationMap": true,
				"declarationDir": "dist/dts",
			}),
			{
				name: 'postbuild-commands',
				closeBundle: async () => {
					await postBuildCommands()
				}
			},
		],
		external: [
			'harmony-3d',
			'harmony-tf2-utils',
			'harmony-ui',
			'harmony-svg',
			'gl-matrix',
		],
	},
	{
		input: './src/browser.ts',
		output: {
			file: './dist/harmony-3d-utils.browser.js',
			format: 'esm'
		},
		plugins: [
			css(),
			typescript(),
			nodeResolve({
				dedupe: ['gl-matrix', 'harmony-ui', 'harmony-3d'],
			}),

		],
	},
];

async function postBuildCommands() {
	fs.copyFile(TEMP_BUILD, './dist/index.js', err => { if (err) throw err });
	return new Promise(resolve => child_process.exec(
		'api-extractor run --local --verbose --typescript-compiler-folder ./node_modules/typescript',
		(error, stdout, stderr) => {
			if (error) {
				console.log(error);
			}
			resolve("done")
		},
	));
}
