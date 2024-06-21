const getCustomTheme = async (paths) => {
   let themeData = null;

   for (let i = 0; i < paths.length; i++) {
      if (paths[i].split(".")[1] === "theme") {
         themeData = await window.glimpseAPI.validateTheme(paths[i]);
         paths.splice(i, 1);
         break;
      }
   }

   return themeData;
};

/**
 * This function will get the paths of the uploaded files and send them to the
 * main process to then read the files, parse them, and evalute them.
 * @param {Array} paths - An array of paths from the uploaded files
 */
export const handleFileUpload = async (paths, setFileData, setFilesUploaded) => {
   const selectedTheme = await window.glimpseAPI.getTheme();
   let themeData = null;

   setFileData({ loading: true });

   switch (selectedTheme) {
      case "social-theme":
         themeData = await window.glimpseAPI.getThemeJsonData("SocialTheme.json");
         break;
      case "fishing-theme":
         themeData = await window.glimpseAPI.getThemeJsonData("FishingTheme.json");
         break;
      case "layout-theme":
         themeData = await window.glimpseAPI.getThemeJsonData("LevelTheme.json");
         break;
      case "custom-theme":
         if (paths.length > 1) themeData = await getCustomTheme(paths);

         if ("error" in themeData) {
            alert(themeData.error);
            return;
         } else if (themeData === null) {
            themeData = { groups: {}, edgeOptions: {} };
         }

         break;
      default:
         themeData = await window.glimpseAPI.getThemeJsonData("PowerGridTheme.json");
         break;
   }

   if (paths[0].split(".")[1] === "json") {
      setFilesUploaded(true);
      const validFileData = JSON.parse(await window.glimpseAPI.validate(paths));

      if ("error" in validFileData) {
         alert(validFileData.error);
      } else {
         setFileData({
            visData: validFileData,
            theme: themeData,
            isGlm: false,
            loading: false,
         });
      }
   } else if (
      paths[0].split(".")[1] === "glm" &&
      (selectedTheme === "power-grid-theme" || selectedTheme === "custom-theme")
   ) {
      setFilesUploaded(true);
      const data = await window.glimpseAPI.glm2json(paths);
      if (!data) {
         console.log("Something went wrong...");
      } else if (Object.keys(data).includes("alert")) {
         alert(data.alert);
      } else {
         setFileData({
            visData: data,
            theme: typeof themeData === "string" ? JSON.parse(themeData) : themeData,
            isGlm: true,
            loading: false,
         });
      }
   } else {
      alert("All <.glm> File Types Must Be Uploaded With The Power Grid Theme Selected !");
   }
};
