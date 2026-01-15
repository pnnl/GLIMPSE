import ReactDOM from "react-dom";
import { Menu } from "antd";

const ITEMS = [
   { key: "hide-all", label: "Hide All", disabled: true },
   { key: "edit-theme", label: "Edit Theme", disabled: true },
];

const LegendContextMenu = ({ context, close }) => {
   if (!context.open) return null;

   const handleMenuClick = ({ key }) => {
      console.log(`Clicked on menu item: ${key}`);
      switch (key) {
         case "hide-all":
            console.log(`type: ${context.type}, group: ${context.group}`);
            break;
         case "edit-theme":
            console.log(`type: ${context.type}, group: ${context.group}`);
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
      document.getElementById("portal")
   );
};

export default LegendContextMenu;
