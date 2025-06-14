/**
 * WordPress dependencies
 */
import { store, getContext, withSyncEvent } from '@wordpress/interactivity';

const { state } = store( 'router-regions', {
	state: {
		region1: {
			text: 'hydrated',
		},
		region2: {
			text: 'hydrated',
		},
		counter: {
			value: 0,
		},
		items: [ 'item 1', 'item 2', 'item 3' ],
	},
	actions: {
		router: {
			navigate: withSyncEvent( function* ( e ) {
				e.preventDefault();
				const { actions } = yield import(
					'@wordpress/interactivity-router'
				);
				yield actions.navigate( e.target.href );
			} ),
			back() {
				history.back();
			},
		},
		counter: {
			increment() {
				const context = getContext();
				if ( context?.counter ) {
					context.counter.value += 1;
				} else {
					state.counter.value += 1;
				}
			},
			init() {
				const context = getContext();
				if ( context.counter ) {
					context.counter.value = context.counter.initialValue;
				}
			},
		},
		addItem() {
			state.items.push( `item ${ state.items.length + 1 }` );
		},
	},
} );
