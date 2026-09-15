import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu } from "antd";

// Portalled menu at the cursor, clamped to the viewport. `context` is { open, x, y }.
const ContextMenu = ({ context, width, items, onClick, ...rest }) => {
    const menuRef = useRef(null);
    const [position, setPosition] = useState({ x: context.x, y: context.y });

    useEffect(() => {
        if (!context.open || !menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        setPosition({
            x: Math.max(0, Math.min(context.x, window.innerWidth - rect.width)),
            y: Math.max(0, Math.min(context.y, window.innerHeight - rect.height)),
        });
    }, [context.open, context.x, context.y]);

    if (!context.open) return null;

    return createPortal(
        <div
            ref={menuRef}
            {...rest}
            style={{ position: "absolute", left: position.x, top: position.y, zIndex: 1000 }}
        >
            <Menu
                style={{ width, borderRadius: "0.4rem", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)" }}
                onClick={onClick}
                items={items}
            />
        </div>,
        document.getElementById("portal"),
    );
};

export default ContextMenu;
