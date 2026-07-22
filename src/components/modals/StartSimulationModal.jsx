import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, Checkbox, Modal } from "antd";

// localStorage flag persisting the "don't show again" choice across sessions.
export const HIDE_START_SIM_WARNING_KEY = "glimpse-hide-default-sim-config-warning";

/**
 * Confirmation shown when the user starts a simulation without ever opening
 * the simulation configuration form — i.e. the run would use the defaults.
 */
const StartSimulationModal = ({ open, onCancel, onProceed, onReviewConfig }) => {
    const [hideFutureWarnings, setHideFutureWarnings] = useState(false);

    // Every exit clears the checkbox so a checked-but-abandoned box doesn't
    // silently persist on a later visit.
    const closeWith = (callback) => () => {
        setHideFutureWarnings(false);
        callback();
    };

    const handleProceed = closeWith(() => {
        if (hideFutureWarnings) {
            localStorage.setItem(HIDE_START_SIM_WARNING_KEY, "true");
        }
        onProceed();
    });

    return createPortal(
        <Modal
            centered
            open={open}
            title="Start with default configuration?"
            onCancel={closeWith(onCancel)}
            width={480}
            footer={[
                <Button key="cancel" onClick={closeWith(onCancel)}>
                    Cancel
                </Button>,
                <Button key="review" onClick={closeWith(onReviewConfig)}>
                    Review Configuration
                </Button>,
                <Button key="proceed" type="primary" onClick={handleProceed}>
                    Start Simulation
                </Button>,
            ]}
        >
            <p>
                This simulation will run with the default simulation configuration. You can review
                or edit the settings at any time from the gear button in the toolbar.
            </p>
            <Checkbox
                style={{ marginTop: 12 }}
                checked={hideFutureWarnings}
                onChange={(e) => setHideFutureWarnings(e.target.checked)}
            >
                Don&apos;t show this warning again
            </Checkbox>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default StartSimulationModal;
