/**
 * WordPress dependencies
 */
import { SVG, Path } from '@wordpress/primitives';

const sidesBottom = (
	<SVG xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<Path
			d="m7.5 6h9v-1.5h-9zm0 13.5h9v-1.5h-9zm-3-3h1.5v-9h-1.5zm13.5-9v9h1.5v-9z"
			style={ { opacity: 0.25 } }
		/>
		<Path d="m16.5 19.5h-9v-1.5h9z" />
	</SVG>
);

export default sidesBottom;
