import { useRef, useEffect, useState } from "react";
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
    const menuRef = useRef(null);
    const [position, setPosition] = useState({ x: context.x, y: context.y });

    useEffect(() => {
        if (!context.open || !menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let x = context.x;
        let y = context.y;

        if (x + rect.width > vw) x = vw - rect.width;
        if (y + rect.height > vh) y = vh - rect.height;
        if (x < 0) x = 0;
        if (y < 0) y = 0;

        setPosition({ x, y });
    }, [context.open, context.x, context.y]);

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
        <div
            ref={menuRef}
            style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                zIndex: 1000,
            }}
        >
            <Menu
                style={{
                    width: "8rem",
                    borderRadius: "0.4rem",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                }}
                onClick={handleMenuClick}
                items={ITEMS}
            />
        </div>,
        document.getElementById("portal"),
    );
};

export default LegendContextMenu;
