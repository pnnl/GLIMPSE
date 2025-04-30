/**
 * Reads a JSON file and returns the JSON data
 * @param {string} path -  The full path of the JSON file to be read
 * @returns {Object} - the JSON file data
 */
export const readJsonFile = async (path) => {
  const jsonData = await window.glimpseAPI.onReadJsonFile(path);
  return jsonData;
};
