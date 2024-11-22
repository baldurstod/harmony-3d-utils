import { Timeline, TimelineChannel, TimelineClip, TimelineElement, TimelineElementType, TimelineGroup } from 'harmony-3d';
import { createElement, hide, shadowRootStyle, show } from 'harmony-ui';
import timelineCSS from '../../css/timeline.css';

export class HTMLTimelineElement extends HTMLElement {
	#shadowRoot: ShadowRoot;
	#htmlContainer: HTMLElement;
	#htmlHeader: HTMLElement;
	#htmlContent: HTMLElement;

	#childs = new Map<TimelineElement, HTMLTimelineElement>();
	#timelineElement?: TimelineElement;
	constructor() {
		super();

		this.#shadowRoot = this.attachShadow({ mode: 'closed' });
		shadowRootStyle(this.#shadowRoot, timelineCSS);

		this.#htmlContainer = createElement('div', {
			parent: this.#shadowRoot,
			childs: [
				this.#htmlHeader = createElement('div', { class: 'header', parent: this.#shadowRoot, }),
				this.#htmlContent = createElement('div', { class: 'content', parent: this.#shadowRoot, }),
			]
		});
	}

	setTimelineElement(timelineElement?: TimelineElement) {
		this.#timelineElement = timelineElement;
		this.#updateHTML();
	}

	#updateHTML() {
		this.#htmlHeader.innerText = '';
		this.#htmlContent.innerText = '';

		if (!this.#timelineElement) {
			return;
		}

		switch (this.#timelineElement.type) {
			case TimelineElementType.Timeline:
				this.#updateTimeline();
				break;
			case TimelineElementType.Group:
				this.#updateGroup();
				break;
			case TimelineElementType.Channel:
				this.#updateChannel();
				break;
			case TimelineElementType.Clip:
				this.#updateClip();
				break;
			default:
				//throw 'code this case ' + this.#timelineElement.type;
				console.error('code this case ' + this.#timelineElement.type);
		}
	}

	#updateTimeline() {
		this.#htmlContainer.classList.add('timeline');
		this.#htmlHeader.innerText = (this.#timelineElement as TimelineElement).getPropertyValue('name');
		this.#htmlContent.append(this.#getChild((this.#timelineElement as Timeline).getRoot()));
	}

	#updateGroup() {
		this.#htmlContainer.classList.add('group');
		const name = (this.#timelineElement as TimelineGroup).getPropertyValue('name') as string;
		if (name) {
			show(this.#htmlHeader);
			this.#htmlHeader.innerText = name;
		} else {
			hide(this.#htmlHeader);
		}

		const htmlChild = createElement('div', { class: 'childs', parent: this.#htmlContent });
		for (const child of (this.#timelineElement as TimelineGroup).getChilds()) {
			htmlChild.append(this.#getChild(child));
		}
	}

	#updateChannel() {
		this.#htmlContainer.classList.add('channel');
		const name = (this.#timelineElement as TimelineChannel).getPropertyValue('name') as string;
		if (name) {
			show(this.#htmlHeader);
			this.#htmlHeader.innerText = name;
		} else {
			hide(this.#htmlHeader);
		}

	}

	#updateClip() {
		this.#htmlContainer.classList.add('clip');
		const name = (this.#timelineElement as TimelineClip).getPropertyValue('name') as string;
		if (name) {
			show(this.#htmlHeader);
			this.#htmlHeader.innerText = name;
		} else {
			hide(this.#htmlHeader);
		}

		this.style.left = `${(this.#timelineElement as TimelineClip).getStartTime()}px`;
		this.style.width = `${(this.#timelineElement as TimelineClip).getLength()}px`;

	}

	#getChild(element: TimelineElement): HTMLTimelineElement {
		let html: HTMLTimelineElement | undefined = this.#childs.get(element);
		if (!html) {
			html = createElement('harmony3d-timeline') as HTMLTimelineElement;
			html.setTimelineElement(element);
			this.#childs.set(element, html);
		}
		return html;
	}
}

let definedTimelineElement = false;
export function defineTimelineElement() {
	if (window.customElements && !definedTimelineElement) {
		customElements.define('harmony3d-timeline', HTMLTimelineElement);
		definedTimelineElement = true;
	}
}
