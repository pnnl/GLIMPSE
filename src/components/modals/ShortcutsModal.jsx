import { Fragment } from "react";
import { createPortal } from "react-dom";
import { Modal, Typography } from "antd";
import { SHORTCUTS } from "../../hooks/useShortcut";

// Reference card for the keyboard shortcuts registered around the app (see
// hooks/useShortcut). Opened from the main menu or with "?".
const ShortcutsModal = ({ open, close }) => {
    return createPortal(
        <Modal centered open={open} onCancel={close} footer={null} title="Keyboard Shortcuts">
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                Shortcuts are ignored while you are typing in a text field.
            </Typography.Paragraph>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.6rem 1rem" }}>
                {SHORTCUTS.map(({ combo, label }) => (
                    <Fragment key={combo}>
                        <kbd
                            style={{
                                justifySelf: "start",
                                minWidth: "2rem",
                                textAlign: "center",
                                padding: "0.1rem 0.5rem",
                                border: "1px solid currentColor",
                                borderRadius: 4,
                                fontFamily: "monospace",
                                fontSize: 13,
                                opacity: 0.85,
                            }}
                        >
                            {combo}
                        </kbd>
                        <span>{label}</span>
                    </Fragment>
                ))}
            </div>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default ShortcutsModal;
