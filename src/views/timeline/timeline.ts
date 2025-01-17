import { Timeline, TimelineChannel, TimelineClip, TimelineElement, TimelineElementType, TimelineGroup } from 'harmony-3d';
import { createElement, hide, shadowRootStyle, show } from 'harmony-ui';
import timelineCSS from '../../css/timeline.css';

export class HTMLTimelineElement extends HTMLElement {
	#shadowRoot: ShadowRoot;
	#htmlContainer: HTMLElement;
	#htmlRuler: HTMLElement;
	#htmlContent: HTMLElement;
	#htmlCursor: HTMLElement;

	#childs = new Map<TimelineElement, any/*TODO: proper type*/>();

	#timeline?: Timeline;
	#timescale = 30;
	#timeOffset = 0;
	#startTimeOffset = 0;
	#dragRuler = false;
	#dragRulerStartOffsetX = 0;
	constructor() {
		super();

		this.#shadowRoot = this.attachShadow({ mode: 'closed' });
		shadowRootStyle(this.#shadowRoot, timelineCSS);

		this.#htmlContainer = createElement('div', {
			class: 'timeline',
			parent: this.#shadowRoot,
			childs: [
				this.#htmlRuler = createElement('ul', {
					class: 'ruler-x',
					innerHTML: '<li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li>',
					events: {
						mousedown: (event: MouseEvent) => this.#startDragRuler(event),
					}
				}),
				this.#htmlContent = createElement('div', { class: 'content' }),
				this.#htmlCursor = createElement('div', { class: 'cursor' }),
			]
		});

		document.addEventListener('mousemove', (event: MouseEvent) => this.#handleMouseMove(event));
		document.addEventListener('mouseup', (event: MouseEvent) => this.#handleMouseUp(event));
	}

	setTimeline(timeline?: Timeline) {
		this.#timeline = timeline;
		this.#updateHTML();
	}

	#updateElement(element: TimelineElement) {
		if (element == this.#timeline) {
			this.#updateHTML();
		} else {
			switch (element.type) {
				case TimelineElementType.Group:
					this.#updateGroup(element as TimelineGroup);
					break;
				case TimelineElementType.Channel:
					this.#updateChannel(element as TimelineChannel);
					break;
				case TimelineElementType.Clip:
					this.#updateClip(element as TimelineClip);
					break;
				default:
					//throw 'code this case ' + this.#timeline.type;
					console.error('code this case ' + element.type);
			}

		}
	}

	#updateHTML() {
		//this.#htmlHeader.innerText = '';
		this.#htmlContent.innerText = '';

		if (!this.#timeline) {
			return;
		}
		this.#updateTime();

		//this.#htmlHeader.innerText = (this.#timeline as TimelineElement).getPropertyValue('name');
		const root = this.#timeline?.getRoot();
		if (!root) {
			return;
		}

		const h = this.#getChild(root);
		if (h) {
			this.#htmlContent.replaceChildren(h.html);
		}

		this.#updateElement(root);
	}

	#updateTime() {
		//const rect = this.#htmlTimeline.getBoundingClientRect();
		//const width = rect.width;

		//const ticks =

	}

	#updateGroup(group: TimelineGroup) {
		const htmlGroup = this.#getChild(group);
		if (!htmlGroup) {
			return;
		}

		//this.#htmlContainer.classList.add('group');
		const name = group.getName();
		if (name) {
			show(htmlGroup.htmlHeader);
			htmlGroup.htmlHeader.innerText = name;
		} else {
			hide(htmlGroup.htmlHeader);
		}

		for (const child of group.getChilds()) {
			const h = this.#getChild(child);
			if (h) {
				//this.#htmlContent.replaceChildren(h.html);
				htmlGroup.htmlContent.append(h.html);
				this.#updateElement(child);
			}
		}
	}

	#updateChannel(channel: TimelineChannel) {
		const htmlChannel = this.#getChild(channel);
		if (!htmlChannel) {
			return;
		}

		//this.#htmlContainer.classList.add('group');
		const name = channel.getName();
		if (name) {
			show(htmlChannel.htmlHeader);
			htmlChannel.htmlHeader.innerText = name;
		} else {
			hide(htmlChannel.htmlHeader);
		}

		for (const clip of channel.getClips()) {
			const h = this.#getChild(clip);
			if (h) {
				//this.#htmlContent.replaceChildren(h.html);
				htmlChannel.htmlContent.append(h.html);
				this.#updateElement(clip);
			}
		}
		/*
		this.#htmlContainer.classList.add('channel');
		const name = (this.#timeline as TimelineChannel).getPropertyValue('name') as string;
		if (name) {
			show(this.#htmlHeader);
			this.#htmlHeader.innerText = name;
		} else {
			hide(this.#htmlHeader);
		}
			*/

	}

	#updateClip(clip: TimelineClip) {
		const htmlClip = this.#getChild(clip);
		if (!htmlClip) {
			return;
		}

		htmlClip.html.innerText = clip.getName();
		htmlClip.html.style.left = `${clip.getStartTime()}px`;
		htmlClip.html.style.width = `${clip.getLength()}px`;

		/*
		this.#htmlContainer.classList.add('clip');
		const name = (this.#timeline as TimelineClip).getPropertyValue('name') as string;
		if (name) {
			show(this.#htmlHeader);
			this.#htmlHeader.innerText = name;
		} else {
			hide(this.#htmlHeader);
		}

		*/

	}

	#getChild(element: TimelineElement): { [key: string]: HTMLElement, html: HTMLElement } | undefined {
		let html: any/*TODO: fix type*/ = this.#childs.get(element);
		if (!html) {
			//html = createElement('div') as HTMLTimelineElement;
			//html.setTimelineElement(element);

			html = this.#createChild(element);
			this.#childs.set(element, html);
		}
		return html;
	}

	#createChild(element: TimelineElement): { [key: string]: HTMLElement, html: HTMLElement } | undefined {
		let htmlHeader, htmlContent;
		switch (element.type) {
			case TimelineElementType.Group:
				const htmlGroup = createElement('div', {
					class: 'group',
					childs: [
						htmlHeader = createElement('div', { class: 'header' }),
						htmlContent = createElement('div', { class: 'content' }),
					]
				});


				return {
					html: htmlGroup,
					htmlHeader: htmlHeader,
					htmlContent: htmlContent,
				};


			case TimelineElementType.Channel:
				const htmlChannel = createElement('div', {
					class: 'channel',
					childs: [
						htmlHeader = createElement('div', { class: 'header' }),
						htmlContent = createElement('div', { class: 'content' }),
					]
				});


				return {
					html: htmlChannel,
					htmlHeader: htmlHeader,
					htmlContent: htmlContent,
				};

			case TimelineElementType.Clip:
				const htmlClip = createElement('div', {
					class: 'clip',
					childs: [
						htmlHeader = createElement('div', { class: 'header' }),
						htmlContent = createElement('div', { class: 'content' }),
					]
				});


				return {
					html: htmlClip,
					htmlHeader: htmlHeader,
					htmlContent: htmlContent,
				};
			default:
				//throw 'code this case ' + this.#timeline.type;
				console.error('code this case ' + element.type);
		}
	}

	setTimeOffset(offset: number) {
		this.#htmlContainer.style.setProperty('--timeline-offset-x', String(offset));
		this.#timeOffset = offset;
	}

	#startDragRuler(event: MouseEvent) {
		if (this.#dragRuler) {
			return;
		}
		this.#htmlRuler.classList.add('grabbing');
		this.#dragRuler = true;
		this.#dragRulerStartOffsetX = event.offsetX;
		this.#startTimeOffset = this.#timeOffset;
	}

	#handleMouseMove(event: MouseEvent) {
		if (!this.#dragRuler) {
			return;
		}

		this.#moveRuler(event.offsetX);
	}

	#handleMouseUp(event: MouseEvent) {
		if (!this.#dragRuler) {
			return;
		}
		this.#htmlRuler.classList.remove('grabbing');
		this.#dragRuler = false;
	}

	#moveRuler(offsetX: number) {
		this.setTimeOffset(this.#startTimeOffset + offsetX - this.#dragRulerStartOffsetX);
	}
}

let definedTimelineElement = false;
export function defineTimelineElement() {
	if (window.customElements && !definedTimelineElement) {
		customElements.define('harmony3d-timeline', HTMLTimelineElement);
		definedTimelineElement = true;
	}
}
