import { currentSystemProvider } from "./api.js";

const DISPLAY_MODE = {
	SHOW_ALL: 0,
	SHOW_VISIBLE: 1,
	SHOW_HIDDEN: 2,
	SHOW_MORE: 3,
};

class PartyOverviewApp extends Application {
	constructor(options) {
		super(options);

		this.hiddenActors = [];
		this.state = {};
		this.displayMode = DISPLAY_MODE.SHOW_VISIBLE;
		this.activeTab = "general";
		this.rendering = false;
	}

	update() {
		let actors = game.actors.contents.filter((a) => a.hasPlayerOwner);
		if (this.displayMode != DISPLAY_MODE.SHOW_MORE) {
			actors = actors
				.map((playerActor) => playerActor.getActiveTokens())
				.flat(1)
				.map((token) => token.actor);
		}
		if (!actors.length && !this.ignoreNoActors) return;

		// remove duplicates if an actors has multiple tokens on scene
		actors = actors.reduce((actors, actor) => (actors.map((a) => a.id).includes(actor.id) ? actors : [...actors, actor]), []);

		switch (this.displayMode) {
			case DISPLAY_MODE.SHOW_HIDDEN:
				actors = actors.filter((actor) => this.hiddenActors.includes(actor.id));
				break;
			case DISPLAY_MODE.SHOW_VISIBLE:
				actors = actors.filter((actor) => !this.hiddenActors.includes(actor.id));
				break;
		}

		actors = actors.map((actor) => {
			try {
				var actorDetails = currentSystemProvider.getActorDetails(actor);
			} catch (error) {
				console.error(`Error: Couldn't load actor "${actor.name}" (ID: "${actor.id}")`, error);
			}
			return {
				...actorDetails,
				shortestName: actor.name.split(/\s/).shift(),
				// shortestName: actor.name.split(/\s/).shift().length > 10 ? actor.name.split(/\s/).shift().substr(0, 10) + "…" : actor.name.split(/\s/).shift().substr(0, 10),
				isHidden: this.hiddenActors.includes(actor.id),
			};
		});

		let updates;
		[actors, updates] = currentSystemProvider.getUpdate(actors);

		let tabs = game.settings.get("party-overview", "tabVisibility");
		if (Object.keys(tabs).length != Object.keys(currentSystemProvider.tabs).length) {
			for (let tab in currentSystemProvider.tabs) {
				if (!tabs[tab]) {
					tabs[tab] = {
						id: currentSystemProvider.tabs[tab].id,
						localization: currentSystemProvider.tabs[tab].localization,
						visible: true,
					};
				}
			}
		}
		if (game.user.isGM) {
			Object.keys(tabs).forEach(function (key) {
				tabs[key].visible = true;
			});
		}

		this.state = {
			activeTab: this.activeTab,
			mode: this.displayMode,
			actors: actors,
			...updates,
			tabs,
		};
		let r = document.querySelector(":root");
		r.style.setProperty("--party-overview-min-width", `${currentSystemProvider.width - 100}px`);
		r.style.setProperty("--party-overview-min-height", `${78 + 33 * actors.length}px`);
	}

	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			width: currentSystemProvider.width,
			height: "fit-content",
			resizable: true,
			title: "Party Overview",
			template: currentSystemProvider.template,
			classes: ["party-overview-window", game.system.id],
			tabs: [
				{
					navSelector: ".tabs",
					contentSelector: ".content",
					initial: "general",
				},
			],
		});
	}

	getData() {
		this.update();
		return this.state;
	}

	activateListeners(html) {
		$(".btn-toggle-visibility").on("click", (event) => {
			const actorId = event.currentTarget.dataset.actor;
			this.hiddenActors = this.hiddenActors.includes(actorId) ? this.hiddenActors.filter((id) => id !== actorId) : [...this.hiddenActors, actorId];
			this.render(false);
		});

		$(".btn-filter").on("click", (event) => {
			this.displayMode += 1;
			if (this.displayMode > Object.keys(DISPLAY_MODE).length - 1) this.displayMode = 0;
			this.render(false);
		});

		$('span[name="hpCurrent"], span[name="hpMax"]', html).hover(
			function () {
				const data = $(this).data();
				$(this).text(data.temp ? `${data.value} (+${data.temp})` : data.value);
			},
			function () {
				const data = $(this).data();
				$(this).text(`${data.total}`);
			}
		);

		super.activateListeners(html);
	}

	render(force, ignoreNoActors = false, options) {
		this.rendering = true;
		this.ignoreNoActors = ignoreNoActors;
		super.render(force, options);
	}

	close() {
		this.rendering = false;
		super.close();
	}
}

export default PartyOverviewApp;
