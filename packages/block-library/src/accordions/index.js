/**
 * WordPress dependencies
 */
import { accordion } from '@wordpress/icons';
/**
 * Internal dependencies
 */
import edit from './edit';
import save from './save';
import metadata from './block.json';
import initBlock from '../utils/init-block';

const { name } = metadata;

export { metadata, name };

export const settings = {
	icon: accordion,
	example: {},
	edit,
	save,
};

export const init = () => initBlock( { name, metadata, settings } );
