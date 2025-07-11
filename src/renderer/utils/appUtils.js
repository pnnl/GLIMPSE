const getCustomTheme = async (paths) => {
   let themeData = null;

   for (let i = 0; i < paths.length; i++) {
      // Look for the theme file
      if (paths[i].split(".")[1] === "theme") {
         // get the theme data if the file is valid against a JSON schema
         // if not valid the validateTheme function will return a object with an error message
         const themeDataPromise = window.glimpseAPI.validateTheme(paths[i]);
         themeData = await themeDataPromise;

         paths.splice(i, 1);
         break;
      }
   }

   if (themeData && "error" in themeData) {
      alert(themeData.error);
      return;
   }

   return themeData;
};

export const isGlmFile = (path) => path.split(".").pop() === "glm";
const isJsonFile = (path) => path.split(".").pop() === "json";
const isXmlFile = (path) => {
   const fileExtension = path.split(".").pop();
   return fileExtension === "xml" || fileExtension === "XML";
};

/**
 * This function will get the paths of the uploaded files and send them to the
 * main process to then read the files, parse them, and evalute them.
 * @param {Array} paths - An array of paths from the uploaded files
 */
export const handleFileUpload = async (paths, setFileData, setFilesUploaded) => {
   setFileData({ loading: true });

   const selectedThemePromise = window.glimpseAPI.getTheme();
   const selectedTheme = await selectedThemePromise;

   if (paths.every(isGlmFile) && selectedTheme === "power-grid-theme") {
      setFilesUploaded(true);

      const themePromise = window.glimpseAPI.getThemeJsonData("PowerGrid.theme.json");
      const dataPromise = window.glimpseAPI.glm2json(paths);

      const data = await dataPromise;
      const theme = await themePromise;

      if (!data) {
         alert("Something went wrong... \n Re-upload or reset app");
         setFilesUploaded(false);
         setFileData({ loading: false });
      } else if ("alert" in data) {
         alert(data.alert);
         setFilesUploaded(false);
         setFileData({ loading: false });
      } else {
         setFileData({
            visData: data,
            theme: theme,
            isGlm: true,
            isCim: false,
            loading: false
         });
      }
   } else if (paths.every(isXmlFile) && selectedTheme === "power-grid-theme") {
      setFilesUploaded(true);
      const dataPromise = window.glimpseAPI.cimToGS(paths);
      const themePromise = window.glimpseAPI.getThemeJsonData("PowerGrid.theme.json");

      const data = await dataPromise;
      const theme = await themePromise;

      if (!data) {
         alert("Something went wrong... \n Re-upload or reset app");
         setFilesUploaded(false);
         setFileData({ loading: false });
      } else if ("alert" in data) {
         alert(data.alert);
         setFilesUploaded(false);
         setFileData({ loading: false });
      } else {
         setFileData({
            visData: data,
            theme: theme,
            isGlm: false,
            isCim: true,
            loading: false
         });
      }
   } else if (paths.every(isJsonFile) && selectedTheme === "custom-theme") {
      let themeData = {
         groups: {
            inactive: {
               color: "rgba(200, 200, 200, 0.4)",
               shape: "dot"
            }
         },
         edgeOptions: {}
      };

      if (paths.length > 1) themeData = await getCustomTheme(paths);

      setFilesUploaded(true);
      const fileDataValidationPromise = window.glimpseAPI.validate(paths);
      const validFileData = JSON.parse(await fileDataValidationPromise);

      if ("error" in validFileData) {
         setFilesUploaded(false);
         setFileData({ loading: false });
         alert(validFileData.error);
      } else {
         setFileData({
            visData: validFileData,
            theme: themeData,
            isGlm: false,
            isCim: false,
            loading: false
         });
      }
   } else {
      alert(
         "Upload glm files with the Power Grid theme or any JSON file with the custom theme selected"
      );
      setFileData({ loading: false });
   }
};
