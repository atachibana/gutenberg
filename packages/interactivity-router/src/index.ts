/**
 * WordPress dependencies
 */
import { store, privateApis, getConfig } from '@wordpress/interactivity';

const {
	directivePrefix,
	getRegionRootFragment,
	initialVdom,
	toVdom,
	render,
	parseServerData,
	populateServerData,
	batch,
} = privateApis(
	'I acknowledge that using private APIs means my theme or plugin will inevitably break in the next version of WordPress.'
);

const regionAttr = `data-${ directivePrefix }-router-region`;
const interactiveAttr = `data-${ directivePrefix }-interactive`;

export interface NavigateOptions {
	force?: boolean;
	html?: string;
	replace?: boolean;
	timeout?: number;
	loadingAnimation?: boolean;
	screenReaderAnnouncement?: boolean;
}

export interface PrefetchOptions {
	force?: boolean;
	html?: string;
}

interface VdomParams {
	vdom?: typeof initialVdom;
}

interface Page {
	regions: Record< string, any >;
	title: string;
	initialData: any;
}

type RegionsToVdom = ( dom: Document, params?: VdomParams ) => Promise< Page >;

// Check if the navigation mode is full page or region based. The only supported
// mode for now is 'regionBased'.
const navigationMode: 'regionBased' = 'regionBased';

// The cache of visited and prefetched pages, stylesheets and scripts.
const pages = new Map< string, Promise< Page | false > >();

// Helper to remove domain and hash from the URL. We are only interesting in
// caching the path and the query.
const getPagePath = ( url: string ) => {
	const u = new URL( url, window.location.href );
	return u.pathname + u.search;
};

// Fetch a new page and convert it to a static virtual DOM.
const fetchPage = async ( url: string, { html }: { html: string } ) => {
	try {
		if ( ! html ) {
			const res = await window.fetch( url );
			if ( res.status !== 200 ) {
				return false;
			}
			html = await res.text();
		}
		const dom = new window.DOMParser().parseFromString( html, 'text/html' );
		return regionsToVdom( dom );
	} catch ( e ) {
		return false;
	}
};

// Return an object with VDOM trees of those HTML regions marked with a
// `router-region` directive.
const regionsToVdom: RegionsToVdom = async ( dom, { vdom } = {} ) => {
	const regions = { body: undefined };
	if ( navigationMode === 'regionBased' ) {
		dom.querySelectorAll(
			`[${ interactiveAttr }][${ regionAttr }]:not([${ interactiveAttr }] [${ interactiveAttr }])`
		).forEach( ( region ) => {
			const id = region.getAttribute( regionAttr );
			regions[ id ] = vdom?.has( region )
				? vdom.get( region )
				: toVdom( region );
		} );
	}
	const title = dom.querySelector( 'title' )?.innerText;
	const initialData = parseServerData( dom );
	return { regions, title, initialData };
};

// Render all interactive regions contained in the given page.
const renderRegions = async ( page: Page ) => {
	if ( navigationMode === 'regionBased' ) {
		batch( () => {
			populateServerData( page.initialData );
			document
				.querySelectorAll(
					`[${ interactiveAttr }][${ regionAttr }]:not([${ interactiveAttr }] [${ interactiveAttr }])`
				)
				.forEach( ( region ) => {
					const id = region.getAttribute( regionAttr );
					const fragment = getRegionRootFragment( region );
					render( page.regions[ id ], fragment );
				} );
		} );
	}
	if ( page.title ) {
		document.title = page.title;
	}
};

/**
 * Load the given page forcing a full page reload.
 *
 * The function returns a promise that won't resolve, useful to prevent any
 * potential feedback indicating that the navigation has finished while the new
 * page is being loaded.
 *
 * @param href The page href.
 * @return Promise that never resolves.
 */
const forcePageReload = ( href: string ) => {
	window.location.assign( href );
	return new Promise( () => {} );
};

// Listen to the back and forward buttons and restore the page if it's in the
// cache.
window.addEventListener( 'popstate', async () => {
	const pagePath = getPagePath( window.location.href ); // Remove hash.
	const page = pages.has( pagePath ) && ( await pages.get( pagePath ) );
	if ( page ) {
		await renderRegions( page );
		// Update the URL in the state.
		state.url = window.location.href;
	} else {
		window.location.reload();
	}
} );

// Initialize the router and cache the initial page using the initial vDOM.
pages.set(
	getPagePath( window.location.href ),
	Promise.resolve( regionsToVdom( document, { vdom: initialVdom } ) )
);

// Variable to store the current navigation.
let navigatingTo = '';

let hasLoadedNavigationTextsData = false;
const navigationTexts = {
	loading: 'Loading page, please wait.',
	loaded: 'Page Loaded.',
};

interface Store {
	state: {
		url: string;
		navigation: {
			hasStarted: boolean;
			hasFinished: boolean;
		};
	};
	actions: {
		navigate: ( href: string, options?: NavigateOptions ) => void;
		prefetch: ( url: string, options?: PrefetchOptions ) => void;
	};
}

export const { state, actions } = store< Store >( 'core/router', {
	state: {
		url: window.location.href,
		navigation: {
			hasStarted: false,
			hasFinished: false,
		},
	},
	actions: {
		/**
		 * Navigates to the specified page.
		 *
		 * This function normalizes the passed href, fetches the page HTML if
		 * needed, and updates any interactive regions whose contents have
		 * changed. It also creates a new entry in the browser session history.
		 *
		 * @param href                               The page href.
		 * @param [options]                          Options object.
		 * @param [options.force]                    If true, it forces re-fetching the URL.
		 * @param [options.html]                     HTML string to be used instead of fetching the requested URL.
		 * @param [options.replace]                  If true, it replaces the current entry in the browser session history.
		 * @param [options.timeout]                  Time until the navigation is aborted, in milliseconds. Default is 10000.
		 * @param [options.loadingAnimation]         Whether an animation should be shown while navigating. Default to `true`.
		 * @param [options.screenReaderAnnouncement] Whether a message for screen readers should be announced while navigating. Default to `true`.
		 *
		 * @return  Promise that resolves once the navigation is completed or aborted.
		 */
		*navigate( href: string, options: NavigateOptions = {} ) {
			const { clientNavigationDisabled } = getConfig();
			if ( clientNavigationDisabled ) {
				yield forcePageReload( href );
			}

			const pagePath = getPagePath( href );
			const { navigation } = state;
			const {
				loadingAnimation = true,
				screenReaderAnnouncement = true,
				timeout = 10000,
			} = options;

			navigatingTo = href;
			actions.prefetch( pagePath, options );

			// Create a promise that resolves when the specified timeout ends.
			// The timeout value is 10 seconds by default.
			const timeoutPromise = new Promise< void >( ( resolve ) =>
				setTimeout( resolve, timeout )
			);

			// Don't update the navigation status immediately, wait 400 ms.
			const loadingTimeout = setTimeout( () => {
				if ( navigatingTo !== href ) {
					return;
				}

				if ( loadingAnimation ) {
					navigation.hasStarted = true;
					navigation.hasFinished = false;
				}
				if ( screenReaderAnnouncement ) {
					a11ySpeak( 'loading' );
				}
			}, 400 );

			const page = yield Promise.race( [
				pages.get( pagePath ),
				timeoutPromise,
			] );

			// Dismiss loading message if it hasn't been added yet.
			clearTimeout( loadingTimeout );

			// Once the page is fetched, the destination URL could have changed
			// (e.g., by clicking another link in the meantime). If so, bail
			// out, and let the newer execution to update the HTML.
			if ( navigatingTo !== href ) {
				return;
			}

			if (
				page &&
				! page.initialData?.config?.[ 'core/router' ]
					?.clientNavigationDisabled
			) {
				yield renderRegions( page );
				window.history[
					options.replace ? 'replaceState' : 'pushState'
				]( {}, '', href );

				// Update the URL in the state.
				state.url = href;

				// Update the navigation status once the the new page rendering
				// has been completed.
				if ( loadingAnimation ) {
					navigation.hasStarted = false;
					navigation.hasFinished = true;
				}

				if ( screenReaderAnnouncement ) {
					a11ySpeak( 'loaded' );
				}

				// Scroll to the anchor if exits in the link.
				const { hash } = new URL( href, window.location.href );
				if ( hash ) {
					document.querySelector( hash )?.scrollIntoView();
				}
			} else {
				yield forcePageReload( href );
			}
		},

		/**
		 * Prefetches the page with the passed URL.
		 *
		 * The function normalizes the URL and stores internally the fetch
		 * promise, to avoid triggering a second fetch for an ongoing request.
		 *
		 * @param url             The page URL.
		 * @param [options]       Options object.
		 * @param [options.force] Force fetching the URL again.
		 * @param [options.html]  HTML string to be used instead of fetching the requested URL.
		 */
		prefetch( url: string, options: PrefetchOptions = {} ) {
			const { clientNavigationDisabled } = getConfig();
			if ( clientNavigationDisabled ) {
				return;
			}

			const pagePath = getPagePath( url );
			if ( options.force || ! pages.has( pagePath ) ) {
				pages.set(
					pagePath,
					fetchPage( pagePath, { html: options.html } )
				);
			}
		},
	},
} );

/**
 * Announces a message to screen readers.
 *
 * This is a wrapper around the `@wordpress/a11y` package's `speak` function. It handles importing
 * the package on demand and should be used instead of calling `ally.speak` direacly.
 *
 * @param messageKey The message to be announced by assistive technologies.
 */
function a11ySpeak( messageKey: keyof typeof navigationTexts ) {
	if ( ! hasLoadedNavigationTextsData ) {
		hasLoadedNavigationTextsData = true;
		const content = document.getElementById(
			'wp-script-module-data-@wordpress/interactivity-router'
		)?.textContent;
		if ( content ) {
			try {
				const parsed = JSON.parse( content );
				if ( typeof parsed?.i18n?.loading === 'string' ) {
					navigationTexts.loading = parsed.i18n.loading;
				}
				if ( typeof parsed?.i18n?.loaded === 'string' ) {
					navigationTexts.loaded = parsed.i18n.loaded;
				}
			} catch {}
		} else {
			// Fallback to localized strings from Interactivity API state.
			// @todo This block is for Core < 6.7.0. Remove when support is dropped.

			// @ts-expect-error
			if ( state.navigation.texts?.loading ) {
				// @ts-expect-error
				navigationTexts.loading = state.navigation.texts.loading;
			}
			// @ts-expect-error
			if ( state.navigation.texts?.loaded ) {
				// @ts-expect-error
				navigationTexts.loaded = state.navigation.texts.loaded;
			}
		}
	}

	const message = navigationTexts[ messageKey ];

	import( '@wordpress/a11y' ).then(
		( { speak } ) => speak( message ),
		// Ignore failures to load the a11y module.
		() => {}
	);
}
