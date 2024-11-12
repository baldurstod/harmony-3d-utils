import { Repository } from 'harmony-3d';
import { createElement, createShadowRoot, shadowRootStyle } from 'harmony-ui';
import { defineRepositoryEntry, RepositoryEntryElement } from './repositoryentry';
import repositoryCSS from '../css/repository.css';

export class RepositoryElement  extends HTMLElement{
	#shadowRoot: ShadowRoot;
	#repository?: Repository;
	constructor(repository?: Repository) {
		super();

		this.#shadowRoot = this.attachShadow({ mode: 'closed' });
		shadowRootStyle(this.#shadowRoot, repositoryCSS);
/*
		this.#shadowRoot = createShadowRoot('div', {
			childs: [
				//this.#htmlLeftPanel = createElement('div', { class: 'loadout-application-left-panel' }),
			],
		});*/

		this.setRepository(repository);
	}

	setRepository(repository?: Repository) {
		this.#repository = repository;
		this.#updateHTML();
	}

	async #updateHTML() {
		this.#shadowRoot.innerHTML = '';
		if (!this.#repository) {
			return;
		}

		const response = await this.#repository.getFileList();
		if (response.error) {
			return;
		}

		defineRepositoryEntry();
		const entryview: RepositoryEntryElement = createElement('harmony3d-repository-entry', {
			parent: this.#shadowRoot,
		}) as RepositoryEntryElement;

		entryview.setRepositoryEntry(response.root);
	}

}
let definedRepository = false;
export function defineRepository() {
	if (window.customElements && !definedRepository) {
		customElements.define('harmony3d-repository', RepositoryElement);
		definedRepository = true;
	}
}
