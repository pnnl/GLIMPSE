import ReactDOM from "react-dom";
import { Menu } from "antd";

const ITEMS = [
   { key: "hide-all", label: "Hide All", disabled: false },
   { key: "edit-theme", label: "Edit Theme", disabled: true },
];

const LegendContextMenu = ({
   context,
   close,
   onHideAll: hideAll,
   onEditTheme: showThemeEditor,
}) => {
   if (!context.open) return null;

   // type is edge or node
   // group is the object type for that type
   const handleMenuClick = ({ key }) => {
      console.log(`Clicked on menu item: ${key}`);
      switch (key) {
         case "hide-all":
            hideAll(context.type, context.group);
            break;
         case "edit-theme":
            showThemeEditor(context.type, context.group);
            break;
      }

      close();
   };

   return ReactDOM.createPortal(
      <Menu
         style={{
            width: "8rem",
            position: "absolute",
            left: context.x,
            top: context.y,
            borderRadius: "0.4rem",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
            zIndex: 1000,
         }}
         onClick={handleMenuClick}
         items={ITEMS}
      />,
      document.getElementById("portal"),
   );
};

export default LegendContextMenu;
