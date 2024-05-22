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
            theme: JSON.parse(themeData),
            isGlm: false,
            loading: false,
         });
      }
   } else if (paths[0].split(".")[1] === "glm" && selectedTheme === "power-grid-theme") {
      setFilesUploaded(true);
      const data = await window.glimpseAPI.glm2json(paths);
      if (!data) {
         console.log("Something went wrong...");
      } else if (Object.keys(data).includes("alert")) {
         alert(data.alert);
      } else {
         setFileData({
            visData: data,
            theme: JSON.parse(themeData),
            isGlm: true,
            loading: false,
         });
      }
   } else {
      alert("All <.glm> File Types Must Be Uploaded With The Power Grid Theme Selected !");
   }
};
