"""Test the "agents-update" event, which lets an external script report which distributed agents are actually running (contract in EVENTS_API.md).

Load IEEE123 in the UI first and pass one of its switch-area mRIDs as AREA_MRID, or run as-is to exercise validation and the broadcast.
"""

import common

# Replace with a real switch-area mRID from a loaded model to watch a specific
# agent's status dot change in the UI. Any id works for the broadcast itself —
# the frontend keeps agents it doesn't recognize.
AREA_MRID = "system"


def main():
    sio = common.connect()
    try:
        # [1] A well-formed liveness report.
        print("\n[1] Report one agent online")
        common.call(sio, "agents-update", {
            "model": "ieee123",
            "agents": [
                {"agent_id": "coordinating-1", "message_bus_id": "system", "status": "online"},
                {"agent_id": "switch-agent-1", "message_bus_id": AREA_MRID, "status": "online"},
            ],
        })
        sio.sleep(1.5)

        # [2] The same agents going down — the panel's dots should turn red.
        print("\n[2] Report the same agents offline")
        common.call(sio, "agents-update", {
            "model": "ieee123",
            "agents": [
                {"agent_id": "coordinating-1", "message_bus_id": "system", "status": "offline"},
                {"agent_id": "switch-agent-1", "message_bus_id": AREA_MRID, "status": "offline"},
            ],
        })
        sio.sleep(1.5)

        # [3] Validation: the payload must be an object carrying an agents list.
        print("\n[3] Rejected payloads (each should ack with an error)")
        common.call(sio, "agents-update", {"agents": "not-a-list"})
        common.call(sio, "agents-update", "not-an-object")
        common.call(sio, "agents-update", {})

        print("\nDone.")
    finally:
        sio.disconnect()


if __name__ == "__main__":
    main()
