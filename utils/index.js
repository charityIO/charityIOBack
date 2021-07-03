/**
 * Returns whether a value is empty(null,undefined,"") or not
 *
 * @param {any} Any value for which we want to check emptiness.
 * @return {boolean} Is the value passed true or not.
 */
let isEmpty = (value) => {
	let emptyValues = [null, undefined, ""];
	return emptyValues.includes(value);
};

/**
 * Removes empty values like null,undefined and "" from an object(Sanitization)
 *
 * @param {object} Object which needs to be sanitized.
 * @return {object} The sanitized Object.
 */
let sanitizeObject = (object) => {
	let result = {...object}
	Object.keys(result).forEach(
		(key) => isEmpty(result[key]) && delete result[key]
	);
	return result
}

module.exports = {
	isEmpty,
	sanitizeObject
};
