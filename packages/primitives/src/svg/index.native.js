/**
 * External dependencies
 */
import { Svg } from 'react-native-svg';
import { Animated } from 'react-native';

/**
 * WordPress dependencies
 */
import { forwardRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import styles from './style.scss';

export {
	Circle,
	G,
	Path,
	Polygon,
	Rect,
	Defs,
	RadialGradient,
	LinearGradient,
	Stop,
} from 'react-native-svg';

const AnimatedSvg = Animated.createAnimatedComponent(
	forwardRef( ( props, ref ) => <Svg ref={ ref } { ...props } /> )
);

export const SVG = ( { className = '', isPressed, ...props } ) => {
	const colorScheme = props.colorScheme || 'light';
	const stylesFromClasses = className
		.split( ' ' )
		.map( ( element ) => styles[ element ] )
		.filter( Boolean );
	const defaultStyle = isPressed
		? styles[ 'is-pressed' ]
		: styles[ 'components-toolbar__control-' + colorScheme ];
	const styleValues = Object.assign(
		{},
		defaultStyle,
		props.style,
		...stylesFromClasses
	);

	const appliedProps = { ...props, style: styleValues };

	return (
		<AnimatedSvg
			//We want to re-render when style color is changed
			key={ appliedProps.style.color }
			height="100%"
			width="100%"
			{ ...appliedProps }
		/>
	);
};
